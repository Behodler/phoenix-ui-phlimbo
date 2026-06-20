import eyeImg from '../assets/EYE.png';
import sUsdsImg from '../assets/sUSDS.png';
import scxImg from '../assets/SCX.png';
import bitcoinImg from '../assets/Bitcoin.png';
import flaxImg from '../assets/Flax.png';
import ratchetImg from '../assets/Ratchet.png';

/**
 * Static configuration for each NFT (non-contract fields).
 * Live numeric data (price, balance, nftBalance, allowance, growthBasisPoints)
 * comes from the MinterPageView contract via useMinterPageView().
 */
export interface NFTStaticConfig {
  /** NFT token ID (1-indexed, matching the NFTMinter contract) */
  id: number;
  /** Display name of the NFT */
  name: string;
  /** Image asset for the NFT */
  image: string;
  /** Description of what happens when minted (e.g., "EYE is burnt") */
  action: string;
  /** Explanation of why this NFT is valuable */
  reason: string;
  /**
   * Token prefix matching MinterPageView data keys (EYE, SCX, Flax, USDS, WBTC, USDC).
   * `USDC` is the Reservoir Ratchet row (id 6), backed by the on-chain
   * MinterPageView USDC fields (offsets 30–35, dispatcher index 7).
   */
  tokenPrefix: 'EYE' | 'SCX' | 'Flax' | 'USDS' | 'WBTC' | 'USDC';
  /** Display name of the input token */
  tokenDisplayName: string;
  /** Number of decimals for the input token's ERC20 contract */
  decimals: number;
  /**
   * When true, the mint flow routes through a batch minter (slider 1..20 + textbox)
   * instead of the single-mint path. The specific batch minter is named by
   * `batchMinterKey`. Set on Liquid Sky Phoenix and Reservoir Ratchet.
   */
  batchEnabled?: boolean;
  /**
   * ContractAddresses key for the batch minter this NFT routes through when
   * `batchEnabled` is true. Liquid Sky Phoenix → `BatchNFTMinter`,
   * Reservoir Ratchet → `RatchetBatchNFTMinter`. Each batch minter holds its
   * own target NFT minter, payment token, and dispatcher index in contract
   * state, so the UI only needs to pick the right helper address here.
   */
  batchMinterKey?: 'BatchNFTMinter' | 'RatchetBatchNFTMinter';
  /**
   * When true, this NFT is not yet deployed on-chain (mock-only). Clicking "Mint"
   * surfaces a "coming soon" toast instead of opening the mint modal, and the NFT
   * is excluded from the live yield-funnel surface (it has no MinterPageView data).
   */
  comingSoon?: boolean;
  /** Purely cosmetic. When true, the selector renders a small "NEW" badge. Never reaches a contract call. */
  isNew?: boolean;
}

/**
 * Combined NFT data: static config merged with live contract data.
 * Used by NFTCard, NFTListItem, and NFTListMintModal.
 */
export interface NFTData {
  id: number;
  name: string;
  image: string;
  action: string;
  reason: string;
  tokenPrefix: 'EYE' | 'SCX' | 'Flax' | 'USDS' | 'WBTC' | 'USDC';
  tokenDisplayName: string;
  /** Formatted price in input token amount */
  price: string;
  /** Formatted user token balance */
  balance: string;
  /** NFT balance (quantity owned) */
  nftBalance: number;
  /** Raw allowance as bigint (for approve/mint logic) */
  allowanceRaw: bigint;
  /** Raw price as bigint (for approve/mint logic) */
  priceRaw: bigint;
  /** Raw user token balance as bigint (for balance guard comparisons) */
  balanceRaw: bigint;
  /** Number of decimals for the input token's ERC20 contract */
  decimals: number;
  /** Growth rate in basis points (e.g., 250 = 2.5%) */
  growthBasisPoints: number;
  /** Dispatcher index used by NFTMinter.mint() to identify this token's dispatcher */
  dispatcherIndex: number;
  /** Formatted total burnt (only for EYE, SCX, Flax) */
  totalBurnt?: string;
  /**
   * Mirrors `NFTStaticConfig.batchEnabled`. When true and the resolved
   * `batchMinterKey` address is non-zero, the mint modal renders the batch UI.
   */
  batchEnabled?: boolean;
  /** Mirrors `NFTStaticConfig.batchMinterKey` — which batch minter to route through. */
  batchMinterKey?: 'BatchNFTMinter' | 'RatchetBatchNFTMinter';
  /** Mirrors `NFTStaticConfig.comingSoon`. When true, mint shows a "coming soon" toast. */
  comingSoon?: boolean;
  /** Purely cosmetic. When true, the selector renders a small "NEW" badge. Never reaches a contract call. */
  isNew?: boolean;
}

/**
 * Static config array with non-contract fields only.
 * The tokenPrefix maps to the MinterPageView data keys.
 */
export const nftStaticConfig: NFTStaticConfig[] = [
  {
    id: 1,
    name: "EYE ignition",
    image: eyeImg,
    action: "EYE is burnt",
    reason: "Returning value to the OG Behoblins. Patience has been rewarded!",
    tokenPrefix: "EYE",
    tokenDisplayName: "EYE",
    decimals: 18,
  },
  {
    id: 2,
    name: "Liquid Sky Phoenix",
    image: sUsdsImg,
    action: "Balancer liquidity boosted",
    reason: "More liquidity with price tilting means more minting which means more yield which means more liquidity which means... you get the idea.",
    tokenPrefix: "USDS",
    tokenDisplayName: "USDS",
    decimals: 18,
    batchEnabled: true,
    batchMinterKey: "BatchNFTMinter",
  },
  {
    id: 3,
    name: "Smouldering Scarcity",
    image: scxImg,
    action: "SCX is burnt",
    reason: "All time low set by the Seychelles; all time high set by Phoenix",
    tokenPrefix: "SCX",
    tokenDisplayName: "SCX",
    decimals: 18,
  },
  {
    id: 4,
    name: "Bitcoin Buildup",
    image: bitcoinImg,
    action: "BTC is stockpiled in case of emergency",
    reason: "Antifragility reserve in case an external protocol fails.",
    tokenPrefix: "WBTC",
    tokenDisplayName: "WBTC",
    decimals: 8,
  },
  {
    id: 5,
    name: "Flax Wild Fire",
    image: flaxImg,
    action: "Flax is burnt",
    reason: "Flax was a seed which grew into phUSD. DeFi will pay back that investment.",
    tokenPrefix: "Flax",
    tokenDisplayName: "FLAX",
    decimals: 18,
  },
  {
    id: 6,
    name: "Reservoir Ratchet",
    image: ratchetImg,
    action: "USDC increases whale nudge reward.",
    reason: "NFT staking for fish that encourages whales",
    tokenPrefix: "USDC",
    tokenDisplayName: "USDC",
    decimals: 6,
    batchEnabled: true,
    batchMinterKey: "RatchetBatchNFTMinter",
    isNew: true,
  },
];

/**
 * Registry of NFTs that can be staked in the NFT → Stake sub-tab.
 *
 * Each entry binds a static NFT config to its staking-surface metadata.
 * `isLive` distinguishes NFTs whose NFTStaker contract is deployed (wired
 * to the real `useStakingPageData` hook) from those that are still
 * mock-backed (no deployed staker yet).
 *
 * IMPORTANT: each NFT has its own unique NFTStaker contract — stakers are
 * NOT shared (`nftStakerAbi.stake(amount)` takes only a `uint256` amount,
 * with no token-id parameter, so one staker is intrinsically bound to one
 * NFT). The set is static and small, so the surface calls each NFT's source
 * hook explicitly (never inside a `.map`, per the Rules of Hooks).
 */
export interface StakeableNft {
  /** Static NFT config (name, image, id, tokenPrefix, ...). */
  config: NFTStaticConfig;
  /**
   * Display APY used by the thumbnail rail / aggregation. For live NFTs the
   * real hook's computed `minApy` overrides this; for mock NFTs this is the
   * source of truth.
   */
  apy: number;
  /** Short flavor tagline shown on the card, e.g. "SCX is burnt". */
  tagline: string;
  /** False => mock-backed (staker contract not deployed yet). */
  isLive: boolean;
}

const liquidSkyConfig = nftStaticConfig.find((n) => n.id === 2)!;
const ratchetConfig = nftStaticConfig.find((n) => n.id === 6)!;

/**
 * The ordered set of stakeable NFTs rendered in the rail.
 *
 * To add another NFT: append an entry here AND add one explicit source-hook
 * call in `StakingSurface` (hooks cannot be called in a `.map`).
 */
export const STAKEABLE_NFTS: StakeableNft[] = [
  {
    config: liquidSkyConfig,
    apy: 4.2, // overridden by the live hook's computed minApy
    tagline: liquidSkyConfig.action,
    isLive: true,
  },
  {
    config: ratchetConfig,
    apy: 6.8, // overridden by the live hook's computed minApy
    tagline: ratchetConfig.action,
    isLive: true,
  },
];

/**
 * Mapping from tokenPrefix to the ContractAddresses key for the ERC20 token.
 * Used for approve() calls.
 */
export const tokenPrefixToAddressKey: Record<string, string> = {
  EYE: 'EYE',
  SCX: 'SCX',
  Flax: 'Flax',
  WBTC: 'WBTC',
  USDS: 'USDS',
  USDC: 'USDC',
};

/**
 * Mapping from tokenPrefix to the useNFTPrices key for USD conversion.
 * The prices hook uses slightly different keys (e.g., FLAX vs Flax, BTC vs WBTC).
 */
export const tokenPrefixToPriceKey: Record<string, string> = {
  EYE: 'EYE',
  SCX: 'SCX',
  Flax: 'FLAX',
  USDS: 'USDS',
  WBTC: 'BTC',
  USDC: 'USDC',
};
