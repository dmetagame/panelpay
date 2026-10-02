// Deploys with an explicitly funded, isolated Arc testnet executor. Never prints keys.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  erc20Abi,
  parseUnits,
} from "viem";
import { arcTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    }),
);
if (env.PANELPAY_KEY_SCOPE !== "arc-testnet")
  throw new Error("Explicit Arc testnet key scope is required.");
if (env.PANELPAY_CONTRACT_ADDRESS && !process.argv.includes("--new-contract")) {
  console.log("Already deployed:", env.PANELPAY_CONTRACT_ADDRESS);
  process.exit(0);
}
const p = createPublicClient({
  chain: arcTestnet,
  transport: http("https://rpc.testnet.arc.io"),
});
if ((await p.getChainId()) !== 5042002)
  throw new Error("RPC is not Arc testnet.");
const account = privateKeyToAccount(env.PANELPAY_EXECUTOR_PRIVATE_KEY);
const w = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http("https://rpc.testnet.arc.io"),
});
const token = "0x3600000000000000000000000000000000000000";
const artifact = JSON.parse(
  readFileSync("out/PanelPay.sol/PanelPay.json", "utf8"),
);
if (env.PANELPAY_CONTRACT_ADDRESS) {
  const archive = "proof/archive/" + env.PANELPAY_CONTRACT_ADDRESS;
  mkdirSync(archive, { recursive: true });
  copyFileSync("proof/deployment.json", archive + "/deployment.json");
  for (const file of ["internal-loop.json", "invariants.json"])
    try {
      const contents = JSON.parse(readFileSync("proof/" + file, "utf8"));
      const oldAddress = contents.receipt?.contract || contents.contract;
      if (
        oldAddress?.toLowerCase() ===
        env.PANELPAY_CONTRACT_ADDRESS.toLowerCase()
      )
        copyFileSync("proof/" + file, archive + "/" + file);
    } catch {}
}
const transactionHash = await w.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode.object,
  args: [token, account.address],
});
const r = await p.waitForTransactionReceipt({ hash: transactionHash });
if (r.status !== "success") throw new Error("Deployment reverted");
const approval = await w.writeContract({
  address: token,
  abi: erc20Abi,
  functionName: "approve",
  args: [r.contractAddress, parseUnits("2", 6)],
});
await p.waitForTransactionReceipt({ hash: approval });
env.PANELPAY_CONTRACT_ADDRESS = r.contractAddress;
env.PANELPAY_DEPLOYMENT_BLOCK = r.blockNumber.toString();
env.PANELPAY_EXECUTOR_ADDRESS = account.address;
writeFileSync(
  ".env.local",
  Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
mkdirSync("proof", { recursive: true });
writeFileSync(
  "proof/deployment.json",
  JSON.stringify(
    {
      chainId: 5042002,
      disclaimer: "test USDC, no cash value",
      contract: r.contractAddress,
      executor: account.address,
      signer: "stated Arc testnet signer",
      transactionHash,
      block: r.blockNumber.toString(),
      token,
      approval,
      at: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log("Deployed", r.contractAddress, "transaction", transactionHash);
