/**
 * React Hook for DCA (Dollar Cost Averaging) Operations
 * 
 * Provides queries and mutations for managing DCA plans on-chain including:
 * - Fetching user's DCA plans
 * - Creating new DCA plans
 * - Executing DCA swaps
 * - Pausing/resuming plans
 * - Cancelling plans
 */

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { toast } from 'react-hot-toast';

import {
  DcaPlan,
  CreateDcaPlanParams,
  createDcaPlanTransaction,
  fetchUserDcaPlans,
  executeDcaSwapTransaction,
  pauseDcaPlanTransaction,
  resumeDcaPlanTransaction,
  cancelDcaPlanTransaction,
  isPlanReadyForExecution,
  formatTimestamp,
  getTimeUntilNextExecution,
  ensureRouterStateInitialized,
} from '@/lib/dca';
import { getExplorerTxUrl } from '@/utils/explorer';

/**
 * DCA Plan with UI-friendly formatting
 */
export interface DcaPlanUI extends DcaPlan {
  planPda: PublicKey;
  readyForExecution: boolean;
  timeUntilNext: string;
  progress: number; // Percentage (0-100)
  createdAtFormatted: string;
  nextExecutionFormatted: string;
}

/**
 * Hook to fetch all DCA plans for the connected user
 */
export function useDcaPlans() {
  const { connection } = useConnection();
  const wallet = useWallet();

  return useQuery({
    queryKey: ['dca-plans', wallet.publicKey?.toBase58()],
    queryFn: async (): Promise<DcaPlanUI[]> => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        return [];
      }

      const provider = new AnchorProvider(
        connection,
        wallet as unknown as Wallet,
        { commitment: 'confirmed' }
      );

      const plans = await fetchUserDcaPlans(connection, provider, wallet.publicKey);

      // Enrich plans with UI-friendly data
      return plans.map((plan) => ({
        ...plan,
        // planPda is already included from fetchUserDcaPlans
        readyForExecution: isPlanReadyForExecution(plan),
        timeUntilNext: getTimeUntilNextExecution(plan.nextExecution),
        progress: (plan.executedSwaps / plan.totalSwaps) * 100,
        createdAtFormatted: formatTimestamp(plan.createdAt),
        nextExecutionFormatted: formatTimestamp(plan.nextExecution),
      }));
    },
    enabled: !!wallet.publicKey && !!wallet.signTransaction && wallet.connected,
    refetchInterval: 30000, // Refetch every 30 seconds to check for ready plans
    staleTime: 15000,
    refetchOnMount: 'always', // Force refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when tab gets focus
  });
}

/**
 * Hook to create a new DCA plan
 */
export function useCreateDcaPlan() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: CreateDcaPlanParams) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      const provider = new AnchorProvider(
        connection,
        wallet as unknown as Wallet,
        { commitment: 'confirmed' }
      );

      console.log('🔄 Creating DCA plan:', params);

      // Ensure Router State is initialized before creating plans
      const isInitialized = await ensureRouterStateInitialized(
        connection,
        provider,
        wallet.publicKey
      );

      if (!isInitialized) {
        throw new Error('Failed to initialize Router State. Please try again.');
      }

      const { signature, planPda, planId } = await createDcaPlanTransaction(
        connection,
        provider,
        wallet.publicKey,
        params
      );

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      return {
        signature,
        planPda: planPda.toBase58(),
        planId: planId.toString('hex'),
        explorerUrl: getExplorerTxUrl(signature),
      };
    },
    onSuccess: (data) => {
      toast.success(
        `DCA Plan created successfully! Plan: ${data.planPda.slice(0, 8)}...`,
        { duration: 5000 }
      );

      // Invalidate queries to refresh plans list
      queryClient.invalidateQueries({ queryKey: ['dca-plans'] });
    },
    onError: (error: Error) => {
      console.error('❌ Failed to create DCA plan:', error);
      toast.error(`Failed to create plan: ${error.message.slice(0, 100)}`, { duration: 5000 });
    },
  });

  return {
    createPlan: mutation.mutate,
    createPlanAsync: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook to execute a DCA swap
 */
export function useExecuteDcaSwap() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ planPda, dcaPlan }: { planPda: PublicKey; dcaPlan: DcaPlan }) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      const provider = new AnchorProvider(
        connection,
        wallet as unknown as Wallet,
        { commitment: 'confirmed' }
      );

      console.log('🔄 Executing DCA swap:', planPda.toBase58());

      const signature = await executeDcaSwapTransaction(
        connection,
        provider,
        wallet.publicKey,
        planPda,
        dcaPlan
      );

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      return {
        signature,
        explorerUrl: getExplorerTxUrl(signature),
      };
    },
    onSuccess: () => {
      toast.success('DCA swap executed successfully!', { duration: 5000 });

      // Invalidate queries to refresh plans
      queryClient.invalidateQueries({ queryKey: ['dca-plans'] });
    },
    onError: (error: Error) => {
      console.error('❌ Failed to execute DCA swap:', error);
      toast.error(`Failed to execute swap: ${error.message.slice(0, 100)}`, { duration: 5000 });
    },
  });

  return {
    executeSwap: mutation.mutate,
    executeSwapAsync: mutation.mutateAsync,
    isExecuting: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook to pause a DCA plan
 */
export function usePauseDcaPlan() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (planPda: PublicKey) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      const provider = new AnchorProvider(
        connection,
        wallet as unknown as Wallet,
        { commitment: 'confirmed' }
      );

      console.log('⏸️  Pausing DCA plan:', planPda.toBase58());

      const signature = await pauseDcaPlanTransaction(
        connection,
        provider,
        wallet.publicKey,
        planPda
      );

      await connection.confirmTransaction(signature, 'confirmed');

      return {
        signature,
        explorerUrl: getExplorerTxUrl(signature),
      };
    },
    onSuccess: () => {
      toast.success('DCA plan paused', { duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ['dca-plans'] });
    },
    onError: (error: Error) => {
      console.error('❌ Failed to pause DCA plan:', error);
      toast.error(`Failed to pause plan: ${error.message.slice(0, 100)}`, { duration: 5000 });
    },
  });

  return {
    pausePlan: mutation.mutate,
    pausePlanAsync: mutation.mutateAsync,
    isPausing: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook to resume a DCA plan
 */
export function useResumeDcaPlan() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (planPda: PublicKey) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      const provider = new AnchorProvider(
        connection,
        wallet as unknown as Wallet,
        { commitment: 'confirmed' }
      );

      console.log('▶️  Resuming DCA plan:', planPda.toBase58());

      const signature = await resumeDcaPlanTransaction(
        connection,
        provider,
        wallet.publicKey,
        planPda
      );

      await connection.confirmTransaction(signature, 'confirmed');

      return {
        signature,
        explorerUrl: getExplorerTxUrl(signature),
      };
    },
    onSuccess: () => {
      toast.success('DCA plan resumed', { duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ['dca-plans'] });
    },
    onError: (error: Error) => {
      console.error('❌ Failed to resume DCA plan:', error);
      toast.error(`Failed to resume plan: ${error.message.slice(0, 100)}`, { duration: 5000 });
    },
  });

  return {
    resumePlan: mutation.mutate,
    resumePlanAsync: mutation.mutateAsync,
    isResuming: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook to cancel a DCA plan
 */
export function useCancelDcaPlan() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (planPda: PublicKey) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      const provider = new AnchorProvider(
        connection,
        wallet as unknown as Wallet,
        { commitment: 'confirmed' }
      );

      console.log('❌ Cancelling DCA plan:', planPda.toBase58());

      const signature = await cancelDcaPlanTransaction(
        connection,
        provider,
        wallet.publicKey,
        planPda
      );

      await connection.confirmTransaction(signature, 'confirmed');

      return {
        signature,
        explorerUrl: getExplorerTxUrl(signature),
      };
    },
    onSuccess: () => {
      toast.success('DCA plan cancelled and closed', { duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ['dca-plans'] });
    },
    onError: (error: Error) => {
      console.error('❌ Failed to cancel DCA plan:', error);
      toast.error(`Failed to cancel plan: ${error.message.slice(0, 100)}`, { duration: 5000 });
    },
  });

  return {
    cancelPlan: mutation.mutate,
    cancelPlanAsync: mutation.mutateAsync,
    isCancelling: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Helper hook to get plans that are ready for execution
 */
export function useReadyDcaPlans() {
  const { data: plans, ...rest } = useDcaPlans();

  const readyPlans = plans?.filter(plan => plan.readyForExecution) || [];

  return {
    readyPlans,
    count: readyPlans.length,
    hasReadyPlans: readyPlans.length > 0,
    ...rest,
  };
}

/**
 * Helper hook to get plan statistics
 */
export function useDcaStats() {
  const { data: plans } = useDcaPlans();

  if (!plans || plans.length === 0) {
    return {
      totalPlans: 0,
      activePlans: 0,
      pausedPlans: 0,
      completedPlans: 0,
      totalInvested: 0,
      totalReceived: 0,
    };
  }

  return {
    totalPlans: plans.length,
    activePlans: plans.filter(p => p.isActive && p.executedSwaps < p.totalSwaps).length,
    pausedPlans: plans.filter(p => !p.isActive && p.executedSwaps < p.totalSwaps).length,
    completedPlans: plans.filter(p => p.executedSwaps >= p.totalSwaps).length,
    totalInvested: plans.reduce((sum, p) => sum + p.totalInvested.toNumber(), 0),
    totalReceived: plans.reduce((sum, p) => sum + p.totalReceived.toNumber(), 0),
  };
}
