import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
const base = process.env.PANELPAY_BASE_URL || "http://localhost:5190";
mkdirSync("proof/screens", { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PANELPAY_BROWSER ||
    "/home/rouma/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome",
  args: ["--disable-quic", "--disable-http2"],
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const screenshot = async (name) => {
  await page.screenshot({ path: `proof/screens/${name}.png`, fullPage: true });
};
async function finished() {
  await page.waitForFunction(() => !document.querySelector(".status"), {
    timeout: 120000,
  });
  const e = page.locator(".error");
  if (await e.count()) throw new Error(await e.innerText());
}
try {
  await page.goto(base);
  await page.getByRole("button", { name: "Try the internal demo" }).waitFor();
  await page.waitForFunction(
    () => !document.querySelector("button.secondary")?.disabled,
  );
  await screenshot("01-home");
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot("02-mobile");
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw new Error("Mobile overflow");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Try the internal demo" }).click();
  await page.waitForURL("**/campaigns/*", { timeout: 120000 });
  await finished();
  await screenshot("03-campaign");
  await page.getByRole("button", { name: "Add two internal fixtures" }).click();
  await finished();
  await screenshot("04-applications");
  const mismatch = page
    .locator("article")
    .filter({ hasText: "Internal fixture · unrelated applicant" });
  await mismatch.getByRole("button", { name: "Run agent decision" }).click();
  await finished();
  if (!(await mismatch.getByText("skip", { exact: true }).count()))
    throw new Error("Expected mismatch to skip");
  await screenshot("05-skip");
  const fit = page
    .locator("article")
    .filter({ hasText: "Internal fixture · contract reviewer" });
  await fit.getByRole("button", { name: "Run agent decision" }).click();
  await finished();
  if (!(await fit.getByText("admit", { exact: true }).count()))
    throw new Error("Expected matching reviewer admission");
  await screenshot("06-admit");
  await screenshot("07-confirmed");
  await fit
    .getByRole("button", { name: "Owner: mark done", exact: true })
    .click();
  await page.waitForURL("**/runs/**", { timeout: 120000 });
  await finished();
  await page
    .getByText("Arc confirmed", { exact: true })
    .waitFor({ timeout: 120000 });
  await screenshot("08-receipt");
  const parts = new URL(page.url()).pathname.split("/");
  const receipt = await page.evaluate(
    async ({ id, request }) =>
      await (
        await fetch("/api?action=receipt&id=" + id + "&request=" + request)
      ).json(),
    { id: parts[2], request: parts[3] },
  );
  if (!receipt.confirmed || !receipt.txHash)
    throw new Error("Payment is unconfirmed");
  writeFileSync(
    "proof/internal-loop.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        url: page.url(),
        base,
        classification: "reviewer_demo_internal",
        pageErrors: errors,
        receipt,
      },
      null,
      2,
    ),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot("09-mobile-receipt");
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw new Error("Receipt overflow");
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    JSON.stringify({
      result: "PASS",
      receipt: page.url(),
      tx: receipt.txHash,
      classification: "internal",
      independentTraction: 0,
    }),
  );
} finally {
  await browser.close();
}
