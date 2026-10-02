import { chromium } from 'playwright';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { mkdirSync, writeFileSync } from 'node:fs';

// Internal wallet harness for the NORMAL forms. No API, model, RPC or payment
// response is intercepted. This is UI verification, never outsider traction.
const base = process.env.PANELPAY_BASE_URL || 'http://localhost:5190';
const dir = 'proof/stranger-flow';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PANELPAY_BROWSER || '/home/rouma/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome',
  args: ['--disable-quic', '--disable-http2'], headless: true,
});
const errors = [];
async function walletPage() {
  const account = privateKeyToAccount(generatePrivateKey());
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.exposeBinding('internalWalletRequest', async (_, { method, params }) => {
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [account.address];
    if (method === 'eth_chainId') return '0x' + (5042002).toString(16);
    if (method === 'personal_sign') return account.signMessage({ message: { raw: params[0] } });
    throw new Error('Unsupported internal wallet method: ' + method);
  });
  await context.addInitScript(() => {
    window.ethereum = { request: (args) => window.internalWalletRequest(args), on() {}, removeListener() {} };
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  return page;
}
async function finished(page) {
  await page.waitForFunction(() => !document.querySelector('.status'), null, { timeout: 180000 });
  if (await page.locator('.error').count()) throw new Error(await page.locator('.error').innerText());
}
async function screen(page, name) {
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Overflow: ' + name);
}
try {
  const owner = await walletPage();
  await owner.goto(base);
  await owner.getByRole('button', { name: 'Open a campaign' }).click();
  await owner.getByLabel('Campaign title', { exact: true }).fill('Internal usability check: review authorization');
  await owner.getByLabel('Team / owner handle').fill('Rouma — internal normal-form verification');
  await owner.getByLabel('The brief', { exact: true }).fill('INTERNAL UI TEST: review an EVM payout contract and write a verification note describing wrong-payee and replay rejection. No independent team or completed real work is claimed.');
  await owner.getByLabel('Eligibility and selection criteria').fill('Must demonstrate EVM authorization and replay-protection testing experience with a specific reproducible example. Skip unrelated applicants without this experience.');
  await owner.getByLabel('Required completion proof').fill('Owner reviews a written authorization and receipt verification note. All inputs and completion in this campaign are internal UI fixtures, not independent work.');
  await owner.getByLabel('Campaign cap · test USDC').fill('0.02');
  await owner.getByRole('button', { name: 'Connect owner wallet', exact: true }).click();
  await owner.getByLabel('This is Rouma').check();
  await owner.getByLabel('I permit public').check();
  await screen(owner, '01-normal-open-form');
  await owner.getByRole('button', { name: 'Sign terms & open campaign' }).click();
  await owner.waitForURL('**/campaigns/*', { timeout: 180000 });
  await finished(owner);
  const campaignURL = owner.url();
  for (const kind of ['skip', 'admit']) {
    const applicant = await walletPage();
    await applicant.goto(campaignURL);
    await applicant.getByLabel('Your handle', { exact: true }).fill('Internal normal-form ' + kind);
    await applicant.getByLabel('Why you fit the brief').fill(kind === 'skip'
      ? 'I only illustrate restaurant menus. I have never reviewed an EVM contract and have no authorization or replay-testing experience.'
      : 'I review EVM access control and replay protection. I use expectRevert for wrong beneficiary and duplicate request ID, and verify exact token recipient and amount against transaction logs.');
    await applicant.getByLabel('Evidence or example').fill(kind === 'skip'
      ? 'Internal mismatch fixture: no contract-testing evidence.'
      : 'Internal matching fixture: wrong-beneficiary settlement must revert; consuming the same request ID twice must revert; inspect ERC20 transfer logs. This is test evidence only.');
    await applicant.getByRole('button', { name: 'Connect your receiving wallet' }).click();
    await applicant.getByLabel('I am a friend or internal').check();
    await applicant.getByLabel('My address is mine').check();
    await applicant.getByRole('button', { name: 'Sign & lock application' }).click();
    await finished(applicant);
    const card = applicant.locator('article').filter({ hasText: 'Internal normal-form ' + kind });
    await card.getByRole('button', { name: 'Run agent decision' }).click();
    await finished(applicant);
    await card.getByText(kind, { exact: true }).waitFor();
    await screen(applicant, '02-' + kind);
    if (kind === 'admit') {
      await card.getByLabel('Owner completion evidence').fill('Internal wrong-wallet check only; this applicant is not the campaign owner.');
      await card.getByRole('button', { name: 'Owner: mark done', exact: true }).click();
      await applicant.getByRole('alert').getByText('Connect the wallet that owns this address.').waitFor();
      await applicant.setViewportSize({ width: 390, height: 844 });
      await screen(applicant, '03-mobile-campaign');
    }
    await applicant.context().close();
  }
  await owner.getByRole('button', { name: 'Refresh campaign', exact: true }).click();
  await finished(owner);
  const admitted = owner.locator('article').filter({ hasText: 'Internal normal-form admit' });
  await admitted.getByLabel('Owner completion evidence').fill('INTERNAL USABILITY FIXTURE: owner verified the normal-form test note about wrong-payee and replay checks. This is reconstructed test evidence, not an independently completed deliverable.');
  await admitted.getByRole('button', { name: 'Owner: mark done', exact: true }).click();
  await owner.waitForURL('**/runs/**', { timeout: 180000 });
  await finished(owner);
  await owner.getByText('Arc confirmed', { exact: true }).waitFor();
  await screen(owner, '04-receipt');
  await owner.setViewportSize({ width: 390, height: 844 });
  await screen(owner, '05-mobile-receipt');
  const parts = new URL(owner.url()).pathname.split('/');
  const receipt = await owner.evaluate(async ({ id, request }) => (await fetch(`/api?action=receipt&id=${id}&request=${request}`)).json(), { id: parts[2], request: parts[3] });
  if (!receipt.confirmed || !receipt.txHash) throw new Error('Unconfirmed receipt');
  if (errors.length) throw new Error(errors.join('\n'));
  const result = { at: new Date().toISOString(), result: 'PASS', base, campaignURL, receiptURL: owner.url(), walletHarness: 'Injected internal EIP-1193 signer; no API/model/RPC/payment interception', classification: 'internal', independentHeadline: 0, wrongOwnerRejected: true, pageErrors: errors, receipt };
  writeFileSync(`${dir}/verification.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ result: result.result, receipt: result.receiptURL, tx: receipt.txHash, independentHeadline: 0 }));
} finally { await browser.close(); }
