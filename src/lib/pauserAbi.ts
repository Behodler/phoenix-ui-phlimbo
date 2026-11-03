/**
 * Pauser Contract ABI
 *
 * ABI for the generalized Pauser contract from pauser-RM
 * The Pauser contract allows anyone to pause registered contracts by burning a configurable amount of EYE tokens
 * This is the new generalized version that supports multiple projects and configurable EYE cost
 */
export const pauserAbi = [
  {
    type: 'function',
    inputs: [],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'eyeBurnAmount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'eyeToken',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getPausableContracts',
    outputs: [{ name: '', internalType: 'address[]', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'isRegistered',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'pausableContract', internalType: 'address', type: 'address' }],
    name: 'register',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'pausableContract', internalType: 'address', type: 'address' }],
    name: 'unregister',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newBurnAmount', internalType: 'uint256', type: 'uint256' },
      { name: 'newTokenAddress', internalType: 'address', type: 'address' }
    ],
    name: 'config',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  // ---------------------------------------------------------------------------
  // PauserV2 additions (pauser-RM IPauserV2.sol). A V1 Pauser has none of these:
  // `health()` reverts against V1, which is how the UI detects V2 (see
  // usePauserHealth). The events never appear in a V1 receipt.
  // ---------------------------------------------------------------------------
  {
    type: 'function',
    inputs: [],
    name: 'health',
    outputs: [
      { name: 'notPauser', internalType: 'address[]', type: 'address[]' },
      { name: 'alreadyPaused', internalType: 'address[]', type: 'address[]' },
      { name: 'noPausedGetter', internalType: 'address[]', type: 'address[]' },
      { name: 'unreachable', internalType: 'address[]', type: 'address[]' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'c', internalType: 'address', type: 'address', indexed: true },
      { name: 'reason', internalType: 'enum IPauserV2.SkipReason', type: 'uint8', indexed: false },
    ],
    name: 'PauseSkipped',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'c', internalType: 'address', type: 'address', indexed: true },
      { name: 'reason', internalType: 'enum IPauserV2.SkipReason', type: 'uint8', indexed: false },
    ],
    name: 'UnpauseSkipped',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'c', internalType: 'address', type: 'address', indexed: true },
      { name: 'reason', internalType: 'bytes', type: 'bytes', indexed: false },
    ],
    name: 'UnpauseFailed',
  },
] as const;

/**
 * PauserV2 `SkipReason` enum (IPauserV2.sol), indexed by its uint8 value.
 * Shared by the Safety tab and the Admin Pauser panel so the copy stays in one place.
 */
export const SKIP_REASONS = [
  { name: 'NO_CODE', label: 'No contract code at this address' },
  { name: 'NOT_PAUSER', label: 'Contract no longer accepts this Pauser' },
  { name: 'ALREADY_PAUSED', label: 'Already paused' },
  { name: 'NOT_PAUSED', label: 'Was not paused' },
  { name: 'UNREACHABLE', label: 'Pauser pre-check call failed' },
] as const;

export type SkipReasonName = (typeof SKIP_REASONS)[number]['name'];

/** Human-readable label for a raw SkipReason value; tolerates unknown values. */
export function skipReasonLabel(reason: number): { name: string; label: string } {
  return SKIP_REASONS[reason] ?? { name: `UNKNOWN_${reason}`, label: `Unknown reason (${reason})` };
}
