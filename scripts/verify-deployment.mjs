import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, http, keccak256 } from "viem";
import { arcTestnet } from "viem/chains";
const artifact = JSON.parse(
  readFileSync("out/PanelPay.sol/PanelPay.json", "utf8"),
);
const proof = JSON.parse(
  readFileSync("proof/internal-loop.json", "utf8"),
).receipt;
const deployment = JSON.parse(readFileSync("proof/deployment.json", "utf8"));
const p = createPublicClient({ chain: arcTestnet, transport: http() });
const receipt = await p.getTransactionReceipt({ hash: proof.txHash });
if (receipt.status !== "success")
  throw new Error("Published payment not successful");
const code = await p.getBytecode({ address: deployment.contract });
const normalize = (value) => {
  let s = value.replace(/^0x/, "");
  for (const list of Object.values(
    artifact.deployedBytecode.immutableReferences,
  ))
    for (const ref of list)
      s =
        s.slice(0, ref.start * 2) +
        "0".repeat(ref.length * 2) +
        s.slice((ref.start + ref.length) * 2);
  return "0x" + s;
};
const actual = keccak256(normalize(code));
const expected = keccak256(normalize(artifact.deployedBytecode.object));
if (actual !== expected)
  throw new Error("Runtime does not match source artifact");
const campaign = proof.campaign;
const app = proof.application;
const skip = campaign.applications.find((a) => a.decision === 2);
const account = deployment.executor;
const tests = [
  {
    name: "wrong_payee",
    expected: "WrongBeneficiary",
    args: [
      BigInt(campaign.id),
      app.requestId,
      account,
      BigInt(campaign.state.fixedAmount),
    ],
    blockNumber: receipt.blockNumber - 1n,
  },
  {
    name: "wrong_amount",
    expected: "WrongAmount",
    args: [
      BigInt(campaign.id),
      app.requestId,
      app.payee,
      BigInt(campaign.state.fixedAmount) + 1n,
    ],
    blockNumber: receipt.blockNumber - 1n,
  },
  {
    name: "skip_as_pay",
    expected: "SkipAsPay",
    args: [
      BigInt(campaign.id),
      skip.requestId,
      skip.payee,
      BigInt(campaign.state.fixedAmount),
    ],
  },
  {
    name: "replay",
    expected: "Replay",
    args: [
      BigInt(campaign.id),
      app.requestId,
      app.payee,
      BigInt(campaign.state.fixedAmount),
    ],
  },
  {
    name: "wrong_caller",
    expected: "UnauthorizedCaller",
    account: app.payee,
    args: [
      BigInt(campaign.id),
      app.requestId,
      app.payee,
      BigInt(campaign.state.fixedAmount),
    ],
  },
];
const results = [];
for (const t of tests) {
  let errorName;
  try {
    await p.simulateContract({
      address: deployment.contract,
      abi: artifact.abi,
      functionName: "settle",
      account: t.account || account,
      args: t.args,
      blockNumber: t.blockNumber,
    });
  } catch (e) {
    errorName = e.walk?.((x) => x.name === "ContractFunctionRevertedError")
      ?.data?.errorName;
  }
  if (errorName !== t.expected)
    throw new Error(`${t.name}: expected ${t.expected}, got ${errorName}`);
  results.push({
    case: t.name,
    revert: errorName,
    method: "read-only eth_call on deployed Arc contract",
    block: t.blockNumber?.toString() || "latest",
  });
}
const output = {
  at: new Date().toISOString(),
  chainId: 5042002,
  contract: deployment.contract,
  runtimeMatchesSource: true,
  normalizedRuntimeHash: actual,
  confirmedPayment: proof.txHash,
  paymentBlock: receipt.blockNumber.toString(),
  results,
  capProof:
    "test/PanelPay.t.sol:testOverCapReverts; 25,000 cap rejects third 10,000 admission after 20,000 spent. Admission reserves capacity on-chain; not done releases it.",
};
writeFileSync("proof/invariants.json", JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
