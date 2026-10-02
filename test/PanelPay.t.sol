// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../contracts/PanelPay.sol";
import "../contracts/MockUSDC.sol";

interface Vm {
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function prank(address) external;
    function expectRevert(bytes4) external;
    function warp(uint256) external;
}

contract PanelPayTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    PanelPay rail;
    MockUSDC token;
    address owner;
    address payee = address(0xbeef);
    bytes32 request = keccak256("request-1");
    uint256 campaign;

    function setUp() public {
        owner = vm.addr(123);
        token = new MockUSDC();
        rail = new PanelPay(address(token), address(this));
        token.mint(address(this), 1_000_000);
        token.approve(address(rail), 1_000_000);
        campaign = rail.openCampaign(owner, keccak256("terms"), 10_000, 25_000, uint64(block.timestamp + 1 days), "terms");
        rail.lockApplication(campaign, request, payee, keccak256("evidence"), "evidence");
    }

    function confirm(bytes32 id, bool done, uint256 key) internal {
        uint256 nonce = rail.ownerNonces(owner);
        bytes32 digest = rail.completionDigest(campaign, id, done, keccak256("proof"), nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)));
        if (key != 123) vm.expectRevert(PanelPay.InvalidOwnerSignature.selector);
        rail.recordCompletion(campaign, id, done, keccak256("proof"), "proof", nonce, abi.encodePacked(r, s, v));
    }
    function ready() internal {
        rail.recordDecision(campaign, request, PanelPay.Decision.Admit, "Worth budget");
        confirm(request, true, 123);
    }
    function testExactPayment() public {
        ready();
        rail.settle(campaign, request, payee, 10_000);
        require(token.balanceOf(payee) == 10_000);
        require(rail.getApplication(campaign, request).paid);
    }
    function testWrongCallerReverts() public {
        vm.prank(owner);
        vm.expectRevert(PanelPay.UnauthorizedCaller.selector);
        rail.settle(campaign, request, payee, 10_000);
    }
    function testWrongPayeeReverts() public {
        ready();
        vm.expectRevert(PanelPay.WrongBeneficiary.selector);
        rail.settle(campaign, request, owner, 10_000);
    }
    function testWrongAmountReverts() public {
        ready();
        vm.expectRevert(PanelPay.WrongAmount.selector);
        rail.settle(campaign, request, payee, 11_000);
    }
    function testReplayReverts() public {
        ready();
        rail.settle(campaign, request, payee, 10_000);
        vm.expectRevert(PanelPay.Replay.selector);
        rail.settle(campaign, request, payee, 10_000);
    }
    function testDuplicateRequestReverts() public {
        vm.expectRevert(PanelPay.RequestIdAlreadyUsed.selector);
        rail.lockApplication(campaign, request, owner, keccak256("evidence"), "evidence");
    }
    function testSkipAsPayReverts() public {
        rail.recordDecision(campaign, request, PanelPay.Decision.Skip, "Missing required experience");
        vm.expectRevert(PanelPay.SkipAsPay.selector);
        rail.settle(campaign, request, payee, 10_000);
    }
    function testWaitCannotPay() public {
        rail.recordDecision(campaign, request, PanelPay.Decision.Wait, "Need clearer evidence");
        vm.expectRevert(PanelPay.DecisionNotAdmitted.selector);
        rail.settle(campaign, request, payee, 10_000);
    }
    function testMissingCompletionReverts() public {
        rail.recordDecision(campaign, request, PanelPay.Decision.Admit, "Fit");
        vm.expectRevert(PanelPay.CompletionMissing.selector);
        rail.settle(campaign, request, payee, 10_000);
    }
    function testNotDoneCannotPay() public {
        rail.recordDecision(campaign, request, PanelPay.Decision.Admit, "Fit");
        confirm(request, false, 123);
        vm.expectRevert(PanelPay.CompletionRejected.selector);
        rail.settle(campaign, request, payee, 10_000);
    }
    function testOtherOwnerCannotConfirm() public {
        rail.recordDecision(campaign, request, PanelPay.Decision.Admit, "Fit");
        confirm(request, true, 456);
    }
    function testOverCapReverts() public {
        ready();
        rail.settle(campaign, request, payee, 10_000);
        for (uint256 i = 2; i <= 3; i++) {
            bytes32 id = bytes32(i);
            rail.lockApplication(campaign, id, payee, keccak256("evidence"), "evidence");
            rail.recordDecision(campaign, id, PanelPay.Decision.Admit, "Fit");
            confirm(id, true, 123);
            if (i == 3) vm.expectRevert(PanelPay.CapExceeded.selector);
            rail.settle(campaign, id, payee, 10_000);
        }
        require(token.balanceOf(payee) == 20_000);
    }
    function testMissingEvidenceReverts() public {
        vm.expectRevert(PanelPay.BadArguments.selector);
        rail.lockApplication(campaign, bytes32(uint256(2)), payee, bytes32(0), "");
    }
    function testTermsHashMismatchReverts() public {
        vm.expectRevert(PanelPay.BadArguments.selector);
        rail.openCampaign(owner, keccak256("wrong"), 10_000, 20_000, uint64(block.timestamp + 1 days), "terms");
    }
    function testExpiredCannotSettleAndRefund() public {
        ready();
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(PanelPay.CampaignExpired.selector);
        rail.settle(campaign, request, payee, 10_000);
        rail.closeExpiredCampaign(campaign);
        require(token.balanceOf(address(this)) == 1_000_000);
    }
    function testAdmitCannotBecomeSkip() public {
        ready();
        vm.expectRevert(PanelPay.DecisionLocked.selector);
        rail.recordDecision(campaign, request, PanelPay.Decision.Skip, "Changed model opinion");
    }
}
