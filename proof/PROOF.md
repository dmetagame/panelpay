# Verified internal payment proof

**Test USDC, no cash value. Internal reviewer fixtures; independent traction = 0.**

Public loop: [receipt](https://panelpay-ruby.vercel.app/runs/2/0xff9b5560736c455424b7a4862927dd1de26b25aab056220b5be85c1e6638d13b).

- Contract: [0xfedb374bbb6e157505e50c5d88d376ee5fd1e50a](https://testnet.arcscan.app/address/0xfedb374bbb6e157505e50c5d88d376ee5fd1e50a)
- Chain: Arc testnet, 5042002.
- Executor: 0xa9916Ee933748a07A56017C948e9A01cF4AdABd6, stated isolated testnet signer. Circle DCW is not configured.
- Payment: 0.01 test USDC to 0x2EE81fa2f49A70d0F3b30710EaAdd1543b33e245.
- Transaction: [0xaaf81164930a48e247801041217457258abafce5a63937ceb2c34f997f9e0eb6](https://testnet.arcscan.app/tx/0xaaf81164930a48e247801041217457258abafce5a63937ceb2c34f997f9e0eb6)
- Owner confirmation: signed done, with explicitly internal fixture evidence.
- Sequence: open → skip → admit → owner confirms → automatic settlement → exact-block public receipt.

Desktop (1440 px) and mobile (390 px) browser verification passed without page errors or horizontal overflow. No wallet or RPC response was intercepted. HTTP/1.1 browser flags avoid this workspace's Chromium network-change issue.

The deployed runtime matches the compiled source after normalizing immutable slots. Wrong beneficiary, wrong amount, skip-as-pay, replay, and wrong caller were checked using real-chain read-only calls. Admission cap and reservation/release behavior passed in the 17-test contract suite. [Detailed invariants](invariants.json).

The first proof is preserved in [archive-v1](archive-v1/); it is an older rail revision. [Deployment metadata](deployment.json), [full current loop](internal-loop.json), and [dated ledger](ledger.json) remain inspectable.
