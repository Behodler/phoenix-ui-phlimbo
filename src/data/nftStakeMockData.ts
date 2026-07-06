import eyeImg from '../assets/EYE.png';
import sUsdsImg from '../assets/sUSDS.png';
import scxImg from '../assets/SCX.png';
import flaxImg from '../assets/Flax.png';
import ratchetImg from '../assets/Ratchet.png';
import type { ContractAddresses } from '../types/contracts';

/**
 * Grouping / accent driver for a staker row.
 *
 * - `fixed` — "Fixed rate" / Original stakers (teal accent): a fixed phUSD
 *   stream per NFT, every second (Liquid Sky Phoenix, Reservoir Ratchet). Their
 *   staker exposes `targetAPY()` and auto-scales the reward rate to hit it.
 * - `mc`    — "MasterChef" / Protocol-token stakers (orange accent): a shared
 *   phUSD budget split across everyone staked (EYE, SCX, FLX). These are the
 *   Uniboost depletion stakers — no `targetAPY()`; the budget emits regardless
 *   of how much is staked.
 */
export type StakerKind = 'fixed' | 'mc';

/** Stable per-staker row id. */
export type StakerId = 'lsp' | 'ratchet' | 'eye' | 'scx' | 'flx';

/**
 * MinterPageView row key supplying owned units + mint price for a staker.
 *
 * Note: EYE/SCX/Flax are the MinterPageView **slot keys** (story 075 made them
 * USDC-denominated at 6dp); they are NOT the same as the `'USDC'` slot, which is
 * the Reservoir Ratchet offset.
 */
export type OwnedRowKey = 'USDS' | 'USDC' | 'EYE' | 'SCX' | 'Flax';

/**
 * Static per-staker **wiring descriptor** for the NFT staking redesign.
 *
 * Story 076 replaced the old numeric mock (`MOCK_STAKER_ROWS`) with this
 * descriptor list. It carries only presentational identity (id/name/sub/image/
 * kind) plus the bindings the orchestrator needs to resolve a live per-staker
 * `useStakingPageData` call. No live values live here — staked/owned units,
 * pending phUSD, rate-per-second and the APY band all come from the chain.
 */
export interface StakerWiring {
  /** Stable row id. */
  id: StakerId;
  /** Display name, e.g. 'EYE Ignition'. Also woven into the hook's action toasts. */
  name: string;
  /** Short flavor sub, rendered as `Earn phUSD · {sub}`. */
  sub: string;
  /** Imported asset (reuses the same image imports as nftMockData). */
  image: string;
  /** Fixed-rate vs MasterChef grouping + accent. */
  kind: StakerKind;
  /** Contract-address key resolving this NFT's staker on the active network. */
  stakerAddressKey: keyof ContractAddresses;
  /** MinterPageView row supplying owned units + mint price. */
  ownedRowKey: OwnedRowKey;
  /**
   * Whether the staker exposes `targetAPY()`. True for the fixed stakers
   * (LSP/Ratchet); false for the Uniboost depletion stakers (EYE/SCX/FLX),
   * which drives both the conditional `targetAPY` read and the empty-pool
   * APY path in `computeApyRange`.
   */
  hasTargetApy: boolean;
}

/**
 * The five stakers driving the admin Stake Preview accordion.
 *
 * Order within each `kind` group is the display order. The orchestrator
 * (`StakingSurfaceMock`) binds each descriptor to its own explicit
 * `useStakingPageData` call (never in a `.map`, per the Rules of Hooks).
 */
export const STAKER_WIRINGS: StakerWiring[] = [
  {
    id: 'lsp',
    name: 'Liquid Sky Phoenix',
    sub: 'Balancer liquidity boost',
    image: sUsdsImg,
    kind: 'fixed',
    stakerAddressKey: 'NFTStaker',
    ownedRowKey: 'USDS',
    hasTargetApy: true,
  },
  {
    id: 'ratchet',
    name: 'Reservoir Ratchet',
    sub: 'Whale nudge reward',
    image: ratchetImg,
    kind: 'fixed',
    stakerAddressKey: 'RatchetNFTStaker',
    ownedRowKey: 'USDC',
    hasTargetApy: true,
  },
  {
    id: 'eye',
    name: 'EYE Ignition',
    sub: 'EYE is burnt',
    image: eyeImg,
    kind: 'mc',
    stakerAddressKey: 'UniboostStakerEYE',
    ownedRowKey: 'EYE',
    hasTargetApy: false,
  },
  {
    id: 'scx',
    name: 'Smouldering Scarcity',
    sub: 'SCX is burnt',
    image: scxImg,
    kind: 'mc',
    stakerAddressKey: 'UniboostStakerSCX',
    ownedRowKey: 'SCX',
    hasTargetApy: false,
  },
  {
    id: 'flx',
    name: 'Flax Wild Fire',
    sub: 'Flax is burnt',
    image: flaxImg,
    kind: 'mc',
    stakerAddressKey: 'UniboostStakerFLX',
    ownedRowKey: 'Flax',
    hasTargetApy: false,
  },
];
