import { readFileSync, writeFileSync } from "node:fs";
const artifact = JSON.parse(
  readFileSync("out/PanelPay.sol/PanelPay.json", "utf8"),
);
writeFileSync(
  "src/lib/artifact.ts",
  `// Generated from contracts/PanelPay.sol.\nexport const railAbi = ${JSON.stringify(artifact.abi)} as const;\n`,
);
writeFileSync(
  "scripts/bytecode.json",
  JSON.stringify({ bytecode: artifact.bytecode.object }),
);
