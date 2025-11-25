
## What is phUSD?

phUSD is Phoenix’s Evergreen Stablecoin — a new kind of stablecoin whose backing grows stronger over time.

Phoenix takes yield from the wider DeFi ecosystem, captures it permanently using protocol-owned liquidity, and uses that yield in the Behodler ecosystem.

For more info, see:  
**[phUSD Overview](https://github.com/Behodler/docs-public/blob/main/phUSD.md)**

---

## How do I mint phUSD?

Connect your wallet, deposit DOLA, and the bonding curve mints phUSD at the current curve price.  
During Phase 1 (Ignition), the curve price gradually increases toward $1. When parity is reached, the bonding curve disables and phUSD mints at a fixed $1 price.

For more info on Phase 1, see:  
**[Phoenix Phase 1 — Ignition](https://github.com/Behodler/docs-public/blob/main/Phoenix%20Phase%201%3A%20Ignition%20%E2%80%94%20Capitalising%20phUSD%20with%20the%20Behodler%203%20Bonding%20Curve.md)**

---

## Why can't I use ETH/USDC etc to mint phUSD?

Phoenix requires DOLA because all minting must flow into the AutoDOLA Vault.  
While Phoenix could auto-swap other tokens (ETH, USDC, etc.) into DOLA, adding that routing at launch would have required additional development time and delayed release.

Future versions may support multi-asset minting, but for now **phUSD mints exclusively from DOLA**.

---

## What backs phUSD?

All phUSD minted through the bonding curve is backed by DOLA deposited into the AutoDOLA Vault.  
This vault compounds yield and provides the foundation for phUSD’s stability.

---

## What is the AutoDOLA Vault?

The AutoDOLA vault is a **yield vault provided by the Autofinance team (formerly Tokemak)**.  
It accepts DOLA and automatically stakes it into sDOLA to generate sustainable on-chain yield. Phoenix uses this vault as the destination for all DOLA minted through phUSD, turning that yield into permanent backing and liquidity.

For more info on Auto Pools, see:  
**[Autofinance Auto Pools TL;DR](https://docs.auto.finance/auto-pools-protocol/autopools-tl-dr)**


---


## Where can I use phUSD?

During Phase 1, phUSD can be traded on the bonding curve.  
In later stages, phUSD can be **staked to earn yield**, and as supply grows, additional integrations across DeFi will become available.


