import type { RateInfoProps } from '../../types/vault';

export default function RateInfo({ constants, slippageBps, onSlippageChange, minReceived }: RateInfoProps) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-neutral-400">1 DOLA</span>
        <span className="font-medium">≈ {constants.dolaToAutoDolaRate} autoDOLA</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-neutral-400">Gas est.</span>
        <span>${constants.gasFeeUsd.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-neutral-400">Max Slippage</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-right"
            value={(slippageBps / 100).toFixed(2)}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!isNaN(val)) onSlippageChange(Math.max(0, Math.round(val * 100)));
            }}
          />
          <span>%</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-neutral-400">Receive at least</span>
        <span className="font-medium">
          {minReceived > 0 ? minReceived.toFixed(6) : "-"} autoDOLA
        </span>
      </div>
    </div>
  );
}