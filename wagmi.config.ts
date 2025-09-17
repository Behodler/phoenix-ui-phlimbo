import { defineConfig } from '@wagmi/cli'
import { react } from '@wagmi/cli/plugins'

import deployments from './public/deployments/31337.json'

export default defineConfig({
  out: 'src/generated/wagmi.ts',
  plugins: [react()],
  contracts: Object.entries((deployments as any).contracts).map(([name, c]: any) => ({
    name,
    abi: c.abi,
    address: { [(deployments as any).chainId]: c.address },
  })),
})
