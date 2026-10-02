import { z } from "zod";
import { getAddress, keccak256, stringToHex } from "viem";
export const DISCLAIMER = "test USDC, no cash value";
export const CHAIN_ID = 5042002;
export const USDC = "0x3600000000000000000000000000000000000000" as const;
export const INTERNAL = [
  "rouma",
  "dmetagame",
  "latchline",
  "latchline labs",
  "@latchlinelabs",
  "@abu_olododo",
  "abu_olododo",
];
export const textHash = (text: string) => keccak256(stringToHex(text));
const address = z
  .string()
  .refine((v) => /^0x[0-9a-fA-F]{40}$/.test(v), "Enter a valid Arc address")
  .transform((v) => getAddress(v));
export const campaignSchema = z
  .object({
    title: z.string().trim().min(5).max(100),
    ownerHandle: z.string().trim().min(2).max(80),
    owner: address,
    brief: z.string().trim().min(30).max(2500),
    eligibility: z.string().trim().min(15).max(1200),
    completion: z.string().trim().min(15).max(1200),
    amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
    cap: z.string().regex(/^\d+(\.\d{1,6})?$/),
    deadline: z.number().int().positive(),
    classification: z.enum(["internal", "unverified", "independent"]),
    publicConsent: z.literal(true),
    salt: z.string().min(10).max(80),
  })
  .refine(
    (v) =>
      Number(v.amount) > 0 &&
      Number(v.cap) >= Number(v.amount) &&
      Number(v.cap) <= 0.1,
    "Cap must cover the amount and be at most 0.1 test USDC",
  );
export const applicationSchema = z.object({
  handle: z.string().trim().min(2).max(80),
  payee: address,
  fit: z.string().trim().min(20).max(2000),
  evidence: z.string().trim().min(8).max(1000),
  publicConsent: z.literal(true),
  classification: z.enum(["internal", "unverified", "independent"]),
  salt: z.string().min(10).max(80),
});
export const proposalSchema = z.object({
  decision: z.enum(["admit", "skip", "wait"]),
  reason: z.string().min(10).max(1400),
  evidence: z.array(z.string().max(500)).min(1).max(5),
});
export type CampaignTerms = z.infer<typeof campaignSchema>;
export type ApplicationTerms = z.infer<typeof applicationSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export function normalizeClass(
  handle: string,
  claimed: string,
  address: string,
  verified: string[] = [],
): "internal" | "unverified" | "independent" {
  const cleaned = handle.trim().toLowerCase().replace(/^@/, "");
  if (
    claimed === "internal" ||
    INTERNAL.some(
      (h) => cleaned === h.replace(/^@/, "") || cleaned.includes("latchline"),
    )
  )
    return "internal";
  return verified.map((v) => v.toLowerCase()).includes(address.toLowerCase())
    ? "independent"
    : "unverified";
}
export function availableBudget(
  cap: bigint,
  spent: bigint,
  amount: bigint,
  unpaidAdmits: number,
) {
  return cap - spent - amount * BigInt(unpaidAdmits);
}
export function gateProposal(
  proposal: Proposal,
  available: bigint,
  amount: bigint,
): Proposal {
  if (proposal.decision === "admit" && available < amount)
    return {
      ...proposal,
      decision: "wait",
      reason:
        "Remaining unreserved budget cannot cover the fixed incentive. " +
        proposal.reason,
    };
  return proposal;
}
export function headlineEligible(
  ownerClass: string,
  payeeClass: string,
  done: boolean,
  txConfirmed: boolean,
) {
  return (
    ownerClass === "independent" &&
    payeeClass === "independent" &&
    done &&
    txConfirmed
  );
}
