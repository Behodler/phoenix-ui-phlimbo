import { formatEther } from 'viem';
import balancerLogo from '../../../assets/balancer-logo.svg';
import { BALANCER_RECOVERY_MODE_DATE, type BalancerExitPreview } from '../../../data/balancerExitData';
import { useBalancerExit, type BalancerExitStep } from '../../../hooks/useBalancerExit';
import LpPairIcon from '../marketUni/LpPairIcon';
import TokenIcon from '../marketUni/TokenIcon';
import { FOCUS_RING, INSET } from '../marketUni/styles';

/** 18-dec wei → grouped human string, at most `dp` decimals. */
function fmt(wei: bigint, dp = 4): string {
  return Number(formatEther(wei)).toLocaleString('en-US', { maximumFractionDigits: dp });
}

function Spinner() {
  return (
    <svg className="motion-safe:animate-spin" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.2-8.56" />
    </svg>
  );
}

function Check({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const STEPS: { key: Exclude<BalancerExitStep, 'done'>; label: string; sub: string }[] = [
  { key: 'approve', label: 'Approve Balancer LP', sub: 'Lets the migrator move your BPT' },
  { key: 'migrate', label: 'Migrate to Uniswap', sub: 'Exit Balancer and add to Uniswap V2 in one transaction' },
];

/**
 * Blocking "Balancer is closing" migration modal, driven by `useBalancerExit`.
 * Shows only while `BalancerLPMigrator` is live on the connected chain and the
 * holder has a positive BPT balance on its pool.
 *
 * Deliberately has no close affordance: no X, no Cancel, Escape and backdrop
 * clicks do nothing. It goes away when the holder has nothing left to migrate,
 * after the success screen's Continue.
 */
export default function BalancerExitModal() {
  const exit = useBalancerExit();
  if (!exit.visible || !exit.preview) return null;
  return (
    <BalancerExitDialog
      preview={exit.preview}
      step={exit.step}
      pending={exit.pending}
      error={exit.error}
      blockedReason={exit.blockedReason}
      onAdvance={exit.advance}
      onFinished={exit.finish}
    />
  );
}

export interface BalancerExitDialogProps {
  preview: BalancerExitPreview;
  step: BalancerExitStep;
  pending: boolean;
  error?: string;
  /** When set, the action button is disabled and this text explains why. */
  blockedReason?: string;
  onAdvance: () => void;
  onFinished: () => void;
}

export function BalancerExitDialog({ preview, step, pending, error, blockedReason, onAdvance, onFinished }: BalancerExitDialogProps) {
  const stepIdx = step === 'approve' ? 0 : step === 'migrate' ? 1 : 2;
  const actionLabel = pending
    ? step === 'approve' ? 'Approving…' : 'Migrating…'
    : step === 'approve' ? 'Approve Balancer LP' : 'Migrate to Uniswap';

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex justify-center items-start sm:items-center overflow-y-auto p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="balexit-title"
        aria-describedby="balexit-desc"
        className="w-full max-w-[500px] my-auto bg-pxusd-teal-800 border border-pxusd-teal-400 rounded-[20px] p-5 sm:p-6 flex flex-col gap-4 shadow-[0_24px_60px_rgba(0,0,0,0.6)] text-foreground"
      >
        {step !== 'done' ? (
          <>
            <div className="flex items-center gap-3">
              <img src={balancerLogo} alt="" className="w-10 h-10 flex-shrink-0" />
              <h2 id="balexit-title" className="m-0 text-xl font-bold leading-tight">
                Balancer is closing. Move your liquidity to Uniswap.
              </h2>
            </div>

            <div
              id="balexit-desc"
              className="rounded-[14px] px-4 py-3.5 flex flex-col gap-2.5 text-sm leading-relaxed"
              style={{ background: 'rgba(255,140,66,0.10)', border: '1px solid rgba(255,140,66,0.40)' }}
            >
              <p className="m-0">
                Your wallet holds phUSD/sUSDS liquidity on Balancer. Balancer is winding down, so this
                position needs to move to the phUSD/sUSDS pool on Uniswap V2.
              </p>
              <p className="m-0">
                From{' '}
                <span className="font-semibold text-pxusd-orange-300 whitespace-nowrap">{BALANCER_RECOVERY_MODE_DATE}</span>,
                the Balancer pool can only be exited through recovery mode.
              </p>
            </div>

            <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-[14px] px-4 py-3.5 flex flex-col gap-3">
              <Row caption="Your Balancer LP">
                <Amount value={fmt(preview.bptAmount)} unit="BPT" icon={<img src={balancerLogo} alt="" className="w-6 h-6" />} />
              </Row>

              <Row caption="Withdraws as">
                <div className="flex flex-col items-end gap-1">
                  <Amount value={fmt(preview.sUSDSOut)} unit="sUSDS" icon={<TokenIcon sym="sUSDS" size={20} />} small />
                  <Amount value={fmt(preview.phUSDOut)} unit="phUSD" icon={<TokenIcon sym="phUSD" size={20} />} small />
                </div>
              </Row>

              <span aria-hidden="true" className="text-xl leading-none text-center text-pxusd-orange-300">↓</span>

              <Row caption="You receive on Uniswap">
                <Amount
                  value={fmt(preview.expectedLiquidity)}
                  unit="UNI-V2 LP"
                  icon={<LpPairIcon size={22} ringClass="border-pxusd-teal-700" />}
                />
              </Row>
            </div>

            {preview.leftoverAmount > 0n && (
              <div className={`${INSET} px-4 py-3 flex items-start gap-3 text-sm`}>
                <TokenIcon sym={preview.leftoverToken} size={24} />
                <p className="m-0 leading-relaxed">
                  <span className="font-semibold">
                    {fmt(preview.leftoverAmount)} {preview.leftoverToken}
                  </span>{' '}
                  doesn't fit the Uniswap pool's current ratio. It will be sent to your wallet as{' '}
                  {preview.leftoverToken}.
                </p>
              </div>
            )}

            <ol aria-label="Steps" className={`${INSET} m-0 p-3 list-none flex flex-col gap-2.5`}>
              {STEPS.map((st, i) => {
                const done = i < stepIdx;
                const current = i === stepIdx;
                const dot = done
                  ? 'bg-pxusd-orange-400 text-pxusd-teal-950'
                  : current
                    ? 'border-2 border-pxusd-orange-400 text-pxusd-orange-300'
                    : 'border border-pxusd-teal-400 text-[rgba(240,245,248,0.5)]';
                return (
                  <li key={st.key} className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-[13px] font-bold flex-shrink-0 ${dot}`}>
                      {done ? <Check size={14} /> : current && pending ? <Spinner /> : i + 1}
                    </span>
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className={`text-sm font-semibold ${done || current ? 'text-foreground' : 'text-[rgba(240,245,248,0.55)]'}`}>{st.label}</span>
                      <span className="text-xs text-[rgba(240,245,248,0.5)]">{st.sub}</span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <button
              type="button"
              onClick={onAdvance}
              disabled={pending || !!blockedReason}
              autoFocus
              className={`h-[52px] w-full rounded-[14px] border-none text-pxusd-white text-base font-bold inline-flex items-center justify-center gap-2 !p-0 ${step === 'approve' ? 'phoenix-btn-secondary' : 'phoenix-btn-primary'} disabled:!opacity-70 ${pending ? 'disabled:cursor-wait' : 'disabled:cursor-not-allowed'} ${FOCUS_RING}`}
            >
              {pending && <Spinner />}
              <span>{actionLabel}</span>
            </button>
            {(error || blockedReason) && (
              <p role={error ? 'alert' : undefined} className={`m-0 -mt-1 text-xs text-center break-all ${error ? 'text-red-400' : 'text-muted-foreground'}`}>
                {error ?? blockedReason}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3.5 py-2 text-center">
            <span
              className="w-16 h-16 rounded-full border-2 border-pxusd-orange-400 text-pxusd-orange-300 inline-flex items-center justify-center"
              style={{ background: 'rgba(255,140,66,0.15)' }}
            >
              <Check size={30} />
            </span>
            <h2 id="balexit-title" className="m-0 text-lg font-bold">Migration complete</h2>
            <p id="balexit-desc" className="m-0 text-sm leading-relaxed text-[rgba(240,245,248,0.8)]">
              You now hold {fmt(preview.expectedLiquidity)} UNI-V2 phUSD/sUSDS LP.
              {preview.leftoverAmount > 0n && ` ${fmt(preview.leftoverAmount)} ${preview.leftoverToken} was sent to your wallet.`}
            </p>
            <button
              type="button"
              onClick={onFinished}
              autoFocus
              className={`h-[50px] w-full rounded-[14px] border-none text-pxusd-white text-base font-bold phoenix-btn-primary !p-0 ${FOCUS_RING}`}
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-xs text-muted-foreground pt-1.5">{caption}</span>
      {children}
    </div>
  );
}

function Amount({ value, unit, icon, small }: { value: string; unit: string; icon: React.ReactNode; small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-right">
      <span className={`${small ? 'text-base' : 'text-xl'} font-bold font-mono break-all`}>{value}</span>
      <span className="inline-flex items-center gap-1.5 font-semibold flex-shrink-0">
        {icon}
        <span className={small ? 'text-sm' : ''}>{unit}</span>
      </span>
    </span>
  );
}
