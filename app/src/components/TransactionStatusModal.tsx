"use client";

/**
 * TransactionStatusModal - Modal flottant d'état de transaction style Jupiter
 * 
 * Affiche les étapes de la transaction dans une fenêtre modale overlay
 */

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, ExternalLink, X } from "lucide-react";

export type TransactionStatus = 'idle' | 'preparing' | 'signing' | 'sending' | 'confirming' | 'confirmed' | 'error';

interface TransactionStatusModalProps {
  isOpen: boolean;
  status: TransactionStatus;
  signature?: string | null;
  inputToken: { symbol: string; logoURI?: string };
  outputToken: { symbol: string; logoURI?: string };
  inputAmount: string;
  outputAmount: string;
  onClose: () => void;
  errorMessage?: string;
}

export function TransactionStatusModal({
  isOpen,
  status,
  signature,
  inputToken,
  outputToken,
  inputAmount,
  outputAmount,
  onClose,
  errorMessage,
}: TransactionStatusModalProps) {
  if (!isOpen) return null;

  const getStatusInfo = () => {
    switch (status) {
      case 'preparing':
        return { title: 'Préparation...', subtitle: 'Construction de la transaction' };
      case 'signing':
        return { title: 'En attente de signature', subtitle: 'Confirmez dans votre wallet' };
      case 'sending':
        return { title: 'Envoi en cours...', subtitle: 'Transaction envoyée au réseau' };
      case 'confirming':
        return { title: 'Confirmation...', subtitle: 'En attente de validation blockchain' };
      case 'confirmed':
        return { title: 'Transaction réussie !', subtitle: 'Votre swap a été confirmé' };
      case 'error':
        return { title: 'Échec de la transaction', subtitle: errorMessage || 'Une erreur est survenue' };
      default:
        return { title: '', subtitle: '' };
    }
  };

  const { title, subtitle } = getStatusInfo();
  const isLoading = ['preparing', 'signing', 'sending', 'confirming'].includes(status);
  const isSuccess = status === 'confirmed';
  const isError = status === 'error';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={isSuccess || isError ? onClose : undefined}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm"
          >
            <div className="bg-[#1a1b23] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header avec bouton fermer */}
              {(isSuccess || isError) && (
                <div className="flex justify-end p-3 pb-0">
                  <button
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Content */}
              <div className="p-6 pt-2 text-center">
                {/* Icône d'état */}
                <div className="flex justify-center mb-4">
                  {isLoading && (
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                      </div>
                      {/* Animation de pulse */}
                      <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                    </div>
                  )}
                  {isSuccess && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", duration: 0.5 }}
                      className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </motion.div>
                  )}
                  {isError && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", duration: 0.5 }}
                      className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center"
                    >
                      <XCircle className="w-10 h-10 text-red-400" />
                    </motion.div>
                  )}
                </div>

                {/* Titre et sous-titre */}
                <h3 className="text-xl font-semibold text-white mb-1">{title}</h3>
                <p className="text-sm text-gray-400 mb-6">{subtitle}</p>

                {/* Swap preview */}
                <div className="bg-white/5 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    {/* Input */}
                    <div className="flex items-center gap-2">
                      {inputToken.logoURI && (
                        <img src={inputToken.logoURI} alt="" className="w-8 h-8 rounded-full" />
                      )}
                      <div className="text-left">
                        <div className="text-white font-medium">{inputAmount}</div>
                        <div className="text-xs text-gray-400">{inputToken.symbol}</div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="text-gray-500 px-3">→</div>

                    {/* Output */}
                    <div className="flex items-center gap-2">
                      {outputToken.logoURI && (
                        <img src={outputToken.logoURI} alt="" className="w-8 h-8 rounded-full" />
                      )}
                      <div className="text-left">
                        <div className="text-white font-medium">{outputAmount}</div>
                        <div className="text-xs text-gray-400">{outputToken.symbol}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Étapes de progression */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  {/* Step 1: Préparation */}
                  <div className={`w-2 h-2 rounded-full transition-colors ${
                    status === 'preparing' ? 'bg-blue-400 animate-pulse' :
                    ['signing', 'sending', 'confirming', 'confirmed'].includes(status) ? 'bg-emerald-400' :
                    isError ? 'bg-red-400' : 'bg-gray-600'
                  }`} />
                  
                  <div className="w-6 h-px bg-gray-600" />
                  
                  {/* Step 2: Signature */}
                  <div className={`w-2 h-2 rounded-full transition-colors ${
                    status === 'signing' ? 'bg-blue-400 animate-pulse' :
                    ['sending', 'confirming', 'confirmed'].includes(status) ? 'bg-emerald-400' :
                    isError && status !== 'preparing' ? 'bg-red-400' : 'bg-gray-600'
                  }`} />
                  
                  <div className="w-6 h-px bg-gray-600" />
                  
                  {/* Step 3: Envoi */}
                  <div className={`w-2 h-2 rounded-full transition-colors ${
                    status === 'sending' ? 'bg-blue-400 animate-pulse' :
                    ['confirming', 'confirmed'].includes(status) ? 'bg-emerald-400' :
                    isError && ['sending', 'confirming'].includes(status) ? 'bg-red-400' : 'bg-gray-600'
                  }`} />
                  
                  <div className="w-6 h-px bg-gray-600" />
                  
                  {/* Step 4: Confirmation */}
                  <div className={`w-2 h-2 rounded-full transition-colors ${
                    status === 'confirming' ? 'bg-blue-400 animate-pulse' :
                    status === 'confirmed' ? 'bg-emerald-400' :
                    isError ? 'bg-red-400' : 'bg-gray-600'
                  }`} />
                </div>

                {/* Lien Solscan pour succès */}
                {isSuccess && signature && (
                  <a
                    href={`https://solscan.io/tx/${signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <span>Voir sur Solscan</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {/* Bouton fermer pour succès/erreur */}
                {(isSuccess || isError) && (
                  <button
                    onClick={onClose}
                    className="mt-4 w-full py-3 rounded-xl font-medium transition-colors bg-white/10 hover:bg-white/20 text-white"
                  >
                    Fermer
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
