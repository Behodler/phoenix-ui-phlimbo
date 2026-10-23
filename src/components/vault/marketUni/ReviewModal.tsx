import { useEffect } from 'react';
import type { UniMarket } from '../../../hooks/useUniMarket';
import QuoteStats from './QuoteStats';
import TokenIcon from './TokenIcon';
import { FOCUS_RING, GHOST_ICON_BTN, INSET } from './styles';

/** Arc spinner; motion-safe so prefers-reduced-motion shows a static arc. */
function Spinner({ size }: { size: number }) {
  return (
    <svg className="motion-safe:animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.2-8.56" />
    </svg>
  );
}

function Check({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const PRIMARY_BTN = `h-[50px] rounded-[14px] border-none text-pxusd-white text-[15px] font-bold inline-flex items-center justify-center gap-2 ${FOCUS_RING}`;

/** Review → approve/confirm step machine → success. Each step is a real transaction. */
export default function ReviewModal({ m }: { m: UniMarket }) {
  const { pending, cancel } = m;

  // Escape closes, except while a wallet confirmation is pending.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, cancel]);

  const [legA, legB] = m.legs;
  const isApprove = m.currentStep?.kind === 'approve';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-start sm:items-center overflow-y-auto p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mku-dlg-title"
        className="w-full max-w-[480px] my-auto bg-pxusd-teal-800 border border-pxusd-teal-400 rounded-[20px] p-5 flex flex-col gap-4 shadow-[0_24px_60px_rgba(0,0,0,0.6)] text-foreground"
      >
        <div className="flex justify-between items-center">
          <h3 id="mku-dlg-title" className="m-0 text-lg font-bold">{m.modalTitle}</h3>
          <button
            type="button"
            onClick={m.cancel}
            disabled={m.pending}
            aria-label="Close"
            className={`${GHOST_ICON_BTN} text-foreground disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!m.success ? (
          <div className="flex flex-col gap-4">
            <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-[14px] px-4 py-3.5 flex flex-col gap-1.5">
              {[legA, legB].map((leg, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  {i === 1 && (
                    <span aria-hidden="true" className="text-xl leading-none text-center text-pxusd-orange-300">
                      {m.modal === 'swap' ? '↓' : '+'}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{leg.caption}</span>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-2xl font-bold break-all">{leg.amount}</span>
                    <span className="inline-flex items-center gap-2 font-semibold flex-shrink-0">
                      <TokenIcon sym={leg.sym} size={24} />
                      {leg.sym}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <QuoteStats stats={m.modalStats} />

            <ol aria-label="Steps" className={`${INSET} m-0 p-3 list-none flex flex-col gap-2.5`}>
              {m.steps.map((st, i) => {
                const done = i < m.stepIdx || m.success;
                const current = i === m.stepIdx && !m.success;
                const spin = current && m.pending;
                const dotClass = done
                  ? 'bg-pxusd-orange-400 text-pxusd-teal-950'
                  : current
                    ? 'border-2 border-pxusd-orange-400 text-pxusd-orange-300'
                    : 'border border-pxusd-teal-400 text-[rgba(240,245,248,0.5)]';
                const tag = done ? 'Done' : spin ? 'Pending' : current ? 'Next' : '';
                return (
                  <li key={`${st.sub}-${i}`} className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-[13px] font-bold flex-shrink-0 ${dotClass}`}>
                      {done ? <Check size={14} strokeWidth={3} /> : spin ? <Spinner size={14} /> : i + 1}
                    </span>
                    <span className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className={`text-sm font-semibold ${done || current ? 'text-foreground' : 'text-[rgba(240,245,248,0.55)]'}`}>{st.label}</span>
                      <span className="text-xs font-mono text-[rgba(240,245,248,0.5)] break-all">{st.sub}</span>
                    </span>
                    <span className="text-xs text-[rgba(240,245,248,0.55)]">{tag}</span>
                  </li>
                );
              })}
            </ol>

            {isApprove && !m.pending && (
              <label className="flex items-center gap-2.5 text-[13px] cursor-pointer min-h-[28px]">
                <input
                  type="checkbox"
                  checked={m.exactApprove}
                  onChange={m.toggleExactApprove}
                  className={`w-[18px] h-[18px] m-0 accent-pxusd-orange-400 ${FOCUS_RING}`}
                />
                <span>{m.exactLabel}</span>
              </label>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={m.cancel}
                disabled={m.pending}
                className={`h-[50px] rounded-[14px] border border-pxusd-teal-400 bg-transparent text-foreground text-[15px] font-semibold hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS_RING}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={m.advanceStep}
                disabled={m.pending}
                className={`${PRIMARY_BTN} ${isApprove ? 'phoenix-btn-secondary' : 'phoenix-btn-primary'} !p-0 disabled:!opacity-70 disabled:cursor-wait`}
              >
                {m.pending && <Spinner size={16} />}
                <span>{m.modalActionLabel}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3.5 py-2 text-center">
            <span
              className="w-16 h-16 rounded-full border-2 border-pxusd-orange-400 text-pxusd-orange-300 inline-flex items-center justify-center"
              style={{ background: 'rgba(255,140,66,0.15)' }}
            >
              <Check size={30} strokeWidth={2.5} />
            </span>
            <span className="text-base font-semibold">{m.successText}</span>
            {m.etherscanUrl && (
              <a
                href={m.etherscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-sm inline-flex items-center gap-1.5 min-h-[32px] text-pxusd-orange-300 hover:brightness-110 rounded ${FOCUS_RING}`}
              >
                View on Etherscan
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                </svg>
              </a>
            )}
            <button type="button" onClick={m.done} className={`${PRIMARY_BTN} phoenix-btn-primary w-full !p-0 text-base`}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
