import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { erc20Abi, type Address, type Hash } from 'viem';
import { balancerLpMigratorAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import {
  BALANCER_EXIT_SLIPPAGE_BPS,
  type BalancerExitPreview,
} from '../data/balancerExitData';
import { deadlineFromNow, liveAddress } from './useUniMarket';

const REFRESH_MS = 12_000;

export type BalancerExitStep = 'approve' | 'migrate' | 'done';

/** Floor `amount` by the slippage tolerance. `migrate` rejects a zero minimum, so never below 1 wei. */
export function withSlippage(amount: bigint, bps: bigint = BALANCER_EXIT_SLIPPAGE_BPS): bigint {
  const floored = (amount * (10_000n - bps)) / 10_000n;
  return floored > 0n ? floored : 1n;
}

/**
 * Live state for the Balancer LP exit modal: the wallet's BPT balance on the
 * pool `BalancerLPMigrator.pool()` names, `previewMigrate` for all of it, and
 * the approve → migrate transactions.
 *
 * Every read is disabled while `BalancerLPMigrator` is the zero address, which
 * it is everywhere but mainnet, so the modal never shows there.
 */
export function useBalancerExit() {
  const { address: wallet } = useAccount();
  const { addresses } = useContractAddresses();
  const migrator = liveAddress(addresses?.BalancerLPMigrator);

  const { data: poolRaw } = useReadContract({
    address: migrator,
    abi: balancerLpMigratorAbi,
    functionName: 'pool',
    query: { enabled: !!migrator },
  });
  const { data: phUSDRaw } = useReadContract({
    address: migrator,
    abi: balancerLpMigratorAbi,
    functionName: 'phUSD',
    query: { enabled: !!migrator },
  });
  const pool = liveAddress(poolRaw);

  const { data: bptRaw, refetch: refetchBpt } = useReadContract({
    address: pool,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: wallet ? [wallet] : undefined,
    query: { enabled: !!pool && !!wallet, refetchInterval: REFRESH_MS },
  });
  const bpt = typeof bptRaw === 'bigint' ? bptRaw : undefined;

  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: pool,
    abi: erc20Abi,
    functionName: 'allowance',
    args: wallet && migrator ? [wallet, migrator] : undefined,
    query: { enabled: !!pool && !!wallet && !!migrator },
  });

  const { data: previewRaw } = useReadContract({
    address: migrator,
    abi: balancerLpMigratorAbi,
    functionName: 'previewMigrate',
    args: bpt !== undefined ? [bpt] : undefined,
    query: { enabled: !!migrator && !!bpt, refetchInterval: REFRESH_MS },
  });

  const livePreview = useMemo<BalancerExitPreview | undefined>(
    () =>
      previewRaw && bpt
        ? {
            bptAmount: bpt,
            sUSDSOut: previewRaw[0],
            phUSDOut: previewRaw[1],
            sUSDSUsed: previewRaw[2],
            phUSDUsed: previewRaw[3],
            leftoverToken:
              typeof phUSDRaw === 'string' && previewRaw[4].toLowerCase() === phUSDRaw.toLowerCase() ? 'phUSD' : 'sUSDS',
            leftoverAmount: previewRaw[5],
            recoveryMode: previewRaw[6],
            expectedLiquidity: previewRaw[7],
          }
        : undefined,
    [previewRaw, bpt, phUSDRaw],
  );

  const { writeContractAsync } = useWriteContract();
  const [hash, setHash] = useState<Hash>();
  const [sent, setSent] = useState<'approve' | 'migrate'>();
  const [awaitingSignature, setAwaitingSignature] = useState(false);
  const [error, setError] = useState<string>();
  // The preview the migrate transaction was signed against, kept for the success screen.
  const [submitted, setSubmitted] = useState<BalancerExitPreview>();
  const [completed, setCompleted] = useState<BalancerExitPreview>();

  const receipt = useWaitForTransactionReceipt({ hash, query: { enabled: !!hash } });

  useEffect(() => {
    if (!receipt.data) return;
    if (receipt.data.status !== 'success') {
      setError('Transaction reverted. Nothing was moved; try again.');
    } else if (sent === 'migrate') {
      setCompleted(submitted);
    }
    void refetchAllowance();
    void refetchBpt();
    setHash(undefined);
  }, [receipt.data, sent, submitted, refetchAllowance, refetchBpt]);

  const allowance = typeof allowanceRaw === 'bigint' ? allowanceRaw : 0n;
  const needsApproval = !!livePreview && allowance < livePreview.bptAmount;
  const step: BalancerExitStep = completed ? 'done' : needsApproval ? 'approve' : 'migrate';
  const pending = awaitingSignature || !!hash;

  const blockedReason = !wallet ? 'Connect the wallet that holds this LP' : undefined;

  const advance = useCallback(async () => {
    if (pending || blockedReason || !migrator || !pool || !livePreview || !wallet) return;
    setError(undefined);
    setAwaitingSignature(true);
    try {
      if (needsApproval) {
        const h = await writeContractAsync({
          address: pool,
          abi: erc20Abi,
          functionName: 'approve',
          args: [migrator, livePreview.bptAmount],
        });
        setSent('approve');
        setHash(h);
      } else {
        const p = livePreview;
        const h = await writeContractAsync({
          address: migrator,
          abi: balancerLpMigratorAbi,
          functionName: 'migrate',
          args: [
            p.bptAmount,
            withSlippage(p.sUSDSOut),
            withSlippage(p.phUSDOut),
            withSlippage(p.sUSDSUsed),
            withSlippage(p.phUSDUsed),
            wallet as Address,
            deadlineFromNow(),
          ],
        });
        setSent('migrate');
        setSubmitted(p);
        setHash(h);
      }
    } catch (e) {
      const msg = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message;
      setError(msg || 'Transaction failed');
    } finally {
      setAwaitingSignature(false);
    }
  }, [pending, blockedReason, migrator, pool, livePreview, wallet, needsApproval, writeContractAsync]);

  const finish = useCallback(() => setCompleted(undefined), []);

  return {
    /** Show only while a live migrator exists and the wallet has BPT (or a migration just finished). */
    visible: !!migrator && (!!completed || !!livePreview),
    preview: completed ?? livePreview,
    step,
    pending,
    error,
    blockedReason,
    advance,
    finish,
  };
}
