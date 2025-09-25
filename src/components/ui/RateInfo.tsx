import type { RateInfoProps } from '../../types/vault';

export default function RateInfo({ constants, slippageBps, onSlippageChange, minReceived }: RateInfoProps) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">1 DOLA</span>
        <span className="font-medium text-foreground">≈ {constants.dolaToAutoDolaRate} autoDOLA</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Gas est.</span>
        <span className="text-foreground">${constants.gasFeeUsd.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Max Slippage</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            className="w-20 rounded-md border border-input bg-card px-2 py-1 text-right text-card-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={(slippageBps / 100).toFixed(2)}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!isNaN(val)) onSlippageChange(Math.max(0, Math.round(val * 100)));
            }}
          />
          <span className="text-muted-foreground">%</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Receive at least</span>
        <span className="font-medium text-foreground">
          {minReceived > 0 ? minReceived.toFixed(6) : "-"} autoDOLA
        </span>
      </div>
    </div>
  );
}