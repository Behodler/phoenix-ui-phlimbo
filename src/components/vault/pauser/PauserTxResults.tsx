import { useMemo } from 'react';
import { useContractAddresses } from '../../../contexts/ContractAddressContext';
import { buildAddressNameMap, type PauserTxRow } from '../../../lib/pauserHealth';
import AddressLabel from './AddressLabel';

export interface PauserTxResult {
  kind: 'pause' | 'unpause';
  txHash: string;
  rows: PauserTxRow[];
}

/**
 * Per-contract results of an owner `unpause()` (or `pause()`) on PauserV2, decoded
 * from the receipt's `UnpauseSkipped` / `UnpauseFailed` (or `PauseSkipped`) events.
 */
export default function PauserTxResults({ result }: { result: PauserTxResult }) {
  const { addresses } = useContractAddresses();
  const names = useMemo(() => buildAddressNameMap(addresses), [addresses]);
  const hasFailures = result.rows.some((r) => r.outcome === 'failed');
  const verb = result.kind === 'unpause' ? 'unpaused' : 'paused';

  return (
    <div data-testid="pauser-tx-results" className="bg-card border border-border rounded-lg p-4 mt-4">
      <h3 className="text-sm font-semibold text-foreground mb-2">
        {result.kind === 'unpause' ? 'Unpause' : 'Pause'} results
      </h3>
      {result.rows.length === 0 ? (
        <p className="text-sm text-green-400">All registered contracts {verb}</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Contract</th>
              <th className="py-1 font-medium">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={`${row.address}-${i}`} className="border-t border-border align-top">
                <td className="py-1 pr-3">
                  <AddressLabel address={row.address} names={names} />
                </td>
                <td className="py-1">
                  {row.outcome === 'skipped' ? (
                    <span className="text-yellow-400">
                      Skipped — {row.reasonName}: {row.reasonLabel}
                    </span>
                  ) : (
                    <span className="text-red-400 break-all" title={row.revertData}>
                      Failed — {row.revertReason}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {hasFailures && (
        <p className="text-xs text-yellow-400 mt-3">
          Some contracts refused to unpause. Re-run <code>unpause()</code> later to retry: it is the PauserV2
          recovery path (for example, PhlimboV3 refuses <code>unpause()</code> while a promotion is flushing).
        </p>
      )}
    </div>
  );
}
