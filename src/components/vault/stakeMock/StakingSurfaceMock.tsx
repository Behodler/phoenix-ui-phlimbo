import { useMemo, useState } from 'react';
import type { Toast } from '../../../types/toast';
import { MOCK_STAKER_ROWS, type MockStakerRow } from '../../../data/nftStakeMockData';
import EarningPanel from '../staking/EarningPanel';
import NftStakerAccordionRow from './NftStakerAccordionRow';

type AddToast = (toast: Omit<Toast, 'id'>) => string;

export interface StakingSurfaceMockProps {
  /** Toast dispatcher, used for the "coming soon" stubs on this unwired surface. */
  addToast: AddToast;
}

/**
 * Redesigned NFT staking surface — MOCK DATA ONLY (Story 073).
 *
 * This is the sole reader of `nftStakeMockData`. It owns the accordion's
 * one-open-at-a-time state and aggregates the mock rows into the shared
 * `EarningPanel` hero. Every value here is mock; Stake/Unstake/Claim are
 * stubbed no-ops (a "coming soon" toast). The future wiring story replaces the
 * single `MOCK_STAKER_ROWS` read with explicit per-staker hooks returning the
 * same `MockStakerRow` shape — no presentational component changes needed.
 */
export default function StakingSurfaceMock({ addToast }: StakingSurfaceMockProps) {
  // Default the SCX row open (matches the redesign HTML `expanded: 'scx'`).
  const [expandedId, setExpandedId] = useState<string | null>('scx');

  const rows = MOCK_STAKER_ROWS;
  const fixedRows = useMemo(() => rows.filter((r) => r.kind === 'fixed'), [rows]);
  const mcRows = useMemo(() => rows.filter((r) => r.kind === 'mc'), [rows]);

  // Aggregate mock totals for the hero panel.
  const totalUnits = useMemo(() => rows.reduce((s, r) => s + r.stakedUnits, 0), [rows]);
  const pendingYield = useMemo(() => rows.reduce((s, r) => s + r.pendingYield, 0), [rows]);
  const ratePerSecond = useMemo(() => rows.reduce((s, r) => s + r.ratePerSec, 0), [rows]);

  const toggle = (id: string) =>
    setExpandedId((cur) => (cur === id ? null : id));

  const comingSoon = (verb: string) => (
    addToast({
      type: 'info',
      title: 'Coming soon',
      description: `NFT ${verb} is not wired up yet.`,
    })
  );

  const renderRow = (row: MockStakerRow) => (
    <NftStakerAccordionRow
      key={row.id}
      name={row.name}
      sub={row.sub}
      image={row.image}
      kind={row.kind}
      floorApy={row.floorApy}
      ceilApy={row.ceilApy}
      stakedUnits={row.stakedUnits}
      ownedUnits={row.ownedUnits}
      pendingYield={row.pendingYield}
      ratePerSec={row.ratePerSec}
      isOpen={expandedId === row.id}
      onToggle={() => toggle(row.id)}
      onStake={() => comingSoon('staking')}
      onUnstake={() => comingSoon('unstaking')}
      onClaim={() => comingSoon('claiming')}
    />
  );

  return (
    <div>
      {/* Header */}
      <h2 className="m-0 mb-1 text-[22px] font-extrabold tracking-[-0.02em] text-pxusd-white">
        NFT Staking
      </h2>
      <p className="m-0 mb-5 text-[12.5px] leading-relaxed text-muted-foreground">
        Every NFT earns a phUSD stream. Tap a row to stake, unstake or claim.
      </p>

      {/* Global earning hero */}
      <EarningPanel
        totalUnits={totalUnits}
        ratePerSecond={ratePerSecond}
        pendingYield={pendingYield}
      />

      {/* Fixed rate — Original stakers (teal) */}
      <section
        className="mb-4 rounded-[18px] border border-pxusd-teal-400/[0.42] p-3.5"
        style={{
          background:
            'linear-gradient(180deg, rgba(31,90,115,.16), rgba(10,28,40,0) 78%)',
        }}
      >
        <div className="mb-[3px] flex items-center gap-2.5">
          <span
            className="whitespace-nowrap rounded-md border border-pxusd-teal-400/[0.55] bg-pxusd-teal-400/[0.34] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em]"
            style={{ color: '#8fd0e8' }}
          >
            Fixed rate
          </span>
          <div className="text-sm font-extrabold tracking-[-0.01em] text-pxusd-white">
            Original stakers
          </div>
        </div>
        <p className="mx-0.5 mb-3 mt-[5px] max-w-[560px] text-[11.5px] leading-[1.55] text-muted-foreground">
          A fixed phUSD stream per NFT, every second.
        </p>
        {fixedRows.map(renderRow)}
      </section>

      {/* MasterChef — Protocol-token stakers (orange) */}
      <section
        className="mb-4 rounded-[18px] border border-pxusd-orange-400/[0.32] p-3.5"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,140,66,.11), rgba(10,28,40,0) 78%)',
        }}
      >
        <div className="mb-[3px] flex items-center gap-2.5">
          <span className="whitespace-nowrap rounded-md border border-pxusd-orange-400/[0.42] bg-pxusd-orange-400/[0.14] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-pxusd-orange-300">
            MasterChef
          </span>
          <div className="text-sm font-extrabold tracking-[-0.01em] text-pxusd-white">
            Protocol-token stakers
          </div>
        </div>
        <p className="mx-0.5 mb-3 mt-[5px] max-w-[560px] text-[11.5px] leading-[1.55] text-muted-foreground">
          EYE, SCX and FLX each earn a shared phUSD stream, split across everyone staked.
        </p>
        {mcRows.map(renderRow)}
      </section>

      {/* Why is APY a range? */}
      <div
        className="mt-1 flex items-start gap-3.5 rounded-[14px] border border-pxusd-teal-400/[0.22] px-4 py-4"
        style={{
          background: 'linear-gradient(180deg, rgba(31,90,115,.14), rgba(10,28,40,0))',
        }}
      >
        <div
          className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg border border-pxusd-teal-400/[0.34] bg-pxusd-teal-400/[0.14] font-mono text-sm font-extrabold"
          style={{ color: '#a6dbef' }}
        >
          ?
        </div>
        <div>
          <div className="mb-1.5 mt-px text-[12.5px] font-extrabold text-pxusd-white">
            Why is APY a range?
          </div>
          <div className="text-[11.5px] leading-relaxed text-muted-foreground">
            Each NFT was minted at many different prices, and once minted they're
            interchangeable — so there's no way to tell which price any single NFT
            paid.{' '}
            <b className="font-semibold text-pxusd-white/80">
              Earlier mints cost less and earn a higher APY; later mints cost more
              and earn less.
            </b>{' '}
            Your real return sits somewhere between the two ends shown.
          </div>
        </div>
      </div>
    </div>
  );
}
