/**
 * TransactionProgress - Progression step-by-step des transactions
 * 
 * Affiche une progression claire et détaillée:
 * - Steps avec états (pending, current, complete, error)
 * - Animations fluides
 * - Messages contextuels
 * - Lien explorateur
 * 
 * @author SwapBack Team
 * @date December 2025
 */

"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Check, 
  Loader2, 
  Circle, 
  X, 
  ExternalLink,
  FileText,
  Wallet,
  Send,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export type TransactionStep = 
  | 'idle'
  | 'preparing'
  | 'signing'
  | 'sending'
  | 'confirming'
  | 'confirmed'
  | 'error';

export interface TransactionProgressProps {
  /** Étape actuelle */
  currentStep: TransactionStep;
  /** Signature de la transaction (si disponible) */
  signature?: string | null;
  /** Message d'erreur (si erreur) */
  errorMessage?: string;
  /** Mode compact ou détaillé */
  variant?: 'compact' | 'detailed';
  /** Tokens impliqués */
  inputToken?: { symbol: string; logoURI?: string };
  outputToken?: { symbol: string; logoURI?: string };
  /** Montants */
  inputAmount?: string;
  outputAmount?: string;
  /** Classes CSS additionnelles */
  className?: string;
}

// ============================================================================
// CONFIGURATION DES ÉTAPES
// ============================================================================

interface StepConfig {
  id: TransactionStep;
  label: string;
  description: string;
  icon: typeof FileText;
}

const STEPS: StepConfig[] = [
  { 
    id: 'preparing', 
    label: 'Preparing', 
    description: 'Building transaction...',
    icon: FileText,
  },
  { 
    id: 'signing', 
    label: 'Signing', 
    description: 'Confirm in your wallet',
    icon: Wallet,
  },
  { 
    id: 'sending', 
    label: 'Sending', 
    description: 'Broadcasting to network',
    icon: Send,
  },
  { 
    id: 'confirming', 
    label: 'Confirming', 
    description: 'Waiting for confirmation',
    icon: Loader2,
  },
];

// Ordre des étapes pour comparaison
const STEP_ORDER: TransactionStep[] = [
  'idle', 'preparing', 'signing', 'sending', 'confirming', 'confirmed', 'error'
];

// ============================================================================
// COMPOSANT
// ============================================================================

export function TransactionProgress({
  currentStep,
  signature,
  errorMessage,
  variant = 'detailed',
  inputToken,
  outputToken,
  inputAmount,
  outputAmount,
  className = '',
}: TransactionProgressProps) {
  // Déterminer le statut de chaque étape
  const getStepStatus = (stepId: TransactionStep): 'pending' | 'current' | 'complete' | 'error' => {
    if (currentStep === 'error') {
      const currentIndex = STEP_ORDER.indexOf(stepId);
      const errorIndex = STEP_ORDER.indexOf('error');
      // Toutes les étapes avant l'erreur sont complètes, sauf la dernière qui est en erreur
      if (currentIndex < errorIndex - 1) return 'complete';
      return 'error';
    }
    
    const stepIndex = STEP_ORDER.indexOf(stepId);
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  // URL Solscan
  const explorerUrl = useMemo(() => {
    if (!signature) return null;
    return `https://solscan.io/tx/${signature}`;
  }, [signature]);

  if (currentStep === 'idle') {
    return null;
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {currentStep === 'confirmed' ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"
            >
              <Check className="w-4 h-4 text-white" />
            </motion.div>
            <span className="text-sm text-emerald-400 font-medium">Transaction confirmed</span>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </>
        ) : currentStep === 'error' ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </motion.div>
            <span className="text-sm text-red-400 font-medium">Transaction failed</span>
          </>
        ) : (
          <>
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-sm text-gray-300">
              {STEPS.find(s => s.id === currentStep)?.description || 'Processing...'}
            </span>
          </>
        )}
      </div>
    );
  }

  // Version détaillée
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header avec tokens */}
      {inputToken && outputToken && (
        <div className="flex items-center justify-center gap-3 py-2">
          <div className="flex items-center gap-2">
            {inputToken.logoURI && (
              <img src={inputToken.logoURI} alt="" className="w-6 h-6 rounded-full" />
            )}
            <span className="text-sm text-white font-medium">
              {inputAmount} {inputToken.symbol}
            </span>
          </div>
          <span className="text-gray-500">→</span>
          <div className="flex items-center gap-2">
            {outputToken.logoURI && (
              <img src={outputToken.logoURI} alt="" className="w-6 h-6 rounded-full" />
            )}
            <span className="text-sm text-white font-medium">
              {outputAmount} {outputToken.symbol}
            </span>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-1">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.id);
          const StepIcon = step.icon;
          
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`
                flex items-center gap-3 p-3 rounded-xl transition-colors
                ${status === 'current' ? 'bg-blue-500/10' : ''}
                ${status === 'complete' ? 'bg-emerald-500/5' : ''}
                ${status === 'error' ? 'bg-red-500/10' : ''}
              `}
            >
              {/* Icon */}
              <div className="flex-shrink-0">
                {status === 'complete' && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </motion.div>
                )}
                {status === 'current' && (
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    {step.id === 'confirming' ? (
                      <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                    ) : (
                      <StepIcon className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                )}
                {status === 'pending' && (
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                    <Circle className="w-5 h-5 text-gray-600" />
                  </div>
                )}
                {status === 'error' && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center"
                  >
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  </motion.div>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${
                  status === 'complete' ? 'text-emerald-400' :
                  status === 'current' ? 'text-white' :
                  status === 'error' ? 'text-red-400' :
                  'text-gray-500'
                }`}>
                  {step.label}
                </div>
                <div className={`text-xs ${
                  status === 'current' ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  {status === 'current' ? step.description : ''}
                </div>
              </div>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div className="absolute left-[27px] top-[48px] w-0.5 h-4 bg-gray-700" />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Success state */}
      <AnimatePresence>
        {currentStep === 'confirmed' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-emerald-400 font-semibold">Transaction Confirmed!</div>
                <div className="text-xs text-gray-400">
                  Swap completed successfully
                </div>
              </div>
            </div>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 mt-3 py-2 px-4 bg-emerald-500/20 rounded-lg text-emerald-400 hover:bg-emerald-500/30 transition-colors text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                View on Solscan
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      <AnimatePresence>
        {currentStep === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                <X className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-red-400 font-semibold">Transaction Failed</div>
                <div className="text-xs text-gray-400">
                  {errorMessage || 'An error occurred during the swap'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TransactionProgress;
