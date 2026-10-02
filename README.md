# PanelPay

**A campaign owner posts one brief and one cap. An agent spends that cap only on applicants worth admitting; completion unlocks fixed test-USDC payouts on Arc.**

PanelPay is the Path A rail for the Tameion Agents Hackathon. It turns a brief into a bounded economic decision: admit, skip, or wait. An admitted applicant is paid only after the independent campaign owner confirms the promised deliverable.

The model never holds a key and never releases funds. The Arc contract locks campaign terms, payee addresses, fixed amounts, total caps, request IDs, and completion evidence. Wrong payee, wrong amount, over-cap, replay, and skip-as-pay attempts revert.

> Arc testnet only. Test USDC has no cash value.

[Try the rail](https://panelpay-ruby.vercel.app/) · [2-minute narrated demo](https://raw.githubusercontent.com/dmetagame/panelpay/main/demo-video/panelpay-demo.mp4) · [Judge walkthrough](./DEMO.md) · [Payment proof](./proof/PROOF.md)

## The loop

1. A team opens a campaign with a brief, eligibility rule, completion proof, fixed amount, and cap.
2. Applicants submit a fit statement and an Arc testnet address they control.
3. The agent publishes `admit`, `skip`, or `wait` against the remaining budget.
4. The owner signs `done` or `not done` after reviewing the deliverable.
5. Owner-confirmed completion automatically triggers the executor, which can pay only an admitted, completed, locked payee at the exact campaign amount.
6. A public receipt exposes the decision, evidence hashes, transaction hash, and counterparty classification.

## Smallest judge path

Open one campaign → publish one skip → publish one admit → owner confirms completion → inspect the Arc transaction receipt.

The repository never counts internal dogfood as independent traction. See [TRACTION.md](./TRACTION.md).

For a normal campaign, connect the owner wallet, sign the terms, and share the campaign link. Applicants sign with their receiving wallet; no gas or faucet is required. Anyone can run the agent decision. Admitted applicants send their work to the team owner, who returns with the original owner wallet to sign completion. Refresh the campaign to see another person's application or confirmation.

## Evidence, custody, and current limits

The published proof uses real Arc testnet transactions with labeled internal reviewer fixtures. Independent traction is zero. The current executor is a stated, isolated testnet signer; Circle Developer-Controlled Wallets are not configured and are not claimed. The contract, rather than model output or a database flag, is the payment authorization boundary.

Owner confirmation is a signature on completion evidence. It is not an agent claiming to verify work on its own. Applicants prove control of their receiving address by signature. Public receipts include the rationale, completion evidence, locked address, exact amount, and transaction.

The operator prefunds public test campaigns, with a 0.1 test-USDC campaign ceiling and a bounded executor allowance. This is a test rail, not a claim of real-dollar commercial demand.

## Run and verify

Use Node 22, npm, and Foundry. Run `npm ci`, configure the ignored `.env.local` using `.env.example`, and run `npm run dev`. No key belongs in a client-side variable. For your own deployment, fund an isolated Arc testnet executor, run `forge build`, `npm run generate:artifact`, then `node scripts/deploy.mjs`.

`npm run check` runs policy tests, contract invariants, TypeScript, and the production build. `scripts/browser-smoke.mjs` verifies desktop/mobile and the complete reviewer loop; its test transactions are labeled internal. [Executor boundaries](./docs/EXECUTOR.md) document the exact release conditions.

`scripts/browser-stranger.mjs` checks the normal forms with separate internal owner/applicant wallet harnesses, a rejected wrong-owner confirmation, and real testnet settlement. Wallet signing is simulated; API, model, RPC, and payment responses are not intercepted. Evidence is separate in [proof/stranger-flow](./proof/stranger-flow/). [First external row](./docs/EXTERNAL_ROW.md) defines verification before any independent headline claim; the internal exporter stops when it encounters non-internal activity.
