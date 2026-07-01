import eyeImg from '../assets/EYE.png';
import sUsdsImg from '../assets/sUSDS.png';
import scxImg from '../assets/SCX.png';
import flaxImg from '../assets/Flax.png';
import ratchetImg from '../assets/Ratchet.png';

/**
 * Grouping / accent driver for a mock staker row.
 *
 * - `fixed` — "Fixed rate" / Original stakers (teal accent): a fixed phUSD
 *   stream per NFT, every second (Liquid Sky Phoenix, Reservoir Ratchet).
 * - `mc`    — "MasterChef" / Protocol-token stakers (orange accent): a shared
 *   phUSD stream split across everyone staked (EYE, SCX, FLX).
 */
export type StakerKind = 'fixed' | 'mc';

/**
 * The wiring seam for the NFT staking redesign.
 *
 * This interface mirrors what a real per-staker hook would eventually return,
 * so the future wiring story can swap the data source (mock array → explicit
 * per-NFT hooks) without touching the presentational components. Only the
 * orchestrator (`StakingSurfaceMock`) ever reads the mock array below; every
 * presentational component takes plain props derived from these fields.
 */
export interface MockStakerRow {
  /** Stable row id: 'lsp' | 'ratchet' | 'eye' | 'scx' | 'flx'. */
  id: string;
  /** Display name, e.g. 'EYE Ignition'. */
  name: string;
  /** Short flavor sub, rendered as `Earn phUSD · {sub}`. */
  sub: string;
  /** Imported asset (reuses the same image imports as nftMockData). */
  image: string;
  /** Fixed-rate vs MasterChef grouping + accent. */
  kind: StakerKind;
  /** % — the "Latest mint" (floor) APY anchor. */
  floorApy: number;
  /** % — the "Earliest mint" (ceil) APY anchor. */
  ceilApy: number;
  /** Units the wallet currently has staked. */
  stakedUnits: number;
  /** Wallet units available to stake. */
  ownedUnits: number;
  /** phUSD, human units (6dp) — baseline for the live counter. */
  pendingYield: number;
  /** phUSD/sec accrual (0 ⇒ pending stays flat / shows "—"). */
  ratePerSec: number;
}

/**
 * Seed data — verbatim from the redesign HTML `base()`.
 *
 * NOTE: this is the ONLY place the mock values live. When the wiring story
 * lands, replace the import of this array in `StakingSurfaceMock` with explicit
 * per-staker hook calls that return the same `MockStakerRow` shape.
 */
export const MOCK_STAKER_ROWS: MockStakerRow[] = [
  {
    id: 'lsp',
    name: 'Liquid Sky Phoenix',
    sub: 'Balancer liquidity boost',
    image: sUsdsImg,
    kind: 'fixed',
    floorApy: 6.4,
    ceilApy: 18.9,
    stakedUnits: 3,
    ownedUnits: 2,
    pendingYield: 12.84,
    ratePerSec: 0.000172,
  },
  {
    id: 'ratchet',
    name: 'Reservoir Ratchet',
    sub: 'Whale nudge reward',
    image: ratchetImg,
    kind: 'fixed',
    floorApy: 9.1,
    ceilApy: 27.3,
    stakedUnits: 1,
    ownedUnits: 0,
    pendingYield: 4.21,
    ratePerSec: 0.000081,
  },
  {
    id: 'eye',
    name: 'EYE Ignition',
    sub: 'EYE is burnt',
    image: eyeImg,
    kind: 'mc',
    floorApy: 4.8,
    ceilApy: 15.2,
    stakedUnits: 0,
    ownedUnits: 4,
    pendingYield: 0,
    ratePerSec: 0,
  },
  {
    id: 'scx',
    name: 'Smouldering Scarcity',
    sub: 'SCX is burnt',
    image: scxImg,
    kind: 'mc',
    floorApy: 7.2,
    ceilApy: 22.6,
    stakedUnits: 2,
    ownedUnits: 1,
    pendingYield: 8.42,
    ratePerSec: 0.000131,
  },
  {
    id: 'flx',
    name: 'Flax Wild Fire',
    sub: 'Flax is burnt',
    image: flaxImg,
    kind: 'mc',
    floorApy: 5.5,
    ceilApy: 17.1,
    stakedUnits: 0,
    ownedUnits: 6,
    pendingYield: 0,
    ratePerSec: 0,
  },
];
