import { useMemo } from 'react';
import type { PauserHealthState } from '../../../hooks/usePauserHealth';
import { useContractAddresses } from '../../../contexts/ContractAddressContext';
import { buildAddressNameMap, PROBLEM_CATEGORY_COPY } from '../../../lib/pauserHealth';
import AddressLabel from './AddressLabel';

const LISTS = ['notPauser', 'alreadyPaused', 'unreachable', 'noPausedGetter'] as const;

/**
 * Admin Pauser panel: the four `health()` lists. The caller renders this only when
 * `usePauserHealth` reports `supported` (i.e. the Pauser is V2).
 */
export default function PauserHealthPanel({ health }: { health: PauserHealthState }) {
  const { addresses } = useContractAddresses();
  const names = useMemo(() => buildAddressNameMap(addresses), [addresses]);
  if (!health.supported) return null;

  return (
    <div data-testid="pauser-health-panel" className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          PauserV2 health — reaches {health.reachable} of {health.registered} registered contracts
        </h3>
        <button
          type="button"
          onClick={health.refetch}
          className="text-xs text-accent hover:text-accent/80 underline"
        >
          Refresh
        </button>
      </div>
      <div className="space-y-3">
        {LISTS.map((key) => {
          const list = health[key];
          return (
            <div key={key}>
              <p className="text-xs font-semibold text-foreground">
                {PROBLEM_CATEGORY_COPY[key].title} ({list.length})
              </p>
              <p className="text-xs text-muted-foreground mb-1">{PROBLEM_CATEGORY_COPY[key].description}</p>
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">None</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {list.map((a) => (
                    <li key={a}>
                      <AddressLabel address={a} names={names} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
