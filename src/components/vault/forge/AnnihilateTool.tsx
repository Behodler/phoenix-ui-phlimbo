import { useCallback, useState, type ReactNode } from 'react';
import { useToast } from '../../ui/ToastProvider';
import AmountInput from '../../ui/AmountInput';
import ActionButton from '../../ui/ActionButton';
import {
  FORGE_ANNIHILATE_SLIPPAGE_BPS,
  FORGE_MOCK_ANTIMATTER_BALANCE,
  FORGE_MOCK_PHUSD_PRICE,
  FORGE_MOCK_STABLE_BALANCES,
} from '../../../data/forgeMockData';
import ForgeTokenSelectorModal, { type ForgeTokenOption } from './ForgeTokenSelectorModal';
import { AMOUNT_INPUT_PATTERN, floorTo, fmt2, isAnnihilateGated, toInputString } from './forgeFormat';
import usdcIcon from '../../../assets/usdc-logo.svg';
import usdeIcon from '../../../assets/USDe.png';
import dolaIcon from '../../../assets/sDOLA.png';

export type AnnihilateStableSymbol = keyof typeof FORGE_MOCK_STABLE_BALANCES;

const ANTIMATTER_LAVENDER = '#C4AEEA';

const STABLE_META: Record<AnnihilateStableSymbol, { name: string; icon: string }> = {
  USDC: { name: 'USD Coin', icon: usdcIcon },
  USDe: { name: 'Ethena USDe', icon: usdeIcon },
  DOLA: { name: 'DOLA', icon: dolaIcon },
};
// Order shown in the selector; USDC is the default.
const STABLE_ORDER: readonly AnnihilateStableSymbol[] = ['USDC', 'USDe', 'DOLA'];

export interface AnnihilateToolProps {
  /** phUSD price in USD. Injectable so tests can reach the gated state. */
  price?: number;
  antimatterBalance?: number;
  stableBalances?: Record<AnnihilateStableSymbol, number>;
}

/**
 * Body of the Forge "Annihilate Antimatter" row. MOCKED: no contract reads or
 * writes. Approve/annihilate step through their states locally and toast that
 * nothing was sent.
 */
export default function AnnihilateTool({
  price = FORGE_MOCK_PHUSD_PRICE,
  antimatterBalance = FORGE_MOCK_ANTIMATTER_BALANCE,
  stableBalances = FORGE_MOCK_STABLE_BALANCES,
}: AnnihilateToolProps) {
  const { addToast } = useToast();
  const [amount, setAmount] = useState('');
  const [stable, setStable] = useState<AnnihilateStableSymbol>('USDC');
  const [selectorOpen, setSelectorOpen] = useState(false);
  // Mock allowance state, per token; every token starts unapproved.
  const [approved, setApproved] = useState<Record<AnnihilateStableSymbol, boolean>>({
    USDC: false,
    USDe: false,
    DOLA: false,
  });

  const stableBalance = stableBalances[stable];
  const meta = STABLE_META[stable];
  const gated = isAnnihilateGated(price);

  const parsed = Number.parseFloat(amount);
  const amt = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const maxAmount = floorTo(Math.min(antimatterBalance, stableBalance), 4);
  const overAntimatter = amt > antimatterBalance;
  const overStable = amt > stableBalance;
  const over = overAntimatter || overStable;

  const phusdOut = 2 * amt;
  const netValue = amt * (2 * price - 1);
  // Floor so the displayed minimum never overstates what the contract guarantees.
  const minReceived = floorTo(phusdOut * (1 - FORGE_ANNIHILATE_SLIPPAGE_BPS / 10_000), 2);

  const handleAmountChange = (value: string) => {
    const trimmed = value.trim();
    if (AMOUNT_INPUT_PATTERN.test(trimmed)) setAmount(trimmed);
  };
  const fillMax = () => setAmount(maxAmount > 0 ? toInputString(maxAmount) : '');

  const closeSelector = useCallback(() => setSelectorOpen(false), []);

  const handleApprove = () => {
    setApproved((prev) => ({ ...prev, [stable]: true }));
    addToast({
      type: 'info',
      title: 'Approved (preview)',
      description: `${stable} approval simulated. Nothing was sent.`,
    });
  };

  const handleAnnihilate = () => {
    addToast({
      type: 'info',
      title: 'Preview only',
      description: 'Annihilation is mocked on this page. Nothing was sent.',
    });
    setAmount('');
  };

  let button: { label: string; disabled: boolean; variant: 'primary' | 'approve'; onAction: () => void };
  if (gated) {
    button = { label: 'Annihilation paused at phUSD ≤ $0.50', disabled: true, variant: 'primary', onAction: () => {} };
  } else if (amt <= 0) {
    button = { label: 'Enter Amount', disabled: true, variant: 'primary', onAction: () => {} };
  } else if (over) {
    button = { label: 'Insufficient Balance', disabled: true, variant: 'primary', onAction: () => {} };
  } else if (!approved[stable]) {
    button = { label: `Approve ${stable}`, disabled: false, variant: 'approve', onAction: handleApprove };
  } else {
    button = {
      label: `Annihilate → receive ${fmt2(phusdOut)} phUSD`,
      disabled: false,
      variant: 'primary',
      onAction: handleAnnihilate,
    };
  }

  const tokenOptions: ForgeTokenOption<AnnihilateStableSymbol>[] = STABLE_ORDER.map((symbol) => ({
    symbol,
    name: STABLE_META[symbol].name,
    icon: STABLE_META[symbol].icon,
    balance: stableBalances[symbol],
  }));

  const fieldLabel = 'text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground';

  return (
    <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
      {/* Left column: inputs */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-2">
          <span className={fieldLabel}>Pair with</span>
          <div>
            <button
              type="button"
              onClick={() => setSelectorOpen(true)}
              aria-label={`Pair with ${stable}`}
              className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-xl hover:bg-pxusd-teal-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <img src={meta.icon} alt={`${stable} icon`} className="h-8 w-8 rounded-full flex-shrink-0 object-cover" />
              <span className="text-base font-semibold text-foreground">{stable}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className={fieldLabel}>Antimatter to annihilate</span>
          <button
            type="button"
            onClick={fillMax}
            className="whitespace-nowrap text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Max: {fmt2(maxAmount)}
          </button>
        </div>

        <div>
          <AmountInput amount={amount} onAmountChange={handleAmountChange} onMaxClick={fillMax} isInvalid={over} />
          <p className="-mt-3 text-xs text-muted-foreground">
            ≈ ${fmt2(amt)} of {stable} leaves your wallet
            {over && (
              <>
                {' · '}
                <span className="text-pxusd-pink-400">
                  {overAntimatter ? 'Insufficient Antimatter' : `Insufficient ${stable}`}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Your Antimatter</span>
            <span className="font-mono tabular-nums" style={{ color: ANTIMATTER_LAVENDER }}>
              {fmt2(antimatterBalance)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Your {stable}</span>
            <span className="font-mono tabular-nums text-pxusd-white">{fmt2(stableBalance)}</span>
          </div>
        </div>
      </div>

      {/* Right column: preview + action */}
      <div className="flex min-w-0 flex-col">
        <div
          className="rounded-[14px] border p-4"
          style={{
            borderColor: 'rgba(196,174,234,.28)',
            background: 'linear-gradient(180deg, rgba(196,174,234,.09), rgba(10,28,40,0) 85%)',
          }}
        >
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-pxusd-purple-300">
            Annihilation preview
          </div>
          <div
            data-testid="annihilate-preview"
            className="grid grid-cols-1 items-center gap-2.5 sm:grid-cols-[1fr_auto_1fr_auto_1fr]"
          >
            <PreviewCell label="Antimatter" labelColor={ANTIMATTER_LAVENDER} value={fmt2(amt)} />
            <Glyph>+</Glyph>
            <PreviewCell label={stable} labelColor="rgba(240,245,248,.72)" value={fmt2(amt)} />
            <Glyph>=</Glyph>
            <PreviewCell label="phUSD" labelColor="#FFB566" value={fmt2(phusdOut)} emphasised />
          </div>

          <div className="mt-4 space-y-2.5 text-sm">
            <PreviewRow label="phUSD price">
              <span className={gated ? 'text-pxusd-pink-400' : undefined}>${fmt2(price)}</span>
            </PreviewRow>
            <PreviewRow label="Net value change">
              <span className={netValue >= 0 ? 'text-green-400' : 'text-pxusd-pink-400'}>
                {/* Real minus sign (U+2212), not a hyphen. */}
                {netValue >= 0 ? '+' : '−'}${fmt2(Math.abs(netValue))}
              </span>
            </PreviewRow>
            <PreviewRow label="Minimum received">{fmt2(minReceived)} phUSD</PreviewRow>
          </div>
        </div>

        {gated && (
          <div
            role="alert"
            className="mt-4 rounded-xl border p-3.5 text-[12.5px] leading-[1.5] text-muted-foreground"
            style={{ borderColor: 'rgba(255,77,109,.35)', background: 'rgba(255,77,109,.07)' }}
          >
            <strong className="text-pxusd-pink-400">Annihilation disabled.</strong> phUSD is at ${fmt2(price)}. At
            $0.50 or less, the phUSD you receive is worth less than the {stable} you put in.
          </div>
        )}

        <ActionButton
          disabled={button.disabled}
          onAction={button.onAction}
          label={button.label}
          variant={button.variant}
        />
        <p className="mt-2 text-center text-[11.5px] text-muted-foreground">
          Irreversible. Both halves are consumed in one transaction.
        </p>
      </div>

      <ForgeTokenSelectorModal
        isOpen={selectorOpen}
        onClose={closeSelector}
        tokens={tokenOptions}
        activeSymbol={stable}
        onSelect={setStable}
        footerNote="Only stablecoins registered with the phUSD minter can be annihilated."
      />
    </div>
  );
}

function PreviewCell({
  label,
  labelColor,
  value,
  emphasised = false,
}: {
  label: string;
  labelColor: string;
  value: string;
  emphasised?: boolean;
}) {
  return (
    <div
      data-testid={`preview-cell-${label}`}
      className="min-w-0 rounded-xl border p-3"
      style={
        emphasised
          ? { borderColor: 'rgba(255,140,66,.35)', background: 'rgba(255,140,66,.08)' }
          : { borderColor: 'rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)' }
      }
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: labelColor }}>
        {label}
      </div>
      <div className="truncate font-mono text-[19px] font-semibold tabular-nums tracking-[-0.02em] text-pxusd-white">
        {value}
      </div>
    </div>
  );
}

function Glyph({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="text-center font-mono text-lg text-muted-foreground">
      {children}
    </span>
  );
}

function PreviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono tabular-nums text-pxusd-white">{children}</span>
    </div>
  );
}
