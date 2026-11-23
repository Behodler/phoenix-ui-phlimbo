// Static configuration for the history indexer.
//
// The Lambda cannot import the UI's ContractAddresses, so the four mainnet
// sources are pinned here. Provenance (verified 2026-11-19, story 098):
//   addresses — phase-2-staging server/deployments/mainnet-addresses.ts
//               (keys NFTBonfire, Antimatter, StableStakerV2, NudgeDiscountBatchMinter)
//   blocks    — phase-2-staging broadcast/**/1/ receipts:
//               DeployNFTBonfireMainnet.s.sol, CutoverStableStakerV2Mainnet.s.sol,
//               DeployMainnetNudgeDiscount.s.sol
//   events    — cross-checked against @behodler/phase2-wagmi-hooks generated.ts
//               (antimatterAbi, nftBonfireAbi, batchNftMinterNudgeDiscountAbi,
//               stableStakerV2Abi)
import { parseAbiItem } from 'viem';

export const CHAIN_ID = 1;
export const SCHEMA_VERSION = 1;

export const EVENTS = {
  burned: parseAbiItem(
    'event Burned(address indexed burner, uint256 indexed tokenId, uint256 payout)',
  ),
  annihilated: parseAbiItem(
    'event Annihilated(address indexed stable, address indexed annihilator, address indexed recipient, uint256 amount, uint256 stableAmount, uint256 phUSDAmount)',
  ),
  autoAnnihilated: parseAbiItem(
    'event AutoAnnihilated(address indexed token, address indexed user, uint256 antimatterBurned, uint256 principalConsumed, uint256 excessMinted, uint256 phUSDPaid, uint256 phUSDMinted)',
  ),
  // antimatter/src/AntimatterBooster.sol (commit 70ea8f3); matches
  // antimatterBoosterAbi in @behodler/phase2-wagmi-hooks 0.26.0.
  boostedAnnihilation: parseAbiItem(
    'event BoostedAnnihilation(address indexed user, address indexed recipient, address indexed stable, uint256 amount, uint256 stableAmount, uint256 basePhUSD, uint256 bonusPhUSD)',
  ),
  batchMinted: parseAbiItem(
    'event BatchMinted(address indexed recipient, uint256 free, uint256 paid, uint256 paidCost, uint256 potReservedUSDC, uint256 owedAdded)',
  ),
};

// yield-claim-nft/src/NFTBonfire.sol L59
export const NFT_BONFIRE = {
  address: '0xE5983721f009AB57d464e611C9A06B148cEC3Acc',
  deployBlock: 26380670,
};
// antimatter/src/Antimatter.sol L109-116
export const ANTIMATTER = {
  address: '0x9CA92B527012DfC6Fdca7B7493C722D5901FF151',
  deployBlock: 26042916,
};
// stable-staker/src/StableStakerV2.sol L183-191
export const STABLE_STAKER_V2 = {
  address: '0xA6d3fc83C91B8319D219cEB12B46e3dfF064B58F',
  deployBlock: 26042919,
};
// nft-staking/src/BatchNFTMinterNudgeDiscount.sol L358-365
export const BATCH_MINTER_DISCOUNT = {
  address: '0xD41235bC400BAEDD23aA416Db1F62c944981C42a',
  deployBlock: 26445089,
};

// antimatter/src/AntimatterBooster.sol L305-339. Boosted annihilations call
// antimatter.annihilate() from the booster, so Annihilated names the booster as
// annihilator; the real user is in BoostedAnnihilation (same tx). No cursor of
// its own: it is scanned over the annihilations range (see indexer.mjs).
// Provenance (verified 2026-11-23, story 104):
//   address — phase-2-staging server/deployments/mainnet-addresses.ts key
//             AntimatterBooster (filled by phase-2-staging commit d66f312)
//   block   — phase-2-staging broadcast/DeployAntimatterBoosterMainnet.s.sol/1/
//             run-latest.json, AntimatterBooster CREATE receipt
//             (tx 0x31ef451c…3376, blockNumber 0x19401d4 = 26477012,
//             contractAddress matches the address book)
// A zero address disables booster scanning and stale-row repair entirely.
export const ANTIMATTER_BOOSTER = {
  address: '0xbb8bF9C05160bB45A2ef920AfD09Bc4ab0258a2C',
  deployBlock: 26477012,
};

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const DEFAULT_RPC_URLS = [
  'https://eth.drpc.org',
  'https://mainnet.gateway.tenderly.co',
  'https://ethereum-rpc.publicnode.com',
];

export const SCAN = {
  initialChunk: 50_000,
  minChunk: 500,
  maxChunk: 50_000,
  // Stop starting new work once fewer than this many ms remain.
  reserveMs: 30_000,
};

export const ERC20_METADATA_ABI = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
];
