import { useState } from 'react';
import type { Address } from 'viem';
import type { Toast } from '../../../types/toast';
import {
  STAKER_WIRINGS,
  type StakerId,
  type StakerWiring,
} from '../../../data/nftStakeMockData';
import { useStakingPageData } from '../../../hooks/useStakingPageData';
import type { StakingPageData } from '../../../hooks/useStakingPageData';
import { useContractAddresses } from '../../../contexts/ContractAddressContext';
import { computeApyRange } from '../../../utils/stakingMath';
import EarningPanel from '../staking/EarningPanel';
import NftStakerAccordionRow from './NftStakerAccordionRow';

type AddToast = (toast: Omit<Toast, 'id'>) => string;

export interface StakingSurfaceMockProps {
  /** Toast dispatcher, threaded into each per-staker hook's tx lifecycle. */
  addToast: AddToast;
}

/** A wiring descriptor bound to its live per-staker hook state + derived APY band. */
interface StakerRow {
  wiring: StakerWiring;
  state: StakingPageData;
  floorApy: number;
  ceilApy: number;
}

/**
 * Redesigned NFT staking surface — LIVE on-chain wiring (Story 076).
 *
 * Drives the admin-only Stake Preview accordion off real per-staker contract
 * data. Each of the five stakers gets its OWN explicit `useStakingPageData`
 * call (never in a `.map`, per the Rules of Hooks); the generic hook reads
 * staked/owned units, live pending phUSD, rate-per-second and APY, and executes
 * the real `setApprovalForAll` / `stake` / `unstake` / `claim` writes. Rows are
 * bound to their static `STAKER_WIRINGS` descriptor by id and the `floor → ceil`
 * APY band is derived here via `computeApyRange` from values the hook returns.
 */
export default function StakingSurfaceMock({ addToast }: StakingSurfaceMockProps) {
  const { addresses } = useContractAddresses();

  // Default the SCX row open (matches the redesign HTML `expanded: 'scx'`).
  const [expandedId, setExpandedId] = useState<StakerId | null>('scx');

  // ── Five explicit per-staker hook calls (fixed order, never in a loop) ──
  const lsp = useStakingPageData(addToast, {
    stakerAddress: addresses?.NFTStaker as Address | undefined,
    ownedRowKey: 'USDS',
    nftName: 'Liquid Sky Phoenix',
    hasTargetApy: true,
  });
  const ratchet = useStakingPageData(addToast, {
    stakerAddress: addresses?.RatchetNFTStaker as Address | undefined,
    ownedRowKey: 'USDC',
    nftName: 'Reservoir Ratchet',
    hasTargetApy: true,
  });
  const eye = useStakingPageData(addToast, {
    stakerAddress: addresses?.UniboostStakerEYE as Address | undefined,
    ownedRowKey: 'EYE',
    nftName: 'EYE Ignition',
    hasTargetApy: false,
  });
  const scx = useStakingPageData(addToast, {
    stakerAddress: addresses?.UniboostStakerSCX as Address | undefined,
    ownedRowKey: 'SCX',
    nftName: 'Smouldering Scarcity',
    hasTargetApy: false,
  });
  const flx = useStakingPageData(addToast, {
    stakerAddress: addresses?.UniboostStakerFLX as Address | undefined,
    ownedRowKey: 'Flax',
    nftName: 'Flax Wild Fire',
    hasTargetApy: false,
  });

  const states: Record<StakerId, StakingPageData> = { lsp, ratchet, eye, scx, flx };

  // Bind each descriptor to its hook state + derived APY band (pure map — the
  // hooks above are what must stay out of a loop, not this presentational map).
  const rows: StakerRow[] = STAKER_WIRINGS.map((wiring) => {
    const state = states[wiring.id];
    const { floorApy, ceilApy } = computeApyRange({
      annualRewardDollars: state.annualRewardDollars,
      totalStaked: state.totalStaked,
      ownedUnits: state.ownedUnits,
      highestPriceUsd: state.highestPrice,
      minApy: state.minApy,
      hasTargetApy: wiring.hasTargetApy,
    });
    return { wiring, state, floorApy, ceilApy };
  });

  const fixedRows = rows.filter((r) => r.wiring.kind === 'fixed');
  const mcRows = rows.filter((r) => r.wiring.kind === 'mc');

  // ── Real hero aggregation over the live results ─────────────────────────
  const totalUnits = rows.reduce((s, r) => s + r.state.stakedUnits, 0);
  const pendingYield = rows.reduce((s, r) => s + r.state.pendingYield, 0);
  const ratePerSecond = rows.reduce((s, r) => s + r.state.ratePerSec, 0);

  const toggle = (id: StakerId) =>
    setExpandedId((cur) => (cur === id ? null : id));

  const renderRow = (row: StakerRow) => {
    const { wiring, state } = row;
    return (
      <NftStakerAccordionRow
        key={wiring.id}
        name={wiring.name}
        sub={wiring.sub}
        image={wiring.image}
        kind={wiring.kind}
        floorApy={row.floorApy}
        ceilApy={row.ceilApy}
        stakedUnits={state.stakedUnits}
        ownedUnits={state.ownedUnits}
        pendingYield={state.pendingYield}
        ratePerSec={state.ratePerSec}
        isStakerDeployed={state.isStakerDeployed}
        isApprovedForAll={state.isApprovedForAll}
        isApproving={state.isApproving}
        isStaking={state.isStaking}
        isUnstaking={state.isUnstaking}
        isClaiming={state.isClaiming}
        isOpen={expandedId === wiring.id}
        onToggle={() => toggle(wiring.id)}
        onApprove={() => void state.approveAll()}
        onStake={(u) => void state.stake(u)}
        onUnstake={(u) => void state.unstake(u)}
        onClaim={() => void state.claim()}
      />
    );
  };

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

      {/* Liquidity Boosting Pools (teal) */}
      <section
        className="mb-4 rounded-[18px] border p-3.5"
        style={{
          background:
            'linear-gradient(180deg, rgba(31,90,115,.16), rgba(10,28,40,0) 78%)',
          borderColor: 'rgba(31,90,115,0.42)',
        }}
      >
        <div className="mb-[3px]">
          <div className="text-sm font-extrabold tracking-[-0.01em] text-pxusd-white">
            Liquidity Boosting Pools
          </div>
        </div>
        <p className="mx-0.5 mb-3 mt-[5px] max-w-[560px] text-[11.5px] leading-[1.55] text-muted-foreground">
          A fixed phUSD stream per NFT, every second.
        </p>
        {fixedRows.map(renderRow)}
      </section>

      {/* Protocol token pools (orange) */}
      <section
        className="mb-4 rounded-[18px] border p-3.5"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,140,66,.11), rgba(10,28,40,0) 78%)',
          borderColor: 'rgba(255,140,66,0.32)',
        }}
      >
        <div className="mb-[3px]">
          <div className="text-sm font-extrabold tracking-[-0.01em] text-pxusd-white">
            Protocol token pools
          </div>
        </div>
        <p className="mx-0.5 mb-3 mt-[5px] max-w-[560px] text-[11.5px] leading-[1.55] text-muted-foreground">
          EYE, SCX and FLX each earn a shared phUSD stream, split across everyone staked.
        </p>
        {mcRows.map(renderRow)}
      </section>

      {/* Why is APY a range? */}
      <div
        className="mt-1 flex items-start gap-3.5 rounded-[14px] border px-4 py-4"
        style={{
          background: 'linear-gradient(180deg, rgba(31,90,115,.14), rgba(10,28,40,0))',
          borderColor: 'rgba(166,219,239,0.22)',
        }}
      >
        <div
          className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg border font-mono text-sm font-extrabold"
          style={{
            color: '#a6dbef',
            background: 'rgba(166,219,239,0.14)',
            borderColor: 'rgba(166,219,239,0.34)',
          }}
        >
          ?
        </div>
        <div>
          <div className="mb-1.5 mt-px text-[12.5px] font-extrabold text-pxusd-white">
            Why is APY a range?
          </div>
          <div className="text-[11.5px] leading-relaxed text-muted-foreground">
            NFTs were minted at many different prices, but once minted they're
            interchangeable — so there's no way to know what any single NFT
            originally cost.{' '}
            <b className="font-semibold text-pxusd-white/80">
              NFTs minted earlier cost less and earn a higher APY; those minted
              later cost more and earn a lower one.
            </b>{' '}
            Your actual return lands somewhere inside the range shown.
          </div>
        </div>
      </div>
    </div>
  );
}
