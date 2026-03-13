import eyeImg from '../assets/EYE.png';
import sUsdsImg from '../assets/sUSDS.png';
import scxImg from '../assets/SCX.png';
import bitcoinImg from '../assets/Bitcoin.png';
import flaxImg from '../assets/Flax.png';

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
  /** Token prefix matching MinterPageView data keys (EYE, SCX, Flax, sUSDS, WBTC) */
  tokenPrefix: 'EYE' | 'SCX' | 'Flax' | 'sUSDS' | 'WBTC';
  /** Display name of the input token */
  tokenDisplayName: string;
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
  tokenPrefix: 'EYE' | 'SCX' | 'Flax' | 'sUSDS' | 'WBTC';
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
  /** Growth rate in basis points (e.g., 250 = 2.5%) */
  growthBasisPoints: number;
  /** Formatted total burnt (only for EYE, SCX, Flax) */
  totalBurnt?: string;
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
  },
  {
    id: 2,
    name: "Liquid Sky Phoenix",
    image: sUsdsImg,
    action: "Balancer liquidity boosted",
    reason: "More liquidity with price tilting means more minting which means more yield which means more liquidity which means... you get the idea.",
    tokenPrefix: "sUSDS",
    tokenDisplayName: "sUSDS",
  },
  {
    id: 3,
    name: "Smouldering Scarcity",
    image: scxImg,
    action: "SCX is burnt",
    reason: "All time low set by the Seychelles; all time high set by Phoenix",
    tokenPrefix: "SCX",
    tokenDisplayName: "SCX",
  },
  {
    id: 4,
    name: "Bitcoin Buildup",
    image: bitcoinImg,
    action: "BTC is stockpiled in case of emergency",
    reason: "Antifragility reserve in case an external protocol fails.",
    tokenPrefix: "WBTC",
    tokenDisplayName: "WBTC",
  },
  {
    id: 5,
    name: "Flax Wild Fire",
    image: flaxImg,
    action: "Flax is burnt",
    reason: "Flax was a seed which grew into phUSD. DeFi will pay back that investment.",
    tokenPrefix: "Flax",
    tokenDisplayName: "FLAX",
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
  // sUSDS is not in ContractAddresses - handled separately via MintPageView contract
};

/**
 * Mapping from tokenPrefix to the useNFTPrices key for USD conversion.
 * The prices hook uses slightly different keys (e.g., FLAX vs Flax, BTC vs WBTC).
 */
export const tokenPrefixToPriceKey: Record<string, string> = {
  EYE: 'EYE',
  SCX: 'SCX',
  Flax: 'FLAX',
  sUSDS: 'sUSDS',
  WBTC: 'BTC',
};
