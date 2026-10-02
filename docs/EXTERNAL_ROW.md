# First external row

No external team has been verified. Submission headline stays **0**. Test USDC, no cash value. This is the operator's verification procedure, not permission to invent a counterparty.

For the first arriving team, retain dated evidence for:

- Campaign URL, contract address, owner handle and owner wallet; the owner's genuine brief and capped fixed incentive.
- Owner identity and relationship to Rouma. Explicitly verify they are not Rouma, dmetagame, Latchline, @Abu_olododo, or a friend. A new handle alone is insufficient. Unknown remains unverified.
- Applicant handle, receiving address, request ID, and relationship to Rouma. Friends remain internal. The signed application proves address control; retain its ApplicationLocked transaction and signed-message verification evidence without private keys.
- Owner-signed completion proof, deliverable reference, settlement transaction, confirmed status, locked recipient and exact amount. Obtain the beneficiary's acknowledgment and publication consent. Avoid publishing private messages without permission.

The application API verifies the signature but does not retain it as public evidence. If the original signed request is unavailable, obtain a fresh address-control signature over a dated challenge naming the campaign/request and receiving address, verify the recovered signer, and retain that verification. An executor-submitted ApplicationLocked event alone is not a replayable proof of the applicant's signature.

Only then add a dated row to TRACTION.md with: campaign/request, owner verification reference, payee verification reference, counterparty class, decision, completion proof, confirmed test USDC, Arc transaction, and beneficiary acknowledgment. Count each request once. Skips are agency evidence, never payment volume. Historical, reviewer, failed and internal runs stay separate.

An on-chain `unverified` label remains an accurate label at submission time. Later operator verification must cite its dated evidence separately; do not rewrite immutable metadata or claim that a handle or environment allowlist alone proves independence.

The internal-only exporter stops before writing if it sees any non-internal owner or applicant. Review the new activity manually; preserve existing ledger rows and headline evidence. Do not bypass that guard to regenerate a zero headline over a verified external row.

No Circle Developer-Controlled Wallet claim is permitted while the stated testnet signer is executor.
