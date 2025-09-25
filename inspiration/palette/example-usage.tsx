import { useState } from "react";

export default function PxUSDShowcase() {
  const [theme, setTheme] = useState("dark"); // "dark" | "light"
  return (
    <div className="min-h-screen" data-theme={theme}>
      {/* Theme variables + gradients */}
      <style>{`
        :root {
          /* Core darker palette */
          --pxusd-cream: #FDF7F2;
          --pxusd-teal-950: #03080C;
          --pxusd-teal-900: #050E16;
          --pxusd-teal-800: #0A1C28;
          --pxusd-teal-700: #102736;
          --pxusd-teal-600: #163343;
          --pxusd-teal-400: #1f5a73;
          --pxusd-orange-500: #FF6A00;
          --pxusd-orange-400: #FF8C42;
          --pxusd-orange-300: #FFB566;
          --pxusd-pink-400: #FF4D6D;
          --pxusd-yellow-400: #FFD93D;
          --pxusd-white: #FFFFFF;

          /* Surfaces & text */
          --bg: var(--pxusd-cream);
          --text: var(--pxusd-white);
          --muted: rgba(240,245,248,0.75);
          --card: var(--pxusd-teal-800);
          --border: rgba(255,255,255,0.1);

          /* Gradients */
          --grad-hero: linear-gradient(180deg, var(--pxusd-teal-950) 0%, var(--pxusd-teal-900) 60%, var(--pxusd-teal-800) 100%);
          --grad-accent: linear-gradient(135deg, var(--pxusd-pink-400) 0%, var(--pxusd-orange-400) 45%, var(--pxusd-yellow-400) 100%);
        }

        [data-theme="dark"] {
          --bg: #03080C;
          --text: #F3F7FA;
          --muted: rgba(240,245,248,0.75);
          --card: #0A1C28;
          --border: rgba(255,255,255,0.12);
        }

        [data-theme="light"] {
          --bg: var(--pxusd-cream);
          --text: var(--pxusd-teal-900);
          --muted: rgba(22,51,67,0.75);
          --card: #E9EEF1;
          --border: rgba(0,0,0,0.08);
        }

        .bg-app { background: var(--bg); color: var(--text); }
        .bg-hero { background: var(--grad-hero); color: #fff; }
        .btn-primary {
          background: var(--grad-accent);
          color: white; border: none; border-radius: 14px;
          padding: .75rem 1.4rem; font-weight: 700; letter-spacing: .3px;
          box-shadow: 0 10px 25px rgba(255,100,0,.35);
          transition: transform .15s ease, filter .25s ease;
        }
        .btn-primary:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .btn-primary:active { transform: translateY(0); }

        .btn-ghost {
          background: transparent; color: var(--text);
          border: 2px solid var(--border); border-radius: 14px; padding: .75rem 1.4rem;
        }
        [data-theme="dark"] .btn-ghost { color: #fff; border-color: rgba(255,255,255,.25); }

        .nav { backdrop-filter: blur(12px) saturate(180%); background: linear-gradient(180deg, rgba(3,8,12,.95), rgba(10,28,40,.85)); border-bottom: 1px solid var(--border); }
        [data-theme="light"] .nav { background: rgba(255,255,255,.75); }

        .card { background: var(--card); color: var(--text); border: 1px solid var(--border); border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,.2); }
      `}</style>

      {/* Top bar */}
      <header className="nav sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ background: "var(--grad-accent)" }} className="w-9 h-9 rounded-full" />
            <span className="font-semibold tracking-wide text-white">pxUSD</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setTheme((t)=> t === "dark" ? "light" : "dark")} className="btn-ghost text-sm">
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </button>
            <button className="btn-primary text-sm">Launch App</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-hero">
        <div className="mx-auto max-w-6xl px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">Stable by design, <span style={{background: 'var(--grad-accent)', WebkitBackgroundClip:'text', color: 'transparent'}}>bold by brand</span>.</h1>
            <p className="mt-4 text-white/85">A bold UI kit with darker hero gradients, flat card backgrounds, and high‑contrast text for clarity.</p>
            <div className="mt-8 flex gap-3">
              <button className="btn-primary">Get Started</button>
              <button className="btn-ghost text-white border-white/30">Docs</button>
            </div>
          </div>
          <div className="card p-6">
            <div className="rounded-2xl overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between text-sm text-white/80">
                  <span>pxUSD Balance</span>
                  <span>•••</span>
                </div>
                <div className="mt-4 text-4xl font-bold">$12,483.20</div>
                <div className="mt-2 text-sm text-white/70">+2.4% today</div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <button className="btn-primary">Deposit</button>
                  <button className="btn-ghost">Withdraw</button>
                  <button className="btn-ghost">Transfer</button>
                </div>
              </div>
              <div className="p-6 bg-app">
                <h3 className="font-semibold" style={{color: 'var(--text)'}}>Recent Activity</h3>
                <ul className="mt-4 space-y-3 text-sm" style={{color: 'var(--muted)'}}>
                  <li className="flex items-center justify-between">
                    <span>Swap • ETH → pxUSD</span>
                    <span className="font-medium" style={{color: 'var(--text)'}}>+$1,000</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Sent to Vault</span>
                    <span className="font-medium" style={{color: 'var(--text)'}}>- $250</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Rewards</span>
                    <span className="font-medium" style={{background: 'var(--grad-accent)', WebkitBackgroundClip:'text', color: 'transparent'}}>+$12.30</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="bg-app py-16">
        <div className="mx-auto max-w-6xl px-6 grid md:grid-cols-3 gap-6">
          {[
            { title: "Fast Settlements", desc: "Near‑instant transfers across chains with predictable fees." },
            { title: "Programmable Money", desc: "Composability‑first design for apps and automations." },
            { title: "Safety by Default", desc: "Audited contracts and risk‑aware mechanisms." },
          ].map((c, i) => (
            <div key={i} className="card p-6">
              <div className="w-12 h-12 rounded-xl" style={{ background: 'var(--grad-accent)' }} />
              <h3 className="mt-4 text-xl font-semibold" style={{color: 'var(--text)'}}>{c.title}</h3>
              <p className="mt-2" style={{color: 'var(--muted)'}}>{c.desc}</p>
              <button className="mt-6 btn-primary">Learn more</button>
            </div>
          ))}
        </div>
      </section>

      {/* Palette & Gradients */}
      <section className="py-12 bg-app">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold" style={{color: 'var(--text)'}}>Color & Gradient Tokens</h2>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-6 gap-4">
            {[{name:'Teal 950',bg:'var(--pxusd-teal-950)',light:false},
              {name:'Teal 900',bg:'var(--pxusd-teal-900)',light:false},
              {name:'Teal 800',bg:'var(--pxusd-teal-800)',light:false},
              {name:'Teal 700',bg:'var(--pxusd-teal-700)',light:false},
              {name:'Orange 500',bg:'var(--pxusd-orange-500)',light:false},
              {name:'Pink 400',bg:'var(--pxusd-pink-400)',light:false},
              {name:'Yellow 400',bg:'var(--pxusd-yellow-400)',light:false},
              {name:'Hero',bg:'var(--grad-hero)',light:false},
              {name:'Accent',bg:'var(--grad-accent)',light:false},
            ].map((c)=> (
              <div key={c.name} className="rounded-xl p-4 border" style={{background: c.bg, borderColor:'var(--border)'}}>
                <div className="text-sm font-medium" style={{color: c.light ? 'var(--pxusd-teal-900)' : '#fff'}}>{c.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-hero">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/85 text-sm">© {new Date().getFullYear()} pxUSD • Brand demo</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setTheme((t)=> t === "dark" ? "light" : "dark")} className="btn-ghost text-sm">Toggle {theme === 'dark' ? 'Light' : 'Dark'}</button>
            <button className="btn-primary">Get pxUSD</button>
          </div>
        </div>
      </footer>
    </div>
  );
}