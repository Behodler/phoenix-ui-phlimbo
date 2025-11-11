/**
 * Pauser Contract ABI
 *
 * Minimal ABI for the Pauser contract from behodler3-tokenlaunch-RM:040
 * The Pauser contract allows anyone to pause the Behodler application by burning 1000 EYE tokens
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
    name: 'eyeQuantityToPause',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'behodler',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
] as const;
