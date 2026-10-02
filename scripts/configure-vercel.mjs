import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const values = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
for (const name of [
  "PANELPAY_KEY_SCOPE",
  "PANELPAY_EXECUTOR_PRIVATE_KEY",
  "PANELPAY_EXECUTOR_ADDRESS",
  "PANELPAY_CONTRACT_ADDRESS",
  "PANELPAY_DEPLOYMENT_BLOCK",
  "AI_GATEWAY_API_KEY",
  "PANELPAY_AGENT_MODEL",
]) {
  if (!values[name]) throw new Error("Missing " + name);
  const args = ["vercel@latest", "env", "add", name, "production", "--force"];
  if (name.includes("PRIVATE_KEY") || name === "AI_GATEWAY_API_KEY")
    args.push("--sensitive");
  const result = spawnSync("npx", args, {
    input: values[name],
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error("Failed to configure", name, result.stderr?.slice(-1000));
    process.exit(1);
  }
  console.log("Configured", name);
}
