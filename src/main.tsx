import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createWalletClient,
  custom,
  encodeAbiParameters,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import {
  campaignSchema,
  applicationSchema,
  textHash,
  type CampaignTerms,
} from "./lib/domain";
import "./styles.css";

const api = async (action: string, data?: unknown, params = "") => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api?action=" + action + params, {
        method: data ? "POST" : "GET",
        headers: data ? { "Content-Type": "application/json" } : undefined,
        body: data ? JSON.stringify(data) : undefined,
      });
      if ([502, 503, 504].includes(res.status)) {
        if (attempt === 2)
          throw new Error(
            "The service is temporarily unavailable. Refresh to recover any confirmed action.",
          );
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (attempt + 1)),
        );
        continue;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed.");
      return json;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      if (attempt === 2)
        throw new Error(
          "Network interrupted the request. Refresh the campaign; confirmed actions remain recorded.",
        );
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
};
const short = (s: string) => (s ? `${s.slice(0, 8)}…${s.slice(-6)}` : "—");
const explorer = (hash: string) => "https://testnet.arcscan.app/tx/" + hash;
function demoAccount(name: string) {
  let key = sessionStorage.getItem("panelpay-" + name) as Hex | null;
  if (!key) {
    key = generatePrivateKey();
    sessionStorage.setItem("panelpay-" + name, key);
  }
  return privateKeyToAccount(key);
}
async function connected() {
  const provider = (window as any).ethereum;
  if (!provider)
    throw new Error(
      "A browser wallet is needed for a real campaign. The internal reviewer path works without one.",
    );
  const addresses = await provider.request({ method: "eth_requestAccounts" });
  return {
    address: addresses[0] as Address,
    client: createWalletClient({
      chain: arcTestnet,
      transport: custom(provider),
    }),
  };
}
async function sign(message: string | { raw: Hex }, address: string) {
  for (const name of ["owner", "fit", "skip"]) {
    const stored = sessionStorage.getItem("panelpay-" + name);
    if (stored) {
      const account = privateKeyToAccount(stored as Hex);
      if (account.address.toLowerCase() === address.toLowerCase())
        return account.signMessage({ message });
    }
  }
  const w = await connected();
  if (w.address.toLowerCase() !== address.toLowerCase())
    throw new Error("Connect the wallet that owns this address.");
  return w.client.signMessage({ account: w.address, message });
}
function App() {
  const [path, setPath] = useState(location.pathname);
  const [config, setConfig] = useState<any>();
  const [campaign, setCampaign] = useState<any>();
  const [receipt, setReceipt] = useState<any>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");
  const [showOpen, setShowOpen] = useState(false);
  const navigate = (url: string) => {
    history.pushState({}, "", url);
    setPath(url);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0 });
  };
  const id = Number(path.split("/")[2]);
  const receiptId = path.startsWith("/runs/") ? path.split("/")[3] : null;
  useEffect(() => {
    const listener = () => setPath(location.pathname);
    window.addEventListener("popstate", listener);
    api("config")
      .then(setConfig)
      .catch((e) => setError(e.message));
    return () => window.removeEventListener("popstate", listener);
  }, []);
  const refresh = async () => {
    if (!id) return;
    const c = await api("campaign", undefined, "&id=" + id);
    setCampaign(c);
    if (receiptId)
      setReceipt(
        await api("receipt", undefined, "&id=" + id + "&request=" + receiptId),
      );
  };
  useEffect(() => {
    setCampaign(undefined);
    setReceipt(undefined);
    if (id) {
      setPending("Reading campaign evidence…");
      refresh()
        .catch((e) => setError(e.message))
        .finally(() => setPending(""));
    }
  }, [path]);
  const run = async (label: string, fn: () => Promise<void>) => {
    setPending(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending("");
    }
  };
  const openDemo = () =>
    run("Locking internal reviewer campaign on Arc…", async () => {
      const owner = demoAccount("owner");
      const terms = campaignSchema.parse({
        title: "Internal reviewer fixture: inspect a payout rail",
        ownerHandle: "Rouma / internal reviewer fixture",
        owner: owner.address,
        brief:
          "INTERNAL DEMO, not an independent team campaign. Request a concrete review of an Arc testnet payout flow: identify one authorization risk and write a short, reproducible verification note.",
        eligibility:
          "Applicants must demonstrate experience reviewing EVM smart contracts and testnet transaction receipts. A specific example of an authorization or replay check is required.",
        completion:
          "Owner reviews a written verification note with one authorization check and one receipt check. Reviewer fixture evidence is internal and never headline traction.",
        amount: "0.01",
        cap: "0.02",
        deadline: Math.floor(Date.now() / 1000) + 7 * 86400,
        classification: "internal",
        publicConsent: true,
        salt: crypto.randomUUID(),
      });
      const signature = await owner.signMessage({
        message: "PanelPay open campaign\n" + JSON.stringify(terms),
      });
      const result = await api("open", { terms, signature });
      navigate("/campaigns/" + result.id);
    });
  const addFixtures = () =>
    run("Locking two internal applicant fixtures…", async () => {
      for (const type of ["skip", "fit"]) {
        const account = demoAccount(type);
        const terms = applicationSchema.parse({
          handle:
            type === "skip"
              ? "Internal fixture · unrelated applicant"
              : "Internal fixture · contract reviewer",
          payee: account.address,
          fit:
            type === "skip"
              ? "I only design restaurant menus and illustrations. I have never reviewed EVM contracts or testnet receipts and cannot provide the requested authorization checks."
              : "I review EVM contract authorization and replay protection. I can test a wrong-payee settlement using an expectRevert assertion and verify the recipient and amount in the Arc transaction log.",
          evidence:
            type === "skip"
              ? "Internal mismatch fixture; no contract-review evidence."
              : "Internal matching fixture: reproducible wrong-payee and duplicate-request checks described above. These are test inputs, not a real applicant or completed work.",
          publicConsent: true,
          classification: "internal",
          salt: "reviewer-fixture-" + type,
        });
        const signature = await account.signMessage({
          message: "PanelPay apply\n" + id + "\n" + JSON.stringify(terms),
        });
        await api("apply", { id, terms, signature });
      }
      await refresh();
      setNotice(
        "Two internal fixtures locked. Run the agent on each; then confirm the admitted fixture.",
      );
    });
  const decide = (requestId: string) =>
    run(
      "Agent is weighing evidence against the remaining budget…",
      async () => {
        await api("decide", { id, requestId });
        await refresh();
      },
    );
  const complete = (a: any, done: boolean, proof: string) =>
    run("Signing owner confirmation and recording it on Arc…", async () => {
      const { nonce } = await api("nonce", undefined, "&id=" + id);
      const hash = textHash(proof.trim());
      const digest = keccak256(
        encodeAbiParameters(
          [
            { type: "address" },
            { type: "uint256" },
            { type: "uint256" },
            { type: "bytes32" },
            { type: "bool" },
            { type: "bytes32" },
            { type: "uint256" },
          ],
          [
            config.contract,
            BigInt(5042002),
            BigInt(id),
            a.requestId,
            done,
            hash,
            BigInt(nonce),
          ],
        ),
      );
      const signature = await sign({ raw: digest }, campaign.state.owner);
      await api("complete", {
        id,
        requestId: a.requestId,
        done,
        proof: proof.trim(),
        nonce,
        signature,
      });
      if (done) {
        setPending("Owner confirmed. Settling the fixed test-USDC amount…");
        try {
          await api("settle", { id, requestId: a.requestId });
          navigate("/runs/" + id + "/" + a.requestId);
        } catch (error) {
          await refresh();
          throw error;
        }
      } else {
        await refresh();
        setNotice("Owner marked not done. Payment remains blocked.");
      }
    });
  const settle = (a: any) =>
    run("Settling the fixed test-USDC amount on Arc…", async () => {
      await api("settle", { id, requestId: a.requestId });
      navigate("/runs/" + id + "/" + a.requestId);
    });
  const internal = campaign?.terms.classification === "internal";
  return (
    <>
      <header className="header shell">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <span className="brand-symbol" aria-hidden="true">
            p<span>↗</span>
          </span>
          panelpay
        </a>
        <div className="header-right">
          <span className="network">
            <i />
            Arc testnet
          </span>
          <a
            href="https://github.com/dmetagame/panelpay"
            target="_blank"
            rel="noreferrer"
          >
            Source ↗
          </a>
        </div>
      </header>
      <main className="shell">
        {path === "/" ? (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">A brief becomes a bounded commitment</p>
                <h1>
                  Pay for the
                  <br />
                  right contribution<span>.</span>
                </h1>
                <p className="hero-copy">
                  Your team sets the brief and budget. An agent admits, skips,
                  or waits. You confirm the work. Arc pays the locked recipient.
                </p>
                <div className="actions">
                  <button
                    className="primary"
                    onClick={() => {
                      setShowOpen(true);
                      setTimeout(
                        () =>
                          document
                            .getElementById("open-campaign")
                            ?.scrollIntoView({ behavior: "smooth" }),
                        50,
                      );
                    }}
                  >
                    Open a campaign <span>↗</span>
                  </button>
                  <button
                    className="secondary"
                    disabled={!!pending || !config?.ready}
                    onClick={openDemo}
                  >
                    Try the internal demo
                  </button>
                </div>
                <p className="fine">
                  test USDC, no cash value · No faucet on the reviewer path
                </p>
              </div>
              <div className="hero-rail">
                <div className="rail-label">THE PAYMENT BOUNDARY</div>
                <div className="rail-node">
                  <span className="node-dot" />
                  <div>
                    <small>Team owner</small>
                    <strong>Brief + fixed amount + cap</strong>
                  </div>
                </div>
                <div className="rail-node">
                  <span className="node-dot orange" />
                  <div>
                    <small>Agent judgment</small>
                    <strong>
                      Admit <span className="faded">/ skip / wait</span>
                    </strong>
                    <p>
                      Evidence determines who is worth the remaining budget.
                    </p>
                  </div>
                </div>
                <div className="rail-node">
                  <span className="node-dot" />
                  <div>
                    <small>Owner confirmation</small>
                    <strong>Done, with proof</strong>
                  </div>
                </div>
                <div className="rail-node paid">
                  <span className="node-dot" />
                  <div>
                    <small>Bounded Arc executor</small>
                    <strong>Locked payee. Exact amount.</strong>
                    <p>The model never signs.</p>
                  </div>
                </div>
              </div>
            </section>
            <section className="principle">
              <p>
                Decisions are public.
                <br />
                <strong>Funds are constrained.</strong>
              </p>
              <div>
                <span>Wrong payee</span>
                <span>Over cap</span>
                <span>Replay</span>
                <span>Skip as pay</span>
                <small>All revert at the contract boundary.</small>
              </div>
            </section>
            {showOpen && (
              <OpenForm
                pending={pending}
                submit={(terms) =>
                  run("Signing and opening the campaign on Arc…", async () => {
                    const signature = await sign(
                      "PanelPay open campaign\n" + JSON.stringify(terms),
                      terms.owner,
                    );
                    const r = await api("open", { terms, signature });
                    navigate("/campaigns/" + r.id);
                  })
                }
              />
            )}
            <section className="honesty">
              <span className="eyebrow">Evidence before claims</span>
              <h2>A test payment is a test payment.</h2>
              <p>
                Internal fixtures, Rouma, Latchline, and friends are labeled as
                internal. Independent activity requires verified counterparties
                and confirmed deliverables. Skips show agency; they are never
                payment volume.
              </p>
              <a
                href="https://github.com/dmetagame/panelpay/blob/main/TRACTION.md"
                target="_blank"
                rel="noreferrer"
              >
                Read the traction ledger ↗
              </a>
            </section>
          </>
        ) : campaign ? (
          <>
            <div className="breadcrumb">
              <button className="link-button" onClick={() => navigate("/")}>
                ← Campaign rail
              </button>
              <span>Campaign {id.toString().padStart(3, "0")}</span>
            </div>
            <section className="campaign-head">
              <div>
                <p className="eyebrow">
                  {receiptId
                    ? "Public settlement receipt"
                    : "Locked campaign terms"}
                </p>
                <h1>{campaign.terms.title}</h1>
                <p className="owner">
                  {campaign.terms.ownerHandle}{" "}
                  <span className={"badge " + campaign.terms.classification}>
                    {campaign.terms.classification}
                  </span>
                </p>
              </div>
              <div className="budget">
                <small>FIXED INCENTIVE</small>
                <strong>
                  {campaign.terms.amount} <span>test USDC</span>
                </strong>
                <div className="budget-track">
                  <span
                    style={{
                      width:
                        Math.min(
                          100,
                          (Number(campaign.state.spent) /
                            Number(campaign.state.cap)) *
                            100,
                        ) + "%",
                    }}
                  />
                </div>
                <p>
                  {campaign.remaining} remaining / {campaign.terms.cap} cap
                </p>
                <small>test USDC, no cash value</small>
              </div>
            </section>
            {receiptId ? (
              receipt ? (
                <Receipt
                  data={receipt}
                  back={() => navigate("/campaigns/" + id)}
                />
              ) : (
                <p className="loading">Reading the confirmed receipt…</p>
              )
            ) : (
              <>
                <section className="terms">
                  <div>
                    <h2>The brief</h2>
                    <p>{campaign.terms.brief}</p>
                  </div>
                  <div>
                    <h3>Who should apply</h3>
                    <p>{campaign.terms.eligibility}</p>
                    <h3>What completion means</h3>
                    <p>{campaign.terms.completion}</p>
                  </div>
                  <div className="terms-meta">
                    <span>
                      Closes{" "}
                      {new Date(
                        Number(campaign.state.deadline) * 1000,
                      ).toLocaleDateString()}
                    </span>
                    <span>Owner {short(campaign.state.owner)}</span>
                    <span>{campaign.available} unreserved test USDC</span>
                    <a
                      href={
                        "https://testnet.arcscan.app/address/" +
                        config?.contract
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Contract ↗
                    </a>
                  </div>
                </section>
                {internal && (
                  <div className="fixture-note">
                    <div>
                      <strong>Internal reviewer campaign</strong>
                      <p>
                        These inputs demonstrate the rail. They are excluded
                        from independent traction.
                      </p>
                    </div>
                    {campaign.applications.length < 2 && (
                      <button
                        className="secondary"
                        disabled={!!pending}
                        onClick={addFixtures}
                      >
                        Add two internal fixtures
                      </button>
                    )}
                  </div>
                )}
                <section className="contributions">
                  <div className="section-heading">
                    <h2>Contribution decisions</h2>
                    <span>
                      {campaign.applications.length} locked applications
                    </span>
                  </div>
                  {!campaign.applications.length ? (
                    <p className="empty">
                      No applications yet. Share this campaign URL with
                      applicants.
                    </p>
                  ) : (
                    campaign.applications.map((a: any) => (
                      <Contribution
                        key={a.requestId}
                        a={a}
                        pending={pending}
                        amount={campaign.terms.amount}
                        decide={() => decide(a.requestId)}
                        complete={(done: boolean, proof: string) =>
                          complete(a, done, proof)
                        }
                        settle={() => settle(a)}
                        receipt={() =>
                          navigate("/runs/" + id + "/" + a.requestId)
                        }
                        internal={internal}
                      />
                    ))
                  )}
                </section>
                {!internal && (
                  <ApplyForm
                    pending={pending}
                    submit={(terms: any) =>
                      run(
                        "Signing and locking the application on Arc…",
                        async () => {
                          const signature = await sign(
                            "PanelPay apply\n" +
                              id +
                              "\n" +
                              JSON.stringify(terms),
                            terms.payee,
                          );
                          await api("apply", { id, terms, signature });
                          await refresh();
                          setNotice(
                            "Address and application locked. The agent can now evaluate the evidence.",
                          );
                        },
                      )
                    }
                  />
                )}
              </>
            )}
          </>
        ) : id && !error ? (
          <p className="loading">Reading locked campaign terms…</p>
        ) : null}
        {pending && (
          <div className="status" role="status">
            <span className="spinner" />
            {pending}
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            <strong>Request stopped</strong>
            <p>{error}</p>
            <button className="link-button" onClick={() => setError("")}>
              Dismiss
            </button>
            {!!id && (
              <button
                className="link-button"
                onClick={() =>
                  run("Refreshing confirmed campaign state…", refresh)
                }
              >
                Refresh campaign
              </button>
            )}
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
      </main>
      <footer className="shell">
        <span>One brief. One bounded budget.</span>
        <span>test USDC, no cash value</span>
        <a
          href="https://github.com/dmetagame/panelpay"
          target="_blank"
          rel="noreferrer"
        >
          Public source ↗
        </a>
      </footer>
    </>
  );
}
function Field({
  label,
  name,
  help,
  textarea = false,
  defaultValue = "",
  ...props
}: any) {
  return (
    <label className="field">
      <span>{label}</span>
      {textarea ? (
        <textarea name={name} defaultValue={defaultValue} required {...props} />
      ) : (
        <input name={name} defaultValue={defaultValue} required {...props} />
      )}{" "}
      {help && <small>{help}</small>}
    </label>
  );
}
function OpenForm({
  pending,
  submit,
}: {
  pending: string;
  submit: (terms: CampaignTerms) => void;
}) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  return (
    <section id="open-campaign" className="form-sheet">
      <p className="eyebrow">Open a campaign</p>
      <h2>Write the terms before the agent runs.</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const f = new FormData(e.currentTarget);
            submit(
              campaignSchema.parse({
                title: f.get("title"),
                ownerHandle: f.get("handle"),
                owner: address,
                brief: f.get("brief"),
                eligibility: f.get("eligibility"),
                completion: f.get("completion"),
                amount: f.get("amount"),
                cap: f.get("cap"),
                deadline:
                  Math.floor(
                    new Date(f.get("deadline") as string).getTime() / 1000,
                  ) + 86399,
                classification: f.get("internal") ? "internal" : "unverified",
                publicConsent: f.get("consent") === "on",
                salt: crypto.randomUUID(),
              }),
            );
          } catch (err) {
            setError(
              "Check all fields, the connected owner wallet, cap, and receipt consent.",
            );
          }
        }}
      >
        <div className="field-grid">
          <Field
            label="Campaign title"
            name="title"
            minLength={5}
            maxLength={100}
          />
          <Field
            label="Team / owner handle"
            name="handle"
            minLength={2}
            maxLength={80}
          />
        </div>
        <Field
          label="The brief"
          name="brief"
          textarea
          minLength={30}
          maxLength={2500}
          help="A question or contribution your team already needs. This text will be public."
        />
        <Field
          label="Eligibility and selection criteria"
          name="eligibility"
          textarea
          minLength={15}
          maxLength={1200}
        />
        <Field
          label="Required completion proof"
          name="completion"
          textarea
          minLength={15}
          maxLength={1200}
          help="Define the deliverable and evidence you will review before marking done."
        />
        <div className="field-grid triple">
          <Field
            label="Fixed amount · test USDC"
            name="amount"
            type="number"
            step="0.000001"
            min="0.000001"
            max="0.1"
            defaultValue="0.01"
          />
          <Field
            label="Campaign cap · test USDC"
            name="cap"
            type="number"
            step="0.000001"
            min="0.000001"
            max="0.1"
            defaultValue="0.05"
          />
          <Field
            label="Completion deadline"
            name="deadline"
            type="date"
            defaultValue={new Date(Date.now() + 7 * 86400000)
              .toISOString()
              .slice(0, 10)}
          />
        </div>
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            try {
              setAddress((await connected()).address);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {address ? "Owner " + short(address) : "Connect owner wallet"}
        </button>
        <small className="helper">
          Signature only. No gas or faucet needed.
        </small>
        <label className="checkbox">
          <input type="checkbox" name="internal" />
          This is Rouma, Latchline, a friend, or internal dogfood.
        </label>
        <label className="checkbox">
          <input type="checkbox" name="consent" required />I permit public
          terms, anonymized evidence, and payment receipts. I understand this is
          test USDC, no cash value.
        </label>
        {error && <p className="inline-error">{error}</p>}
        <button className="primary" disabled={!!pending || !address}>
          Sign terms & open campaign ↗
        </button>
      </form>
    </section>
  );
}
function ApplyForm({ pending, submit }: any) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="form-sheet">
      <p className="eyebrow">Apply to this campaign</p>
      <h2>Show why your contribution fits.</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          try {
            const f = new FormData(e.currentTarget);
            submit(
              applicationSchema.parse({
                handle: f.get("handle"),
                payee: address,
                fit: f.get("fit"),
                evidence: f.get("evidence"),
                publicConsent: f.get("consent") === "on",
                classification: f.get("internal") ? "internal" : "unverified",
                salt: crypto.randomUUID(),
              }),
            );
          } catch {
            setError(
              "Check the connected payee wallet, evidence, and consent.",
            );
          }
        }}
      >
        <Field label="Your handle" name="handle" />
        <Field
          label="Why you fit the brief"
          name="fit"
          textarea
          minLength={20}
          maxLength={2000}
        />
        <Field
          label="Evidence or example"
          name="evidence"
          textarea
          minLength={8}
          maxLength={1000}
        />
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            try {
              setAddress((await connected()).address);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {address
            ? "Payee " + short(address)
            : "Connect your receiving wallet"}
        </button>
        <small className="helper">
          Sign to prove control. Applying does not mean selection or payment.
        </small>
        <label className="checkbox">
          <input type="checkbox" name="internal" />I am a friend or internal
          participant.
        </label>
        <label className="checkbox">
          <input type="checkbox" name="consent" required />
          My address is mine, and my evidence and receipt may be public. Test
          USDC has no cash value.
        </label>
        {error && <p className="inline-error">{error}</p>}
        <button className="primary" disabled={!!pending || !address}>
          Sign & lock application ↗
        </button>
      </form>
    </section>
  );
}
function Contribution({
  a,
  pending,
  amount,
  decide,
  complete,
  settle,
  receipt,
  internal,
}: any) {
  const [proof, setProof] = useState(
    internal
      ? "INTERNAL REVIEWER FIXTURE: owner reviewed the fixture note describing wrong-payee and replay checks. This is demo evidence, not independent completed work."
      : "",
  );
  const label = ["pending", "admit", "skip", "wait"][a.decision];
  return (
    <article className={"contribution " + label}>
      <div className="contribution-heading">
        <div>
          <span className={"decision " + label}>{a.paid ? "paid" : label}</span>
          <h3>{a.metadata.handle}</h3>
        </div>
        <span className={"badge " + a.metadata.classification}>
          {a.metadata.classification}
        </span>
      </div>
      <p>{a.metadata.fit}</p>
      <details>
        <summary>Application evidence & locked address</summary>
        <p>{a.metadata.evidence}</p>
        <code>{a.payee}</code>
        <p className="fine">Request {short(a.requestId)}</p>
      </details>
      {a.proposal && (
        <div className="judgment">
          <span className="eyebrow">Agent judgment</span>
          <p>{a.proposal.reason}</p>
          <small>
            {a.proposal.model} · {new Date(a.proposal.at).toLocaleString()}
          </small>
        </div>
      )}
      {(a.decision === 0 || a.decision === 3) && (
        <button className="secondary" disabled={!!pending} onClick={decide}>
          {a.decision === 3 ? "Reassess evidence" : "Run agent decision"} ↗
        </button>
      )}
      {a.decision === 2 && (
        <p className="saved">
          No payment path. The fixed {amount} test USDC stays in the campaign.
        </p>
      )}
      {a.decision === 1 && !a.paid && a.completion === 0 && (
        <div className="completion-form">
          <label className="field">
            <span>Owner completion evidence</span>
            <textarea
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              placeholder="Link or describe the deliverable you reviewed."
              minLength={10}
            />
          </label>
          <div className="actions">
            <button
              className="primary"
              disabled={!!pending || proof.trim().length < 10}
              onClick={() => complete(true, proof)}
            >
              Owner: mark done
            </button>
            <button
              className="secondary"
              disabled={!!pending || proof.trim().length < 10}
              onClick={() => complete(false, proof)}
            >
              Owner: not done
            </button>
          </div>
          <small className="helper">
            The campaign owner signs this decision. The model cannot confirm
            completion.
          </small>
        </div>
      )}
      {a.completion === 2 && (
        <p className="saved">Owner marked not done. Payment blocked.</p>
      )}
      {a.completion === 1 && !a.paid && (
        <div className="ready">
          <p>Owner confirmed completion. Payee and amount remain locked.</p>
          <button className="primary" disabled={!!pending} onClick={settle}>
            Pay {amount} test USDC ↗
          </button>
        </div>
      )}
      {a.paid && (
        <button className="primary" onClick={receipt}>
          View confirmed receipt ↗
        </button>
      )}
    </article>
  );
}
function Receipt({ data, back }: any) {
  const a = data.application;
  return (
    <section className="receipt">
      <div className="receipt-header">
        <span className={"decision " + (data.confirmed ? "admit" : "wait")}>
          {data.confirmed ? "Arc confirmed" : "Not paid"}
        </span>
        <span className={"badge " + a.metadata.classification}>
          {a.metadata.classification}
        </span>
      </div>
      <h2>
        {data.confirmed
          ? data.campaign.terms.amount + " test USDC"
          : "No confirmed payment"}
      </h2>
      <p>test USDC, no cash value</p>
      <dl>
        <div>
          <dt>Recipient</dt>
          <dd>
            {a.metadata.handle}
            <code>{a.payee}</code>
          </dd>
        </div>
        <div>
          <dt>Agent decision</dt>
          <dd>
            {a.proposal?.decision || "pending"} —{" "}
            {a.proposal?.reason || "No decision recorded"}
          </dd>
        </div>
        <div>
          <dt>Owner confirmation</dt>
          <dd>
            {a.completion === 1 ? "Done" : "Not done / unreviewed"}
            <p>{a.proof || "No completion evidence"}</p>
          </dd>
        </div>
        <div>
          <dt>Unique request</dt>
          <dd>
            <code>{a.requestId}</code>
          </dd>
        </div>
        <div>
          <dt>Evidence hash</dt>
          <dd>
            <code>{a.evidenceHash}</code>
          </dd>
        </div>
        <div>
          <dt>Arc transaction</dt>
          <dd>
            {data.txHash ? (
              <a href={explorer(data.txHash)} target="_blank" rel="noreferrer">
                <code>{data.txHash}</code>Inspect transaction ↗
              </a>
            ) : (
              "No transaction recorded"
            )}
          </dd>
        </div>
        <div>
          <dt>Headline eligibility</dt>
          <dd>
            {data.campaign.terms.classification === "independent" &&
            a.metadata.classification === "independent" &&
            data.confirmed
              ? "Verified independent completed payment"
              : "Excluded: internal or unverified counterparties. This receipt demonstrates the rail only."}
          </dd>
        </div>
      </dl>
      <button className="secondary" onClick={back}>
        ← Return to campaign
      </button>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
