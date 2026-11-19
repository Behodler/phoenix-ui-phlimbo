import { useMemo } from 'react';
import { useEventHistory } from '../../../hooks/useEventHistory';
import { ANTIMATTER_DISPLAY_NAME } from '../../../data/antimatterData';
import RecentHistorySection, {
  AddressLink,
  AgeLink,
  HistoryCardList,
  HistoryPill,
  HistoryRowCard,
  HistoryTable,
  HistoryTableRow,
  StatTiles,
  SummaryLine,
  TokenTag,
} from './RecentHistorySection';
import {
  ANTIMATTER_COLOR,
  ANTIMATTER_DECIMALS,
  PHUSD_DECIMALS,
  formatCount,
  formatStable,
  formatTokenAmount,
  newestFirst,
  summarizeAnnihilations,
} from './historyFormat';

const TEMPLATE = '64px minmax(0,1fr) 90px 130px 100px 56px';

const viaLabel = (source: string) => (source === 'stake' ? 'Stake' : 'Forge');

/** "Recent annihilations" under the Forge › Annihilate row (Forge and Stake-tab annihilations). */
export default function RecentAnnihilations() {
  const { history, isLoading } = useEventHistory();
  const rows = useMemo(() => newestFirst(history?.annihilations ?? []), [history]);
  const summary = useMemo(() => summarizeAnnihilations(rows), [rows]);
  const tokens = history?.tokens ?? {};
  const nowMs = Date.now();

  return (
    <RecentHistorySection
      id="annihilations"
      title="Recent annihilations"
      status={isLoading ? 'loading' : history ? 'ready' : 'unavailable'}
      total={rows.length}
      emptyText="No annihilations yet."
      generatedAt={history?.generatedAt}
      summary={
        <>
          <StatTiles
            tiles={[
              {
                label: `${ANTIMATTER_DISPLAY_NAME} annihilated`,
                value: formatTokenAmount(summary.antimatterRaw, ANTIMATTER_DECIMALS),
                color: ANTIMATTER_COLOR,
              },
              { label: 'phUSD delivered', value: formatTokenAmount(summary.phUSDRaw, PHUSD_DECIMALS) },
            ]}
          />
          {summary.count > 0 && (
            <SummaryLine>
              {formatCount(summary.count)} annihilation{summary.count === 1 ? '' : 's'} ·{' '}
              {formatCount(summary.viaForge)} via Forge, {formatCount(summary.viaStake)} via Stake
            </SummaryLine>
          )}
        </>
      }
      renderRows={(visible) => {
        const shown = rows.slice(0, visible);
        return (
          <>
            <HistoryTable
              template={TEMPLATE}
              columns={[
                { label: 'When' },
                { label: 'Who' },
                { label: ANTIMATTER_DISPLAY_NAME, align: 'right' },
                { label: '+ Stablecoin', align: 'right' },
                { label: 'phUSD out', align: 'right' },
                { label: 'Via', align: 'right' },
              ]}
            >
              {shown.map((r) => {
                const stable = formatStable(tokens, r);
                return (
                  <HistoryTableRow key={`${r.txHash}:${r.logIndex}`} template={TEMPLATE}>
                    <AgeLink timestamp={r.timestamp} txHash={r.txHash} nowMs={nowMs} />
                    <span className="min-w-0 truncate">
                      <AddressLink address={r.user} />
                    </span>
                    <span className="text-right" style={{ color: ANTIMATTER_COLOR }}>
                      {formatTokenAmount(r.amount, ANTIMATTER_DECIMALS)}
                    </span>
                    <span className="text-right">
                      {stable.amount}
                      <TokenTag>{stable.symbol}</TokenTag>
                    </span>
                    <span className="text-right">{formatTokenAmount(r.phUSDAmount, PHUSD_DECIMALS)}</span>
                    <span className="text-right">
                      <HistoryPill>{viaLabel(r.source)}</HistoryPill>
                    </span>
                  </HistoryTableRow>
                );
              })}
            </HistoryTable>
            <HistoryCardList>
              {shown.map((r) => {
                const stable = formatStable(tokens, r);
                return (
                  <HistoryRowCard
                    key={`${r.txHash}:${r.logIndex}`}
                    line1Left={
                      <>
                        <span className="font-semibold" style={{ color: ANTIMATTER_COLOR }}>
                          {formatTokenAmount(r.amount, ANTIMATTER_DECIMALS)}
                        </span>{' '}
                        <span className="text-muted-foreground">→</span>{' '}
                        {formatTokenAmount(r.phUSDAmount, PHUSD_DECIMALS)} phUSD
                      </>
                    }
                    line1Right={<HistoryPill>{viaLabel(r.source)}</HistoryPill>}
                    line2Left={<AddressLink address={r.user} />}
                    line2Right={
                      <AgeLink
                        timestamp={r.timestamp}
                        txHash={r.txHash}
                        nowMs={nowMs}
                        suffix={` · with ${stable.symbol}`}
                      />
                    }
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
