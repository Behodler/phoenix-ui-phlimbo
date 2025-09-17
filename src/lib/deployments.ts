export type DeployedContract = { address: `0x${string}`; abi: any }
export type Deployments = { chainId: number; contracts: Record<string, DeployedContract> }

export async function loadDeployments(url: string): Promise<Deployments> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch deployments: ${res.status}`)
  return res.json()
}
