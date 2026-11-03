import { useMemo, useState } from 'react';
import { usePauserHealth } from '../../../hooks/usePauserHealth';
import { useContractAddresses } from '../../../contexts/ContractAddressContext';
import { buildAddressNameMap, groupProblems, PROBLEM_CATEGORY_COPY } from '../../../lib/pauserHealth';
import AddressLabel from './AddressLabel';

/**
 * Safety tab coverage indicator: "Emergency stop reaches N of M registered contracts".
 *
 * Capability-gated: renders nothing unless the Pauser answers PauserV2's `health()`.
 * Against a V1 Pauser (mainnet until phlimbo-ui:094) it is silently absent.
 */
export default function PauserCoverageIndicator() {
  const health = usePauserHealth();
  const { addresses } = useContractAddresses();
  const [expanded, setExpanded] = useState(false);
  const names = useMemo(() => buildAddressNameMap(addresses), [addresses]);

  if (!health.supported || !health.coverage || !health.health) return null;

  const { reachable, registered, healthy } = health.coverage;
  // Only list problems among registered contracts, matching N.
  const problemSet = new Set(health.coverage.problems.map((a) => a.toLowerCase()));
  const groups = groupProblems(health.health)
    .map((g) => ({ ...g, addresses: g.addresses.filter((a) => problemSet.has(a.toLowerCase())) }))
    .filter((g) => g.addresses.length > 0);

  return (
    <div
      data-testid="pauser-coverage"
      className={`rounded-lg p-4 mb-6 border ${
        healthy ? 'bg-green-900/20 border-green-600' : 'bg-yellow-900/20 border-yellow-500'
      }`}
    >
      <div className="flex justify-between items-center gap-3">
        <p className={`text-sm font-semibold ${healthy ? 'text-green-400' : 'text-yellow-400'}`}>
          Emergency stop reaches {reachable} of {registered} registered contracts
        </p>
        {groups.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-accent hover:text-accent/80 underline shrink-0"
            aria-expanded={expanded}
          >
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        )}
      </div>

      {expanded && groups.length > 0 && (
        <div className="mt-3 space-y-3">
          {groups.map(({ category, addresses: list }) => (
            <div key={category}>
              <p className="text-xs font-semibold text-foreground">{PROBLEM_CATEGORY_COPY[category].title}</p>
              <p className="text-xs text-muted-foreground mb-1">{PROBLEM_CATEGORY_COPY[category].description}</p>
              <ul className="space-y-1 text-xs">
                {list.map((a) => (
                  <li key={a}>
                    <AddressLabel address={a} names={names} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {health.noPausedGetter.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          {health.noPausedGetter.length} contract{health.noPausedGetter.length === 1 ? '' : 's'} cannot report
          pause state (informational).
        </p>
      )}
    </div>
  );
}
