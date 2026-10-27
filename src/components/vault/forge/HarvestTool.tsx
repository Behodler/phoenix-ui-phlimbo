import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useToast } from '../../ui/ToastProvider';
import ActionButton from '../../ui/ActionButton';
import {
  FORGE_HARVEST_DEFAULT_NFT_ID,
  FORGE_HARVEST_MIN_OUT_BPS,
  FORGE_HARVEST_MOCK,
  FORGE_HARVEST_REQUIRES_NFT,
  FORGE_HARVEST_SCENARIO,
  FORGE_MOCK_ETH_USD,
  FORGE_MOCK_NFT_HOLDINGS,
  type ForgeHarvestScenario,
} from '../../../data/forgeMockData';
import { nftStaticConfig } from '../../../data/nftMockData';
import ForgeNftPicker from './ForgeNftPicker';
import ForgeNftPickerModal from './ForgeNftPickerModal';
import { buildForgeNftOptions, fmt2, fmtSigned4, harvestQuote } from './forgeFormat';

const PINK = '#FF4D6D';
const YELLOW = '#FFD93D';
const PROFIT_GRADIENT = 'linear-gradient(90deg,#FF8C42,#FFD93D)';

/** Arguments of `SYAHarvester.harvest`, in human units. The live-wiring story converts to wei. */
export interface HarvestMockCall {
  exemptStrategies: readonly `0x${string}`[];
  nftIndex: number;
  minEthOut: number;
}

export interface HarvestToolProps {
  /** Whether the harvester still burns a claim NFT. Defaults to FORGE_HARVEST_REQUIRES_NFT. */
  requiresNft?: boolean;
  /** Which mock quote to show. Defaults to FORGE_HARVEST_SCENARIO. */
  scenario?: ForgeHarvestScenario;
  /** Wallet NFT holdings, tokenId → units. Defaults to FORGE_MOCK_NFT_HOLDINGS. */
  nftHoldings?: Record<number, number>;
}

/**
 * Body of the Forge "Harvest Yield" row (SYA harvester). MOCKED: no contract
 * reads or writes. Approve/harvest step through their states locally and toast
 * that nothing was sent.
 */
export default function HarvestTool({
  requiresNft = FORGE_HARVEST_REQUIRES_NFT,
  scenario = FORGE_HARVEST_SCENARIO,
  nftHoldings = FORGE_MOCK_NFT_HOLDINGS,
}: HarvestToolProps) {
  const { addToast } = useToast();
  const mock = FORGE_HARVEST_MOCK[scenario];
  const { profit, profitable, minEthOut, gasPct, profitPct } = harvestQuote(mock, FORGE_HARVEST_MIN_OUT_BPS);

  const nfts = useMemo(() => buildForgeNftOptions(nftStaticConfig, nftHoldings), [nftHoldings]);
  const [selectedNftId, setSelectedNftId] = useState(FORGE_HARVEST_DEFAULT_NFT_ID);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Mock setApprovalForAll(harvester, true) state.
  const [approved, setApproved] = useState(false);
  // Last mock harvest() arguments; the live-wiring story passes these to writeContract.
  const lastCall = useRef<HarvestMockCall | null>(null);

  const selectedNft = nfts.find((n) => n.id === selectedNftId) ?? nfts[0];
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const profitColor = profitable ? 'text-green-400' : 'text-pxusd-pink-400';
  const gasStr = mock.gasEth.toFixed(4);
  const ethOutStr = mock.ethOut.toFixed(4);
  const gasK = `${Math.round(mock.gasUnits / 1000)}k`;

  const handleApprove = () => {
    setApproved(true);
    addToast({
      type: 'info',
      title: 'Approved (preview)',
      description: 'Harvester NFT approval simulated. Nothing was sent.',
    });
  };

  const handleHarvest = () => {
    lastCall.current = {
      exemptStrategies: [],
      // Token ID = dispatcher index. Ignored by the contract once NFT gating is removed.
      nftIndex: requiresNft ? selectedNft.id : 0,
      minEthOut,
    };
    addToast({
      type: 'info',
      title: 'Preview only',
      description: 'Harvesting is mocked on this page. Nothing was sent.',
    });
  };

  let button: { label: string; disabled: boolean; variant: 'primary' | 'approve'; onAction: () => void };
  if (!profitable) {
    button = { label: 'Not profitable right now', disabled: true, variant: 'primary', onAction: () => {} };
  } else if (requiresNft && !approved) {
    button = { label: 'Approve NFTs for the Harvester', disabled: false, variant: 'approve', onAction: handleApprove };
  } else {
    button = { label: `Harvest → receive ~${ethOutStr} ETH`, disabled: false, variant: 'primary', onAction: handleHarvest };
  }

  const showSteps = requiresNft && profitable;

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
                {fmtSigned4(profit)}
              </span>
              <span className="text-sm text-muted-foreground">
                ETH · ≈ ${fmt2(Math.abs(Number(profit.toFixed(4))) * FORGE_MOCK_ETH_USD)}
              </span>
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
            <StatRow label="Yield available">${fmt2(mock.yieldUsd)}</StatRow>
            <StatRow label="ETH paid to you">{ethOutStr} ETH</StatRow>
            <StatRow label={`Est. gas (${gasK} @ ${mock.gasGwei} gwei)`}>
              <span className="text-pxusd-pink-400">−{gasStr} ETH</span>
            </StatRow>
            <StatRow label="Minimum ETH out">{minEthOut.toFixed(4)} ETH</StatRow>
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

          {!profitable && (
            <div
              role="alert"
              className="rounded-xl border p-3.5 text-[12.5px] leading-[1.5] text-muted-foreground"
              style={{ borderColor: 'rgba(255,77,109,.35)', background: 'rgba(255,77,109,.07)' }}
            >
              <strong className="text-pxusd-pink-400">Not profitable.</strong> Gas ({gasStr} ETH) would cost more
              than the harvest pays ({ethOutStr} ETH). Check back once more yield has built up.
            </div>
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
