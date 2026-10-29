/**
 * SYAHarvester ABI (the subset the Forge tab uses).
 *
 * Hand-written from `phase-2-staging/lib/sya-harvester/src/SYAHarvester.sol`
 * because `@behodler/phase2-wagmi-hooks@0.19.0` does not export the
 * harvester. Replace with the package export once a release ships it.
 *
 * The custom errors are listed so viem can decode a reverted simulation by
 * name: `Unprofitable(ethOut, gasCost)` is how the quote learns that a harvest
 * would not cover its gas.
 */
export const syaHarvesterAbi = [
  {
    type: 'function',
    name: 'harvest',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'exemptStrategies', type: 'address[]' },
      { name: 'nftIndex', type: 'uint256' },
      { name: 'minEthOut', type: 'uint256' },
    ],
    outputs: [{ name: 'ethOut', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'sya',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'RouteNotConfigured', inputs: [{ name: 'token', type: 'address' }] },
  {
    type: 'error',
    name: 'InsufficientEthOut',
    inputs: [
      { name: 'ethOut', type: 'uint256' },
      { name: 'minEthOut', type: 'uint256' },
    ],
  },
  { type: 'error', name: 'NotPoolManager', inputs: [] },
  { type: 'error', name: 'EthPoolNotSet', inputs: [] },
  { type: 'error', name: 'EthTransferFailed', inputs: [] },
  {
    type: 'error',
    name: 'Unprofitable',
    inputs: [
      { name: 'ethOut', type: 'uint256' },
      { name: 'gasCost', type: 'uint256' },
    ],
  },
  // OZ ERC1155 errors surfaced through the claim-NFT pull.
  {
    type: 'error',
    name: 'ERC1155MissingApprovalForAll',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
  },
  {
    type: 'error',
    name: 'ERC1155InsufficientBalance',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'balance', type: 'uint256' },
      { name: 'needed', type: 'uint256' },
      { name: 'tokenId', type: 'uint256' },
    ],
  },
] as const;
