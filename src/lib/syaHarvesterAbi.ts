/**
 * SYAHarvester ABI (the subset the Forge tab uses).
 *
 * Hand-written from `phase-2-staging/lib/sya-harvester/src/SYAHarvester.sol`
 * because `@behodler/phase2-wagmi-hooks@0.19.0` does not export the
 * harvester. Replace with the package export once a release ships it.
 *
 * The custom errors are listed so viem can decode a reverted simulation or
 * transaction by name. The Forge quote simulates at a zero gas price, so it
 * never hits `Unprofitable`; that error only surfaces if gas spikes between
 * quote and inclusion. `GAS_OVERHEAD` feeds the client-side profit check.
 *
 * `harvest` still takes an `nftIndex`, but the gate-free SYA (phStaging2 story
 * 131) ignores it and the UI always passes `0`, so no claim NFT ever moves.
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
    name: 'GAS_OVERHEAD',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
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
] as const;
