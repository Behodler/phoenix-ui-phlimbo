import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { HeaderProps } from '../../types/vault';

export default function Header({ }: HeaderProps) {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-yellow-400" />
          <div>
            <div className="text-sm text-neutral-400 leading-tight">Phoenix</div>
            <div className="text-lg font-semibold">pxUSD minter (Behodler 3 technology)</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800">
            FAQ
          </button>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}