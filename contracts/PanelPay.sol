// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title PanelPay — evidence-gated campaign payouts on Arc testnet
/// @notice Test USDC has no cash value. The model proposes; this contract authorizes.
contract PanelPay {
    enum Decision {
        None,
        Admit,
        Skip,
        Wait
    }

    struct Campaign {
        address owner;
        bytes32 termsHash;
        uint96 fixedAmount;
        uint96 cap;
        uint96 spent;
        uint96 reserved;
        uint64 deadline;
        bool active;
    }

    struct Application {
        address payee;
        bytes32 evidenceHash;
        Decision decision;
        uint8 completion; // 0 unreviewed, 1 done, 2 not done
        bool paid;
        uint64 paidBlock;
    }

    IERC20 public immutable usdc;
    address public immutable executor;
    uint256 public campaignCount;
    uint256 private locked;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => string) public campaignMetadata;
    mapping(uint256 => mapping(bytes32 => Application)) public applications;
    mapping(uint256 => mapping(bytes32 => string)) public applicationMetadata;
    mapping(uint256 => bytes32[]) private requestIds;
    mapping(uint256 => mapping(bytes32 => string)) public decisionMetadata;
    mapping(uint256 => mapping(bytes32 => string)) public completionMetadata;
    mapping(bytes32 => bool) public requestIdUsed;
    mapping(address => uint256) public ownerNonces;

    event CampaignOpened(
        uint256 indexed campaignId,
        address indexed owner,
        bytes32 indexed termsHash,
        uint96 fixedAmount,
        uint96 cap,
        uint64 deadline,
        string metadata
    );
    event ApplicationLocked(
        uint256 indexed campaignId,
        bytes32 indexed requestId,
        address indexed payee,
        bytes32 evidenceHash,
        string metadata
    );
    event DecisionRecorded(
        uint256 indexed campaignId,
        bytes32 indexed requestId,
        Decision decision,
        bytes32 rationaleHash,
        string rationale
    );
    event CompletionRecorded(
        uint256 indexed campaignId, bytes32 indexed requestId, bool done, bytes32 proofHash, address owner
    );
    event Paid(uint256 indexed campaignId, bytes32 indexed requestId, address indexed payee, uint96 amount);
    event CampaignClosed(uint256 indexed campaignId, uint96 refunded);

    error UnauthorizedCaller();
    error BadArguments();
    error TransferFailed();
    error Reentrant();
    error CampaignInactive();
    error CampaignExpired();
    error UnknownApplication();
    error RequestIdAlreadyUsed();
    error DecisionLocked();
    error UnsupportedDecision();
    error SkipAsPay();
    error DecisionNotAdmitted();
    error CompletionMissing();
    error CompletionRejected();
    error InvalidOwnerSignature();
    error WrongBeneficiary();
    error WrongAmount();
    error CapExceeded();
    error Replay();

    modifier onlyExecutor() {
        if (msg.sender != executor) revert UnauthorizedCaller();
        _;
    }

    modifier nonReentrant() {
        if (locked != 0) revert Reentrant();
        locked = 1;
        _;
        locked = 0;
    }

    constructor(address usdc_, address executor_) {
        if (block.chainid != 5042002 && block.chainid != 31337) revert BadArguments();
        if (usdc_ == address(0) || executor_ == address(0)) revert BadArguments();
        usdc = IERC20(usdc_);
        executor = executor_;
    }

    function openCampaign(
        address owner,
        bytes32 termsHash,
        uint96 fixedAmount,
        uint96 cap,
        uint64 deadline,
        string calldata metadata
    ) external onlyExecutor nonReentrant returns (uint256 campaignId) {
        if (
            owner == address(0) || termsHash == bytes32(0) || fixedAmount == 0 || cap < fixedAmount
                || deadline <= block.timestamp || bytes(metadata).length == 0
        ) revert BadArguments();

        campaignId = ++campaignCount;
        campaigns[campaignId] = Campaign({
            owner: owner,
            termsHash: termsHash,
            fixedAmount: fixedAmount,
            cap: cap,
            spent: 0,
            reserved: 0,
            deadline: deadline,
            active: true
        });
        campaignMetadata[campaignId] = metadata;
        if (keccak256(bytes(metadata)) != termsHash) revert BadArguments();

        _safeTransferFrom(executor, address(this), cap);
        emit CampaignOpened(campaignId, owner, termsHash, fixedAmount, cap, deadline, metadata);
    }

    function lockApplication(
        uint256 campaignId,
        bytes32 requestId,
        address payee,
        bytes32 evidenceHash,
        string calldata metadata
    ) external onlyExecutor {
        Campaign storage campaign = _activeCampaign(campaignId);
        if (block.timestamp > campaign.deadline) revert CampaignExpired();
        if (
            requestId == bytes32(0) || payee == address(0) || evidenceHash == bytes32(0)
                || bytes(metadata).length == 0
        ) revert BadArguments();
        if (requestIdUsed[requestId]) revert RequestIdAlreadyUsed();

        requestIdUsed[requestId] = true;
        applications[campaignId][requestId] = Application({
            payee: payee,
            evidenceHash: evidenceHash,
            decision: Decision.None,
            completion: 0,
            paid: false,
            paidBlock: 0
        });
        applicationMetadata[campaignId][requestId] = metadata;
        if (keccak256(bytes(metadata)) != evidenceHash) revert BadArguments();
        requestIds[campaignId].push(requestId);
        emit ApplicationLocked(campaignId, requestId, payee, evidenceHash, metadata);
    }

    function recordDecision(
        uint256 campaignId,
        bytes32 requestId,
        Decision decision,
        string calldata rationale
    ) external onlyExecutor {
        Campaign storage campaign = _activeCampaign(campaignId);
        if (block.timestamp > campaign.deadline) revert CampaignExpired();
        Application storage application = _application(campaignId, requestId);
        if (decision == Decision.None || bytes(rationale).length == 0) revert UnsupportedDecision();
        if (application.decision == Decision.Admit || application.decision == Decision.Skip) {
            revert DecisionLocked();
        }
        application.decision = decision;
        if (decision == Decision.Admit) {
            if (uint256(campaign.spent) + campaign.reserved + campaign.fixedAmount > campaign.cap) {
                revert CapExceeded();
            }
            campaign.reserved += campaign.fixedAmount;
        }
        decisionMetadata[campaignId][requestId] = rationale;
        emit DecisionRecorded(campaignId, requestId, decision, keccak256(bytes(rationale)), rationale);
    }

    function completionDigest(
        uint256 campaignId,
        bytes32 requestId,
        bool done,
        bytes32 proofHash,
        uint256 nonce
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(address(this), block.chainid, campaignId, requestId, done, proofHash, nonce)
        );
    }

    function recordCompletion(
        uint256 campaignId,
        bytes32 requestId,
        bool done,
        bytes32 proofHash,
        string calldata proof,
        uint256 nonce,
        bytes calldata ownerSignature
    ) external onlyExecutor {
        Campaign storage campaign = _activeCampaign(campaignId);
        Application storage application = _application(campaignId, requestId);
        if (proofHash == bytes32(0) || keccak256(bytes(proof)) != proofHash) revert CompletionMissing();
        if (application.paid) revert Replay();
        if (nonce != ownerNonces[campaign.owner]) revert InvalidOwnerSignature();
        bytes32 signed = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                completionDigest(campaignId, requestId, done, proofHash, nonce)
            )
        );
        if (_recover(signed, ownerSignature) != campaign.owner) revert InvalidOwnerSignature();

        ownerNonces[campaign.owner] = nonce + 1;
        if (application.decision != Decision.Admit) revert DecisionNotAdmitted();
        if (!done && application.completion != 2) campaign.reserved -= campaign.fixedAmount;
        if (done && application.completion == 2) {
            if (uint256(campaign.spent) + campaign.reserved + campaign.fixedAmount > campaign.cap) {
                revert CapExceeded();
            }
            campaign.reserved += campaign.fixedAmount;
        }
        application.completion = done ? 1 : 2;
        completionMetadata[campaignId][requestId] = proof;
        emit CompletionRecorded(campaignId, requestId, done, proofHash, campaign.owner);
    }

    function settle(uint256 campaignId, bytes32 requestId, address suppliedPayee, uint96 suppliedAmount)
        external
        onlyExecutor
        nonReentrant
    {
        Campaign storage campaign = _activeCampaign(campaignId);
        if (block.timestamp > campaign.deadline) revert CampaignExpired();
        Application storage application = _application(campaignId, requestId);
        if (application.paid) revert Replay();
        if (application.decision == Decision.Skip) revert SkipAsPay();
        if (application.decision != Decision.Admit) revert DecisionNotAdmitted();
        if (application.completion == 0) revert CompletionMissing();
        if (application.completion != 1) revert CompletionRejected();
        if (suppliedPayee != application.payee) revert WrongBeneficiary();
        if (suppliedAmount != campaign.fixedAmount) revert WrongAmount();
        if (uint256(campaign.spent) + suppliedAmount > campaign.cap) revert CapExceeded();

        application.paid = true;
        application.paidBlock = uint64(block.number);
        campaign.spent += suppliedAmount;
        campaign.reserved -= suppliedAmount;
        if (campaign.spent == campaign.cap) campaign.active = false;

        _safeTransfer(suppliedPayee, suppliedAmount);
        emit Paid(campaignId, requestId, suppliedPayee, suppliedAmount);
    }

    function closeExpiredCampaign(uint256 campaignId) external onlyExecutor nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        if (!campaign.active || block.timestamp <= campaign.deadline) revert CampaignInactive();
        campaign.active = false;
        uint96 remaining = campaign.cap - campaign.spent;
        if (remaining != 0) _safeTransfer(executor, remaining);
        emit CampaignClosed(campaignId, remaining);
    }

    function getCampaign(uint256 campaignId) external view returns (Campaign memory) {
        return campaigns[campaignId];
    }

    function getApplication(uint256 campaignId, bytes32 requestId)
        external
        view
        returns (Application memory)
    {
        return applications[campaignId][requestId];
    }

    function getRequestIds(uint256 campaignId) external view returns (bytes32[] memory) {
        return requestIds[campaignId];
    }

    function _activeCampaign(uint256 campaignId) internal view returns (Campaign storage campaign) {
        campaign = campaigns[campaignId];
        if (!campaign.active) revert CampaignInactive();
    }

    function _application(uint256 campaignId, bytes32 requestId)
        internal
        view
        returns (Application storage application)
    {
        application = applications[campaignId][requestId];
        if (application.payee == address(0)) revert UnknownApplication();
    }

    function _recover(bytes32 digest, bytes calldata signature) internal pure returns (address signer) {
        if (signature.length != 65) revert InvalidOwnerSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidOwnerSignature();
        if (uint256(s) > 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0) {
            revert InvalidOwnerSignature();
        }
        signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidOwnerSignature();
    }

    function _safeTransfer(address to, uint256 amount) internal {
        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
