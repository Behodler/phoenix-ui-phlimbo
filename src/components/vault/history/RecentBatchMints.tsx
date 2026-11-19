import { useMemo } from 'react';
import { useEventHistory } from '../../../hooks/useEventHistory';
import RecentHistorySection, {
  AddressLink,
  AgeLink,
  HistoryCardList,
  HistoryRowCard,
  HistoryTable,
  HistoryTableRow,
  NftIcon,
  StatTiles,
  SummaryLine,
} from './RecentHistorySection';
import {
  BATCH_MINT_USDC_DECIMALS,
  FREE_GREEN,
  discountPercent,
  formatCount,
  formatTokenAmount,
  formatUtcDate,
  newestFirst,
  summarizeBatchMints,
  toBigInt,
} from './historyFormat';
import { LIQUID_SKY_PHOENIX_DISPATCHER_INDEX, historyNftFor } from './historyNfts';

const TEMPLATE = '70px minmax(0,1fr) 56px 56px 110px 56px';

/**
 * "Recent batch mints" under the NFT › Whale discount panel. Every batch mint is
 * Liquid Sky Phoenix. `divider` is off when the host already frames it in its own card.
 */
export default function RecentBatchMints({ divider = true }: { divider?: boolean } = {}) {
  const { history, isLoading } = useEventHistory();
  const rows = useMemo(() => newestFirst(history?.batchMints ?? []), [history]);
  const summary = useMemo(() => summarizeBatchMints(rows), [rows]);
  const lsp = historyNftFor(LIQUID_SKY_PHOENIX_DISPATCHER_INDEX);
  const nowMs = Date.now();

  return (
    <RecentHistorySection
      id="batch-mints"
      divider={divider}
      title="Recent batch mints"
      icon={<NftIcon image={lsp.image} size={30} />}
      subtitle={lsp.name}
      status={isLoading ? 'loading' : history ? 'ready' : 'unavailable'}
      total={rows.length}
      emptyText="No batch mints yet — history starts 18 Nov 2026"
      generatedAt={history?.generatedAt}
      summary={
        <>
          <StatTiles
            tiles={[
              { label: 'NFTs minted', value: formatCount(summary.mintedTotal) },
              { label: 'Of which free', value: formatCount(summary.freeTotal), color: FREE_GREEN },
              { label: 'Avg. discount', value: summary.batches > 0 ? `${summary.avgDiscountPercent}%` : '—' },
            ]}
          />
          {summary.firstTimestamp !== null && (
            <SummaryLine>
              {formatCount(summary.batches)} batch{summary.batches === 1 ? '' : 'es'} since{' '}
              {formatUtcDate(summary.firstTimestamp)}
            </SummaryLine>
          )}
        </>
      }
      renderRows={(visible) => {
        const shown = rows.slice(0, visible).map((r) => {
          const free = toBigInt(r.free);
          const paid = toBigInt(r.paid);
          return {
            row: r,
            free: formatCount(free),
            paid: formatCount(paid),
            total: formatCount(free + paid),
            cost: formatTokenAmount(r.paidCost, BATCH_MINT_USDC_DECIMALS),
            disc: `${discountPercent(free, paid)}%`,
          };
        });
        return (
          <>
            <HistoryTable
              template={TEMPLATE}
              columns={[
                { label: 'When' },
                { label: 'Recipient' },
                { label: 'Free', align: 'right' },
                { label: 'Paid', align: 'right' },
                { label: 'Cost · USDC', align: 'right' },
                { label: 'Disc.', align: 'right' },
              ]}
            >
              {shown.map(({ row: r, free, paid, cost, disc }) => (
                <HistoryTableRow key={`${r.txHash}:${r.logIndex}`} template={TEMPLATE}>
                  <AgeLink timestamp={r.timestamp} txHash={r.txHash} nowMs={nowMs} />
                  <span className="min-w-0 truncate">
                    <AddressLink address={r.recipient} />
                  </span>
                  <span className="text-right" style={{ color: FREE_GREEN }}>
                    {free}
                  </span>
                  <span className="text-right">{paid}</span>
                  <span className="text-right">{cost}</span>
                  <span className="text-right">{disc}</span>
                </HistoryTableRow>
              ))}
            </HistoryTable>
            <HistoryCardList>
              {shown.map(({ row: r, free, total, cost, disc }) => (
                <HistoryRowCard
                  key={`${r.txHash}:${r.logIndex}`}
                  line1Left={
                    <>
                      <span className="font-semibold">{total} NFTs</span>{' '}
                      <span style={{ color: FREE_GREEN }}>· {free} free</span>
                    </>
                  }
                  line1Right={<span className="font-semibold">{cost} USDC</span>}
                  line2Left={<AddressLink address={r.recipient} />}
                  line2Right={
                    <AgeLink timestamp={r.timestamp} txHash={r.txHash} nowMs={nowMs} suffix={` · ${disc} off`} />
                  }
                />
              ))}
            </HistoryCardList>
          </>
        );
      }}
    />
  );
}
