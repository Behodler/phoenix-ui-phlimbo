import { useMemo } from 'react';
import { useEventHistory } from '../../../hooks/useEventHistory';
import { ANTIMATTER_DISPLAY_NAME } from '../../../data/antimatterData';
import RecentHistorySection, {
  AddressLink,
  AgeLink,
  HistoryCardList,
  HistoryRowCard,
  HistoryTable,
  HistoryTableRow,
  NftIcon,
  StatTiles,
} from './RecentHistorySection';
import {
  ANTIMATTER_DECIMALS,
  BONFIRE_COLOR,
  formatCount,
  formatTokenAmount,
  newestFirst,
  summarizeBurns,
} from './historyFormat';
import { historyNftFor } from './historyNfts';

const TEMPLATE = '70px minmax(0,1.5fr) minmax(0,1fr) 120px';

/** "Recent burns" under the Forge › Burn NFTs for Antimatter (Bonfire) row. */
export default function RecentBurns() {
  const { history, isLoading } = useEventHistory();
  const rows = useMemo(() => newestFirst(history?.bonfireBurns ?? []), [history]);
  const nowMs = Date.now();
  const summary = summarizeBurns(rows, nowMs);

  return (
    <RecentHistorySection
      id="bonfire-burns"
      title="Recent burns"
      status={isLoading ? 'loading' : history ? 'ready' : 'unavailable'}
      total={rows.length}
      emptyText="No burns yet."
      generatedAt={history?.generatedAt}
      summary={
        <StatTiles
          tiles={[
            { label: 'Burns · 7d', value: formatCount(summary.burns7d) },
            {
              label: 'Last payout',
              value: summary.lastPayoutRaw === null ? '—' : formatTokenAmount(summary.lastPayoutRaw, ANTIMATTER_DECIMALS),
              color: BONFIRE_COLOR,
            },
            {
              label: 'Total paid',
              value: formatTokenAmount(summary.totalPaidRaw, ANTIMATTER_DECIMALS),
              color: BONFIRE_COLOR,
            },
          ]}
        />
      }
      renderRows={(visible) => {
        const shown = rows.slice(0, visible);
        return (
          <>
            <HistoryTable
              template={TEMPLATE}
              columns={[
                { label: 'When' },
                { label: 'NFT burned' },
                { label: 'Burner' },
                { label: `${ANTIMATTER_DISPLAY_NAME} paid`, align: 'right' },
              ]}
            >
              {shown.map((r) => {
                const nft = historyNftFor(r.tokenId);
                return (
                  <HistoryTableRow key={`${r.txHash}:${r.logIndex}`} template={TEMPLATE}>
                    <AgeLink timestamp={r.timestamp} txHash={r.txHash} nowMs={nowMs} />
                    <span className="flex min-w-0 items-center gap-2.5">
                      <NftIcon image={nft.image} size={30} />
                      <span className="truncate font-semibold">{nft.name}</span>
                    </span>
                    <span className="min-w-0 truncate">
                      <AddressLink address={r.burner} />
                    </span>
                    <span className="text-right" style={{ color: BONFIRE_COLOR }}>
                      {formatTokenAmount(r.payout, ANTIMATTER_DECIMALS)}
                    </span>
                  </HistoryTableRow>
                );
              })}
            </HistoryTable>
            <HistoryCardList>
              {shown.map((r) => {
                const nft = historyNftFor(r.tokenId);
                return (
                  <HistoryRowCard
                    key={`${r.txHash}:${r.logIndex}`}
                    leading={<NftIcon image={nft.image} size={36} />}
                    line1Left={<span className="font-semibold">{nft.name}</span>}
                    line1Right={
                      <span className="font-semibold" style={{ color: BONFIRE_COLOR }}>
                        {formatTokenAmount(r.payout, ANTIMATTER_DECIMALS)}
                      </span>
                    }
                    line2Left={<AddressLink address={r.burner} />}
                    line2Right={<AgeLink timestamp={r.timestamp} txHash={r.txHash} nowMs={nowMs} />}
                  />
                );
              })}
            </HistoryCardList>
          </>
        );
      }}
    />
  );
}
