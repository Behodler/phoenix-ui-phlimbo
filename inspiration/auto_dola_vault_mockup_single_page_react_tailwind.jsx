import React, { useMemo, useState } from "react";

// Single‑page mockup of the AutoDOLA vault screen based on the screenshot.
// Tabs exist (Deposit/Withdraw/Stake/Unstake) but only Deposit is populated.
// TailwindCSS classes are used throughout; no external UI libs required.

export default function App() {
  const tabs = ["Deposit", "Withdraw", "Stake", "Unstake"] as const;
  type Tab = typeof tabs[number];

  const [active, setActive] = useState<Tab>("Deposit");

  // Form state
  const [amount, setAmount] = useState<string>("");
  const [autoStake, setAutoStake] = useState<boolean>(false);
  const [slippageBps, setSlippageBps] = useState<number>(10); // 0.10%

  // Mocked constants from the screenshot
  const dolaToAutoDolaRate = 0.9642; // 1 DOLA -> 0.9642 autoDOLA
  const gasFeeUsd = 0.27;

  const parsedAmount = Number(amount) || 0;
  const estAutoDola = parsedAmount * dolaToAutoDolaRate;
  const minReceived = estAutoDola * (1 - slippageBps / 10000);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
      {/* Top bar */}
      <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-yellow-400" />
            <div>
              <div className="text-sm text-neutral-400 leading-tight">Tokemak</div>
              <div className="text-lg font-semibold">autoDOLA Vault</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800">FAQ</button>
            <button className="rounded-xl bg-neutral-100 text-neutral-900 px-3 py-2 text-sm font-medium hover:opacity-90">Connect</button>
          </div>
        </div>
      </header>

      {/* Page body */}
      <main className="mx-auto max-w-5xl px-4 py-8 grid lg:grid-cols-3 gap-6">
        {/* Left: Main card */}
        <section className="lg:col-span-2">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-0 overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/5">
            {/* Tabs */}
            <div className="flex border-b border-neutral-800">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setActive(t)}
                  className={[
                    "px-5 py-3 text-sm font-medium transition",
                    active === t
                      ? "text-white border-b-2 border-lime-400"
                      : "text-neutral-400 hover:text-neutral-200",
                  ].join(" ")}
                >
                  {t}
                </button>
              ))}
              <div className="ml-auto px-4 py-3 text-sm text-neutral-400">You're depositing</div>
            </div>

            {/* Tab content */}
            {active === "Deposit" ? (
              <div className="p-6">
                {/* Amount Display */}
                <div className="mb-6">
                  <div className="text-6xl font-light tracking-tight">{parsedAmount.toFixed(2)}</div>
                  <div className="text-neutral-400">${parsedAmount.toFixed(2)}</div>
                </div>

                <div className="h-px w-full bg-neutral-800 mb-6" />

                {/* Token Row */}
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-400 to-purple-600" />
                    <div>
                      <div className="text-base font-semibold">DOLA</div>
                      <div className="text-sm text-neutral-400">Balance 0.00 ($0.00)</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400">MAX</span>
                    <button className="rounded-lg border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800">0%</button>
                  </div>
                </div>

                {/* Amount input */}
                <div className="flex gap-3 mb-5">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="ENTER AN AMOUNT"
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-lime-400/30"
                  />
                  <button className="rounded-xl bg-neutral-800 px-4 py-3 text-sm text-neutral-200 hover:bg-neutral-700">MAX</button>
                </div>

                {/* Auto-stake */}
                <div className="mb-5 flex items-center justify-between">
                  <div className="text-sm text-neutral-300 flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-700 text-[10px]">i</span>
                    Auto‑stake
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={autoStake}
                      onChange={(e) => setAutoStake(e.target.checked)}
                    />
                    <div className="w-12 h-6 bg-neutral-700 rounded-full peer peer-checked:bg-lime-400 transition" />
                    <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-6" />
                  </label>
                </div>

                {/* Rate & Fees */}
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">1 DOLA</span>
                    <span className="font-medium">≈ {dolaToAutoDolaRate} autoDOLA</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Gas est.</span>
                    <span>${gasFeeUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Max Slippage</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-right"
                        value={(slippageBps / 100).toFixed(2)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (!isNaN(val)) setSlippageBps(Math.max(0, Math.round(val * 100)));
                        }}
                      />
                      <span>%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Receive at least</span>
                    <span className="font-medium">{minReceived > 0 ? minReceived.toFixed(6) : "-"} autoDOLA</span>
                  </div>
                </div>

                {/* Action button */}
                <div className="mt-6">
                  <button
                    disabled={!parsedAmount}
                    className="w-full rounded-xl bg-lime-400 px-4 py-3 font-semibold text-neutral-900 disabled:opacity-40"
                  >
                    Deposit
                  </button>
                  <div className="mt-3 text-xs text-neutral-500">Withdraw and unstake at any time • 0% Deposit Fee</div>
                </div>
              </div>
            ) : (
              <div className="p-10 text-center text-sm text-neutral-400">
                <div className="text-lg mb-2 font-semibold text-neutral-200">{active}</div>
                <p>Template placeholder. Add your content for the <span className="font-medium">{active}</span> tab here.</p>
              </div>
            )}
          </div>
        </section>

        {/* Right: Position card */}
        <aside className="lg:col-span-1">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 ring-1 ring-white/5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Your Position</h2>
              <button className="text-lime-400 text-sm hover:underline">View Portfolio</button>
            </div>

            <div className="space-y-4">
              <div className="text-xs uppercase tracking-wide text-neutral-400">Position</div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-lime-400" />
                <div className="font-medium">autoDOLA</div>
                <span className="ml-auto rounded-full bg-lime-400/10 px-2 py-0.5 text-[11px] text-lime-300">Staked</span>
              </div>

              <div className="h-px w-full bg-neutral-800" />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-neutral-400">Value</div>
                <div className="text-right">
                  <div className="font-semibold">50.1043 DOLA</div>
                  <div className="text-neutral-400">$49.88</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <button className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800">Claim</button>
                <button className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800">Unstake</button>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-neutral-500">
        <div className="border-t border-neutral-800 pt-6">This is a static mockup for development. Replace wired values with live data and handlers.</div>
      </footer>
    </div>
  );
}
