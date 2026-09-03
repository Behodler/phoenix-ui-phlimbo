import { useEffect, useRef, useState } from 'react';
import AntimatterAccordionRow from './AntimatterAccordionRow';
import LiveYieldCounter from '../staking/LiveYieldCounter';
import { fmtAPY, fmtAmount } from '../stake/formatStake';
import { useToast } from '../../ui/ToastProvider';
import {
  ANTIMATTER_ACCENT,
  ANTIMATTER_LEGACY_POOL,
  ANTIMATTER_MOCK_POOLS,
  ANTIMATTER_MOCK_WALLET,
  ANTIMATTER_SYMBOL,
  antimatterPending,
  antimatterRate,
  antimatterRebase,
} from '../../../data/antimatterMockData';
import type {
  AntimatterMockPool,
  AntimatterMockWallet,
  AntimatterSubTab,
} from '../../../data/antimatterMockData';
import antimatterIcon from '../../../assets/antimatter.png';
import phUSDIcon from '../../../assets/phUSD-nobackground.png';
import usdcIcon from '../../../assets/usdc-logo.svg';
import usdeIcon from '../../../assets/USDe.png';
import dolaIcon from '../../../assets/sDOLA.png';

/**
 * **"Stake (mock)" tab — a deliberately fake design preview.**
 *
 * This surface is a non-contract mock of the Antimatter overhaul of
 * `stable-staker`, admin-gated in VaultPage so it can be contrasted with the
 * live `Stake` tab in the same app. Nothing here touches a contract, wagmi or a
 * hook: every figure is a literal from `src/data/antimatterMockData.ts`
 * advanced by a timer, and it must never be wired up.
 *
 * What it depicts: stable pools accrue **Antimatter** rather than phUSD, and
 * Antimatter is never claimed — it is annihilated against the user's own staked
 * principal, each unit destroying one unit of the staked stablecoin and paying
 * out phUSD equal to the sum of both sides. The legacy phUSD → USDC pool stays
 * greyed out at the top as the contrast anchor.
 *
 * Story 079 delivered the shell — the collapsed rows and their live accrual;
 * story 080 fills in the expanded stake / withdraw / annihilate panel.
 *
 * All state lives in the single `useState` below and the rows are a `.map()`,
 * so the Rules of Hooks stay trivially satisfied however many pools exist.
 */

const ICONS: Record<string, string> = {
  usdc: usdcIcon,
  usde: usdeIcon,
  dola: dolaIcon,
};

interface AntimatterMockState {
  wallet: AntimatterMockWallet;
  pools: AntimatterMockPool[];
  expandedId: string | null;
}

export default function AntimatterStakeMockTab() {
  const [state, setState] = useState<AntimatterMockState>(() => ({
    wallet: { ...ANTIMATTER_MOCK_WALLET },
    pools: ANTIMATTER_MOCK_POOLS.map((p) => ({ ...p })),
    expandedId: 'usdc',
  }));

  // Time origin for every pool whose `t0` is still 0. Fixed on first render so
  // the accrual baselines in the data module are read as "as of tab open".
  const originRef = useRef<number>(Date.now());
  const [, setTick] = useState(0);

  // The accordion figures are RAF-driven by LiveYieldCounter; this slow tick
  // only refreshes the derived summary figures at the top of the panel.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 90);
    return () => clearInterval(id);
  }, []);

  const { addToast } = useToast();

  const toggle = (id: string) =>
    setState((s) => ({ ...s, expandedId: s.expandedId === id ? null : id }));

  /** Replace one pool in place, leaving the wallet untouched. */
  const updatePool = (id: string, fn: (pool: AntimatterMockPool) => AntimatterMockPool) =>
    setState((s) => ({ ...s, pools: s.pools.map((p) => (p.id === id ? fn(p) : p)) }));

  const setTab = (id: string, tab: AntimatterSubTab) => updatePool(id, (p) => ({ ...p, tab }));

  // Every transition that moves `staked` goes through `antimatterRebase`, which
  // freezes the accrued figure into `amBase` and restarts the clock. Changing
  // the stake without rebasing bends the accrual curve retroactively and the
  // displayed counter jumps.
  const doStake = (id: string) =>
    setState((s) => {
      const pool = s.pools.find((p) => p.id === id);
      if (!pool) return s;
      const amt = parseFloat(pool.stakeAmt) || 0;
      const balance = s.wallet[pool.walletKey];
      if (amt <= 0 || amt > balance) return s;
      const next = antimatterRebase(pool, originRef.current, {
        staked: pool.staked + amt,
        stakeAmt: '',
      });
      return {
        ...s,
        wallet: { ...s.wallet, [pool.walletKey]: balance - amt },
        pools: s.pools.map((p) => (p.id === id ? next : p)),
      };
    });

  const doWithdraw = (id: string) =>
    setState((s) => {
      const pool = s.pools.find((p) => p.id === id);
      if (!pool) return s;
      const amt = parseFloat(pool.wdAmt) || 0;
      if (amt <= 0 || amt > pool.staked) return s;
      const next = antimatterRebase(pool, originRef.current, {
        staked: pool.staked - amt,
        wdAmt: '',
      });
      return {
        ...s,
        wallet: { ...s.wallet, [pool.walletKey]: s.wallet[pool.walletKey] + amt },
        pools: s.pools.map((p) => (p.id === id ? next : p)),
      };
    });

  /**
   * Annihilate: match accrued Antimatter one-for-one against the user's own
   * staked principal, destroy both sides, and pay out phUSD equal to their
   * sum. Accrual beyond the staked balance cannot be matched, so the surplus
   * is paid to the wallet as an ordinary claim.
   */
  const doAnnihilate = (id: string) => {
    const pool = state.pools.find((p) => p.id === id);
    if (!pool) return;
    const am = antimatterPending(pool, originRef.current, Date.now());
    const matched = Math.min(am, pool.staked);
    if (matched <= 0) return;
    const leftover = am - matched;

    // Not `antimatterRebase`: the pending figure is consumed here, not carried
    // forward, so the baseline resets to zero rather than to `am`.
    const next: AntimatterMockPool = {
      ...pool,
      staked: pool.staked - matched,
      amBase: 0,
      t0: Date.now(),
    };

    setState((s) => ({
      ...s,
      wallet: {
        ...s.wallet,
        phusd: s.wallet.phusd + matched * 2,
        am: s.wallet.am + leftover,
      },
      pools: s.pools.map((p) => (p.id === id ? next : p)),
    }));

    let description =
      `${fmtAmount(matched, 6)} ${ANTIMATTER_SYMBOL} annihilated with ${fmtAmount(matched, 6)} ` +
      `${pool.symbol} from your stake. ${fmtAmount(matched * 2, 6)} phUSD sent to your wallet.`;
    // The epsilon, not `> 0`: accrual makes exact equality unreachable and a
    // bare comparison announces a phantom surplus of a few wei-equivalents.
    if (leftover > 1e-9) {
      description += ` Surplus ${fmtAmount(leftover, 6)} ${ANTIMATTER_SYMBOL} paid out to your wallet.`;
    }

    addToast({ type: 'success', title: 'Annihilation confirmed', description, duration: 6000 });
  };

  const origin = originRef.current;
  const now = Date.now();
  const totalPending = state.pools.reduce((sum, p) => sum + antimatterPending(p, origin, now), 0);

  return (
    <div className="p-5">
      {/* The tab label alone is not enough: an admin watching figures tick must
          see at a glance that none of them are real. */}
      <div
        className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[12px]"
        style={{
          borderColor: 'rgba(196,174,234,.35)',
          background: 'rgba(196,174,234,0.09)',
        }}
      >
        <span className="font-bold uppercase tracking-[0.12em] text-pxusd-purple-300">Mock preview</span>
        <span className="text-muted-foreground">
          no on-chain transactions, all figures are simulated
        </span>
      </div>

      {/* Legacy phUSD → USDC pool: the contrast anchor. Non-interactive. */}
      <div
        className="mb-6 rounded-[18px] border p-3.5"
        // `border-pxusd-teal-400/30` emits no CSS at all: the token is a full
        // hex, so the opacity modifier compiles to an invalid colour and the
        // whole declaration is dropped. Same hazard as the lavender tints —
        // tinted borders on pxusd-* tokens must be literal rgba.
        style={{
          borderColor: 'rgba(31,90,115,0.3)',
          background: 'linear-gradient(180deg, rgba(31,90,115,0.16), rgba(10,28,40,0.0) 80%)',
        }}
      >
        <div className="mb-2.5 px-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-pxusd-teal-300">
          Stake phUSD · earn USDC
        </div>
        <div
          className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border bg-white/[0.02] px-4 py-4 opacity-75 sm:grid-cols-[auto_1.1fr_0.9fr_1fr_auto]"
          style={{ borderColor: 'rgba(31,90,115,0.3)' }}
          aria-label="phUSD legacy pool"
        >
          <div className="flex min-w-0 items-center gap-3.5">
            <img src={phUSDIcon} alt="phUSD" className="h-9 w-9 rounded-full" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[16px] font-bold text-pxusd-white">phUSD</span>
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-muted-foreground">
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  Earn
                  <img src={usdcIcon} alt="" aria-hidden="true" className="h-3.5 w-3.5 rounded-full" />
                  <span className="font-semibold text-pxusd-teal-300">USDC</span>
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap sm:hidden">
                  ·
                  <span className="font-mono font-semibold text-pxusd-teal-300">
                    {fmtAPY(ANTIMATTER_LEGACY_POOL.apy)} APY
                  </span>
                </span>
              </span>
            </div>
          </div>

          <div className="hidden flex-col gap-0.5 sm:flex">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">APY</span>
            <span className="font-mono text-[18px] font-bold text-pxusd-teal-300">
              {fmtAPY(ANTIMATTER_LEGACY_POOL.apy)}
            </span>
          </div>

          <div className="hidden flex-col gap-0.5 sm:flex">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Your stake</span>
            <span className="font-mono text-[14px] font-semibold text-pxusd-white">
              {fmtAmount(ANTIMATTER_LEGACY_POOL.staked, 4)}{' '}
              <span className="text-[12px] font-normal text-muted-foreground">phUSD</span>
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Pending</span>
            <span className="flex flex-wrap items-baseline gap-x-1.5">
              <LiveYieldCounter
                ratePerSecond={ANTIMATTER_LEGACY_POOL.pendingRatePerSecond}
                initial={ANTIMATTER_LEGACY_POOL.pendingBase}
                decimals={6}
                size={14}
                weight={600}
              />
              <span className="text-[12px] font-normal text-muted-foreground">USDC</span>
            </span>
          </div>

          {/* Chevron kept for visual parity with the live tab, but inert. */}
          <span aria-hidden="true" className="justify-self-end text-muted-foreground" style={{ display: 'inline-flex' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>

      {/* Antimatter eyebrow */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5 px-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Stake stables · earn
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border py-[3px] pl-1 pr-2.5"
          style={{ borderColor: 'rgba(196,174,234,.35)', background: 'rgba(196,174,234,0.08)' }}
        >
          <img src={antimatterIcon} alt="" aria-hidden="true" className="h-4 w-4 rounded-full" />
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-pxusd-purple-300">Antimatter</span>
        </span>
        <span className="text-[11.5px] text-muted-foreground">
          annihilate it against your stake to receive phUSD
        </span>
      </div>

      {/* The header balance strip is hidden below lg, so the mock wallet's
          Antimatter figures are surfaced inside the panel instead. */}
      <div
        className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border px-3.5 py-3"
        style={{ borderColor: 'rgba(196,174,234,.28)', background: 'rgba(196,174,234,0.05)' }}
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {ANTIMATTER_SYMBOL} in wallet
          </span>
          <span className="font-mono text-[14px] font-semibold text-pxusd-white">
            {fmtAmount(state.wallet.am, 4)}
          </span>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {ANTIMATTER_SYMBOL} accruing
          </span>
          <span className="font-mono text-[14px] font-semibold" style={{ color: ANTIMATTER_ACCENT }}>
            {fmtAmount(totalPending, 6)}
          </span>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">phUSD</span>
          <span className="font-mono text-[14px] font-semibold text-pxusd-white">
            {fmtAmount(state.wallet.phusd, 2)}
          </span>
        </span>
      </div>

      {state.pools.map((pool) => (
        <AntimatterAccordionRow
          key={pool.id}
          symbol={pool.symbol}
          icon={ICONS[pool.id]}
          apy={pool.apy}
          staked={pool.staked}
          // amBase is the frozen baseline: LiveYieldCounter resets whenever
          // `initial` changes, so feeding it a per-tick `pending()` would
          // restart the RAF clock 11 times a second. It rebases only when the
          // pool's stake changes, which is exactly the intended behaviour.
          pendingBase={pool.amBase}
          ratePerSecond={antimatterRate(pool)}
          // The panel's figures are plain text rather than a RAF counter, so
          // they take the live value and advance on the 90 ms tick above.
          pending={antimatterPending(pool, origin, now)}
          antimatterSymbol={ANTIMATTER_SYMBOL}
          expanded={state.expandedId === pool.id}
          onToggle={() => toggle(pool.id)}
          tagline={pool.tagline}
          tab={pool.tab}
          onTabChange={(tab) => setTab(pool.id, tab)}
          walletBalance={state.wallet[pool.walletKey]}
          walletPhusd={state.wallet.phusd}
          walletAntimatter={state.wallet.am}
          stakeAmt={pool.stakeAmt}
          wdAmt={pool.wdAmt}
          onStakeAmtChange={(value) => updatePool(pool.id, (p) => ({ ...p, stakeAmt: value }))}
          onWdAmtChange={(value) => updatePool(pool.id, (p) => ({ ...p, wdAmt: value }))}
          onStake={() => doStake(pool.id)}
          onWithdraw={() => doWithdraw(pool.id)}
          onAnnihilate={() => doAnnihilate(pool.id)}
        />
      ))}
    </div>
  );
}
