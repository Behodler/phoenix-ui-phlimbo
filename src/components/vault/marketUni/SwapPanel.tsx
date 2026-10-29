import type { UniMarket } from '../../../hooks/useUniMarket';
import TokenAmountBox from './TokenAmountBox';
import { TargetChip, TokenPickerButton } from './TokenChips';
import { FOCUS_RING } from './styles';

/** Swap mode: You pay / flip / You receive (read-only: UniswapHelper quotes are exact-in only). */
export default function SwapPanel({ m }: { m: UniMarket }) {
  const q = m.swap;
  const picker = (sym: typeof q.inSym, role: 'pay with' | 'receive') => (
    <TokenPickerButton
      sym={sym}
      ariaLabel={`Select token to ${role}, currently ${sym}`}
      onClick={() => m.openPicker('counter')}
      expanded={m.pickerKind === 'counter'}
    />
  );
  // phUSD / AM side: a picker where the AM pair is live, else the fixed phUSD chip.
  const target = (role: 'pay with' | 'receive') => (m.canPickTarget ? (
    <TokenPickerButton
      sym={m.target}
      ariaLabel={`Select Phoenix token to ${role}, currently ${m.target}`}
      onClick={() => m.openPicker('target')}
      expanded={m.pickerKind === 'target'}
    />
  ) : <TargetChip sym={m.target} />);

  return (
    <div className="flex flex-col">
      <TokenAmountBox
        id="mku-pay"
        label="You pay"
        value={m.payStr}
        onChange={m.setPay}
        balanceText={m.payBalText}
        usdText={m.payUsd}
        onMax={m.payMax}
        token={q.buy ? picker(q.inSym, 'pay with') : target('pay with')}
      />

      <div className="flex justify-center -my-3.5 relative z-[2]">
        <button
          type="button"
          onClick={m.flip}
          aria-label={`Flip direction: currently ${q.buy ? 'buying' : 'selling'} ${m.target}`}
          className={`w-11 h-11 rounded-xl border-4 border-pxusd-teal-800 bg-pxusd-teal-600 text-pxusd-orange-300 inline-flex items-center justify-center hover:brightness-110 transition ${FOCUS_RING}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m7 15 5 5 5-5" />
            <path d="m7 9 5-5 5 5" />
          </svg>
        </button>
      </div>

      <TokenAmountBox
        id="mku-recv"
        label="You receive"
        value={m.recvStr}
        readOnly
        balanceText={m.recvBalText}
        usdText={m.recvUsd}
        token={q.buy ? target('receive') : picker(q.outSym, 'receive')}
      />
    </div>
  );
}
