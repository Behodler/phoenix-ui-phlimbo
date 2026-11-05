import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { pauserAbi } from '../lib/pauserAbi';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import {
  computeCoverage,
  normaliseHealth,
  type Address,
  type PauserCoverage,
  type PauserHealthLists,
} from '../lib/pauserHealth';

export interface PauserHealthState {
  /** True only when `health()` returned four address arrays, i.e. the Pauser is V2. */
  supported: boolean;
  loading: boolean;
  notPauser: readonly Address[];
  alreadyPaused: readonly Address[];
  noPausedGetter: readonly Address[];
  unreachable: readonly Address[];
  /** M: `getPausableContracts().length`. 0 until loaded. */
  registered: number;
  /** N: registered contracts the global pause is expected to reach. */
  reachable: number;
  coverage: PauserCoverage | null;
  health: PauserHealthLists | null;
  refetch: () => void;
}

const EMPTY: readonly Address[] = [];

/**
 * Capability-gated read of PauserV2's `health()`.
 *
 * V2 is detected by the read succeeding, never by address or chain: a V1 Pauser has
 * no `health()`, the call reverts, and `supported` is false. `retry: false` makes
 * that V1 revert fail fast (one call, no back-off hammering the RPC), and callers
 * render nothing in that case: no toast, no error text.
 */
export function usePauserHealth(): PauserHealthState {
  const { addresses } = useContractAddresses();
  const pauser = addresses?.Pauser as Address | undefined;
  const enabled = !!pauser && !/^0x0{40}$/i.test(pauser);

  const healthRead = useReadContract({
    address: enabled ? pauser : undefined,
    abi: pauserAbi,
    functionName: 'health',
    query: { enabled, retry: false, refetchOnWindowFocus: false },
  });

  const health = useMemo(
    () => (healthRead.error ? null : normaliseHealth(healthRead.data)),
    [healthRead.data, healthRead.error],
  );

  // Only worth reading the registry when V2 answered.
  const registryRead = useReadContract({
    address: enabled ? pauser : undefined,
    abi: pauserAbi,
    functionName: 'getPausableContracts',
    query: { enabled: enabled && !!health, retry: false },
  });

  const registeredList = Array.isArray(registryRead.data) ? (registryRead.data as readonly Address[]) : undefined;

  const coverage = useMemo(
    () => (health && registeredList ? computeCoverage(health, registeredList) : null),
    [health, registeredList],
  );

  const supported = !!health && !!coverage;
  const { refetch: refetchHealth } = healthRead;
  const { refetch: refetchRegistry } = registryRead;

  return {
    supported,
    loading: !!healthRead.isLoading || (!!health && !!registryRead.isLoading),
    notPauser: health?.notPauser ?? EMPTY,
    alreadyPaused: health?.alreadyPaused ?? EMPTY,
    noPausedGetter: health?.noPausedGetter ?? EMPTY,
    unreachable: health?.unreachable ?? EMPTY,
    registered: coverage?.registered ?? 0,
    reachable: coverage?.reachable ?? 0,
    coverage,
    health,
    refetch: () => {
      void refetchHealth?.();
      void refetchRegistry?.();
    },
  };
}
