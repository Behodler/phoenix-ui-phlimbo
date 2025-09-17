import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useBlockNumber } from 'wagmi'

export default function App() {
  const { address, chainId } = useAccount()
  const { data: block } = useBlockNumber({ watch: true })
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-xl p-6 rounded-2xl border bg-card text-card-foreground">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dapp Starter (Rainbow + wagmi)</h1>
          <ConnectButton />
        </div>
        <div className="mt-6 text-sm opacity-80">
          <div>Address: {address ?? '—'}</div>
          <div>Chain: {chainId ?? '—'}</div>
          <div>Block: {block?.toString() ?? '—'}</div>
        </div>
      </div>
    </div>
  )
}
