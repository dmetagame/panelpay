# Judge path

[Open PanelPay](https://panelpay-ruby.vercel.app/). Arc testnet only: **test USDC, no cash value**.

1. Choose **Try the internal demo**. The operator funds the campaign; no faucet or browser wallet is needed.
2. Choose **Add two internal fixtures**.
3. Run the agent on the unrelated applicant. Inspect the published skip and saved budget.
4. Run the agent on the contract-review fixture. Inspect the admission and reserved amount.
5. Choose **Owner: mark done**. The browser signs as the internal owner. The separate executor records completion and automatically settles the exact amount.
6. Inspect the public receipt and Arc transaction. Open the receipt again in a fresh browser; it is read from contract state and the recorded payment block.

These are reviewer fixtures, not independent customer activity. No completed work or traction is invented. The fixture proof text is explicitly internal.

## Real team path

Choose **Open a campaign**, provide a real brief, eligibility, completion proof, fixed amount, cap, and deadline. Connect the owner's wallet and sign the terms. Share the resulting campaign URL. Applicants sign ownership of their receiving address and submit evidence. The owner later signs done/not done. All signatures are gasless; the isolated executor relays testnet transactions.

Counterparties start as unverified. The operator may mark addresses independent only after documented verification; friends and internal entities remain excluded. Applying does not mean selection or payment.

## Failure states

- Missing provider/evidence/signature: no decision or payment is submitted.
- Missing/false completion: no settlement is constructed.
- Wrong caller, wrong payee, wrong amount, replay, skip/wait payment, or exhausted cap: contract rejects the action.
- If confirmation succeeds but settlement fails, refresh the campaign and retry its bounded payment. The unique request and paid flag prevent double payment.

See [executor boundaries](docs/EXECUTOR.md), [traction ledger](TRACTION.md), and [public proof](proof/PROOF.md).
