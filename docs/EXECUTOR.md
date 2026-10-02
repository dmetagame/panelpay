# Executor boundaries

## On-chain

`contracts/PanelPay.sol` authorizes one immutable executor. The constructor accepts Arc testnet (5042002) or local Foundry (31337); deployment scripts additionally require Arc testnet.

- Unknown caller reverts `UnauthorizedCaller` on every state-changing entry point.
- Campaign terms hash must equal the public metadata hash. Fixed amount, cap, owner, and deadline are immutable after opening.
- Each application locks a payee and evidence hash. A globally reused request identifier reverts.
- Admission reserves the fixed amount on-chain. Admission that would overcommit the cap reverts `CapExceeded`, including concurrent requests.
- Skip and admit are final agent decisions. A wait can be reassessed before the deadline.
- Completion requires an owner signature covering contract, chain, campaign, request, done/not done, proof hash, and owner nonce. Replays, wrong owner, and missing proof revert.
- Not done releases the reservation; changing it back to done must reacquire capacity.
- Settlement requires admit + done + unused payment. It compares the supplied payee and amount against locked state, checks the cap, consumes the request, records the payment block, and transfers exactly the fixed amount.
- Skip-as-pay, wait-as-pay, missing/false completion, wrong beneficiary, wrong amount, cap overflow, and duplicate payment revert.
- The contract exposes no arbitrary transfer or payee-edit path. Expired campaigns refund remaining funds to the executor.

## Off-chain

- The model receives only campaign terms, applicant evidence, existing admissions, and unreserved budget. It has no tools, key, or payment permission.
- Typed `admit / skip / wait` output is a proposal. Model failure or invalid output fails closed.
- Public campaign and application creation require signatures from the owner or locked receiving address.
- The payment executor lives outside the model call. The API constructs settlement only after admission and owner-confirmed completion.
- The owner confirmation action automatically requests bounded settlement. A retry button is recovery only.
- The app uses a **stated, isolated Arc testnet signer**. Circle Developer-Controlled Wallets are not configured; no Wallets integration is claimed.
- Only confirmed independent beneficiaries and independent owners qualify for traction headlines. Internal names, friends, reviewer fixtures, unverified participants, retries, and failures are excluded.

## Verification

`forge test -vv` exercises the EVM boundary. `scripts/verify-deployment.mjs` compares deployed runtime against the compiled artifact (normalizing immutable slots) and checks named reverts using read-only calls against the real Arc state. These calls are not failed payment transactions and are never counted as volume.

RPC reads use multicall and testnet fallback endpoints from [Arc's official connection reference](https://docs.arc.io/arc/references/connect-to-arc). Receipts query only the block stored by the payment, avoiding historical scans.
