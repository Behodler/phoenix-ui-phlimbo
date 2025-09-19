import type { AutoStakeToggleProps } from '../../types/vault';

export default function AutoStakeToggle({ autoStake, onToggle }: AutoStakeToggleProps) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div className="text-sm text-neutral-300 flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-700 text-[10px]">
          i
        </span>
        Auto‑stake
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={autoStake}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <div className="w-12 h-6 bg-neutral-700 rounded-full peer peer-checked:bg-lime-400 transition" />
        <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-6" />
      </label>
    </div>
  );
}