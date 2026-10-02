# PanelPay

**A campaign owner posts one brief and one cap. An agent spends that cap only on applicants worth admitting; completion unlocks fixed test-USDC payouts on Arc.**

PanelPay is the Path A rail for the Tameion Agents Hackathon. It turns a brief into a bounded economic decision: admit, skip, or wait. An admitted applicant is paid only after the independent campaign owner confirms the promised deliverable.

The model never holds a key and never releases funds. The Arc contract locks campaign terms, payee addresses, fixed amounts, total caps, request IDs, and completion evidence. Wrong payee, wrong amount, over-cap, replay, and skip-as-pay attempts revert.

> Arc testnet only. Test USDC has no cash value.

## The loop

1. A team opens a campaign with a brief, eligibility rule, completion proof, fixed amount, and cap.
2. Applicants submit a fit statement and an Arc testnet address they control.
3. The agent publishes `admit`, `skip`, or `wait` against the remaining budget.
4. The owner signs `done` or `not done` after reviewing the deliverable.
5. The executor can pay only an admitted, completed, locked payee at the exact campaign amount.
6. A public receipt exposes the decision, evidence hashes, transaction hash, and counterparty classification.

## Smallest judge path

Open one campaign → publish one skip → publish one admit → owner confirms completion → inspect the Arc transaction receipt.

The repository never counts internal dogfood as independent traction. See [TRACTION.md](./TRACTION.md).

