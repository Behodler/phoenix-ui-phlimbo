import { useCallback, useMemo, useState, type ReactNode } from 'react';
import ActionButton from '../../ui/ActionButton';
import { nftStaticConfig } from '../../../data/nftMockData';
import type { ForgeHarvestState } from '../../../hooks/useForgeHarvest';
import ForgeNftPicker from './ForgeNftPicker';
import ForgeNftPickerModal from './ForgeNftPickerModal';
import { buildForgeNftOptions, fmt2, fmtSigned4, harvestQuote } from './forgeFormat';

const PINK = '#FF4D6D';
const YELLOW = '#FFD93D';
const PROFIT_GRADIENT = 'linear-gradient(90deg,#FF8C42,#FFD93D)';

export interface HarvestToolProps {
  /** Live state from `useForgeHarvest`, owned by ForgeTab so the row header can share it. */
  state: ForgeHarvestState;
}

/** What the button says when there is no quote, keyed by the reason. */
const BLOCKER_LABEL = {
  inactive: 'Harvester not live on this network',
  disconnected: 'Connect your wallet',
  loading: 'Loading…',
  'no-nft': 'You hold none of this claim NFT',
} as const;

/**
 * Body of the Forge "Harvest Yield" row (SYAHarvester). Presentational: the
 * quote is a fee-carrying simulation of `harvest()` taken by `useForgeHarvest`.
 */
export default function HarvestTool({ state }: HarvestToolProps) {
  const { requiresNft, nftHoldings, selectedNftId, setSelectedNftId, nftApproved, blocker, quote, display, pendingAction } =
    state;

  const nfts = useMemo(() => buildForgeNftOptions(nftStaticConfig, nftHoldings), [nftHoldings]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedNft = nfts.find((n) => n.id === selectedNftId) ?? nfts[0];
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const { profit, profitable, gasPct, profitPct } = display
    ? { ...harvestQuote(display, 10_000), profitable: display.profitable }
    : { profit: 0, profitable: false, gasPct: 0, profitPct: 0 };
  const hasNumbers = display !== null;
  const profitColor = !hasNumbers ? 'text-muted-foreground' : profitable ? 'text-green-400' : 'text-pxusd-pink-400';
  const gasStr = display ? display.gasEth.toFixed(4) : '—';
  const ethOutStr = display ? display.ethOut.toFixed(4) : '—';
  const gasLabel = display
    ? `Est. gas (${Math.round(display.gasUnits / 1000)}k @ ${display.gasGwei.toFixed(display.gasGwei < 1 ? 3 : 1)} gwei)`
    : 'Est. gas';
  const busy = pendingAction !== null;

  let button: { label: string; disabled: boolean; variant: 'primary' | 'approve'; onAction: () => void };
  if (blocker === 'needs-approval') {
    button = {
      label: pendingAction === 'approve' ? 'Approving…' : 'Approve NFTs for the Harvester',
      disabled: busy,
      variant: 'approve',
      onAction: () => void state.approveNfts(),
    };
  } else if (blocker !== null) {
    button = { label: BLOCKER_LABEL[blocker], disabled: true, variant: 'primary', onAction: () => {} };
  } else if (!quote) {
    button = { label: 'Fetching quote…', disabled: true, variant: 'primary', onAction: () => {} };
  } else if (quote.kind === 'error') {
    button = { label: 'Harvest unavailable', disabled: true, variant: 'primary', onAction: () => {} };
  } else if (!profitable) {
    button = { label: 'Not profitable right now', disabled: true, variant: 'primary', onAction: () => {} };
  } else {
    button = {
      label: pendingAction === 'harvest' ? 'Harvesting…' : `Harvest → receive ~${ethOutStr} ETH`,
      disabled: busy,
      variant: 'primary',
      onAction: () => void state.harvest(),
    };
  }

  const showSteps = requiresNft && (blocker === 'needs-approval' || profitable);
  const approved = nftApproved;

  return (
    <>
      <p className="max-w-[68ch] text-[13px] leading-[1.55] text-muted-foreground">
        Phoenix strategies build up yield over time. The Harvester claims that yield at the Yield Funnel's discount,
        sells it and pays you the profit in ETH. It all happens in one transaction with borrowed liquidity, so you
        need nothing upfront except gas.
      </p>

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        {/* Left column: the numbers */}
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Estimated profit
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span
                data-testid="harvest-profit"
                className={`font-mono text-[34px] font-light tracking-[-0.02em] tabular-nums ${profitColor}`}
              >
                {hasNumbers ? fmtSigned4(profit) : '—'}
              </span>
              <span className="text-sm text-muted-foreground">ETH</span>
            </div>
          </div>

          <div>
            <div
              role="img"
              aria-label={
                profitable
                  ? `Gas ${gasStr} ETH of a ${ethOutStr} ETH payout; your profit is the rest`
                  : `Gas ${gasStr} ETH exceeds the ${ethOutStr} ETH payout`
              }
              className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]"
            >
              <span data-testid="harvest-bar-gas" style={{ width: `${gasPct}%`, background: PINK }} />
              {profitable && (
                <span data-testid="harvest-bar-profit" style={{ width: `${profitPct}%`, background: PROFIT_GRADIENT }} />
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: PINK }} />
                Gas {gasStr} ETH
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: PROFIT_GRADIENT }} />
                Your profit
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <StatRow label="Yield available">{state.yieldUsd === null ? '—' : `$${fmt2(state.yieldUsd)}`}</StatRow>
            <StatRow label="ETH paid to you">{display ? `${ethOutStr} ETH` : '—'}</StatRow>
            <StatRow label={gasLabel}>
              <span className="text-pxusd-pink-400">{display ? `−${gasStr} ETH` : '—'}</span>
            </StatRow>
            <StatRow label="Minimum ETH out">
              {display?.profitable ? `${display.minEthOut.toFixed(4)} ETH` : '—'}
            </StatRow>
          </div>
        </div>

        {/* Right column: NFT, warnings, action */}
        <div className="flex min-w-0 flex-col gap-3">
          {requiresNft && (
            <div data-testid="harvest-nft-block" className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                  Claim NFT
                </span>
                <span className="text-[11.5px] text-muted-foreground opacity-70">1 is burned per harvest</span>
              </div>
              <ForgeNftPicker nft={selectedNft} onClick={() => setPickerOpen(true)} />
            </div>
          )}

          <div
            className="rounded-xl border p-3.5 text-[12.5px] leading-[1.5] text-muted-foreground"
            style={{ borderColor: 'rgba(255,217,61,.3)', background: 'rgba(255,217,61,.06)' }}
          >
            <strong style={{ color: YELLOW }}>Estimates, not guarantees.</strong> Gas prices can rise before your
            transaction lands, and a bot can harvest the same yield first. If the payout drops below your minimum the
            harvest reverts, and you still pay gas. A private RPC such as Flashbots Protect reduces front-running.
          </div>

          {hasNumbers && !profitable && (
            <div
              role="alert"
              className="rounded-xl border p-3.5 text-[12.5px] leading-[1.5] text-muted-foreground"
              style={{ borderColor: 'rgba(255,77,109,.35)', background: 'rgba(255,77,109,.07)' }}
            >
              <strong className="text-pxusd-pink-400">Not profitable.</strong> Gas ({gasStr} ETH) would cost more
              than the harvest pays ({ethOutStr} ETH). Check back once more yield has built up.
            </div>
          )}

          {quote?.kind === 'error' && (
            <div
              role="alert"
              className="rounded-xl border p-3.5 text-[12.5px] leading-[1.5] text-muted-foreground"
              style={{ borderColor: 'rgba(255,77,109,.35)', background: 'rgba(255,77,109,.07)' }}
            >
              <strong className="text-pxusd-pink-400">Harvest would fail.</strong> {quote.message}
            </div>
          )}

          {blocker === 'needs-approval' && (
            <p className="text-[12px] text-muted-foreground">
              The quote is a simulation of the real harvest, so it can only run once the Harvester may take your
              claim NFT.
            </p>
          )}

          {showSteps && (
            <ol data-testid="harvest-steps" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              <Step state={approved ? 'done' : 'current'}>Approve NFTs (once)</Step>
              <Step state={approved ? 'current' : 'pending'}>Harvest</Step>
            </ol>
          )}

          <div className="-mt-3">
            <ActionButton
              disabled={button.disabled}
              onAction={button.onAction}
              label={button.label}
              variant={button.variant}
            />
          </div>
        </div>
      </div>

      {requiresNft && (
        <ForgeNftPickerModal
          isOpen={pickerOpen}
          onClose={closePicker}
          title="Choose a claim NFT"
          footer="The Yield Funnel burns one unit of the NFT you choose. Any type works."
          nfts={nfts}
          selectedId={selectedNft.id}
          onSelect={setSelectedNftId}
        />
      )}
    </>
  );
}

function StatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono tabular-nums text-pxusd-white">{children}</span>
    </div>
  );
}

function Step({ state, children }: { state: 'done' | 'current' | 'pending'; children: string }) {
  const textClass =
    state === 'done' ? 'text-green-400' : state === 'current' ? 'text-pxusd-white' : 'text-muted-foreground';
  const dotStyle =
    state === 'done'
      ? { background: '#4ade80' }
      : state === 'current'
        ? { background: '#FF8C42', boxShadow: '0 0 6px rgba(255,140,66,.6)' }
        : { background: 'rgba(255,255,255,.25)' };
  return (
    <li data-state={state} className={`flex items-center gap-1.5 font-semibold ${textClass}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={dotStyle} />
      {children}
    </li>
  );
}
