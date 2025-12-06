"use client";

/**
 * SimpleBuybackCard - Interface Buyback simplifiée
 * 
 * Design épuré avec :
 * - Vue d'ensemble en hero (stats principales)
 * - Sections collapsibles (historique, FAQ)
 * - Palette de couleurs unifiée
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Flame, 
  TrendingUp, 
  Clock, 
  ChevronDown, 
  Loader2,
  CheckCircle,
  ExternalLink,
  HelpCircle,
  BarChart3,
  Coins,
  Zap
} from "lucide-react";
import { useBuybackState } from "@/hooks/useBuybackState";
import { useExecuteBuyback } from "@/hooks/useExecuteBuyback";
import { useBuybackHistory } from "@/hooks/useBuybackHistory";
import toast from "react-hot-toast";

type SectionId = "history" | "faq" | "how";

export function SimpleBuybackCard() {
  const { buybackState, isLoading, error } = useBuybackState();
  const { execute: executeBuyback, isExecuting } = useExecuteBuyback();
  const [expandedSection, setExpandedSection] = useState<SectionId | null>(null);

  const toggleSection = (id: SectionId) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const handleExecuteBuyback = async () => {
    if (!buybackState?.pendingUsdc || buybackState.pendingUsdc <= 0) {
      toast.error("Aucun USDC en attente pour le buyback");
      return;
    }

    try {
      const result = await executeBuyback({
        usdcAmount: buybackState.pendingUsdc,
        minBackAmount: 0 // No slippage protection for simplicity
      });
      
      if (result) {
        toast.success(`Buyback exécuté ! ${result.backBurned.toLocaleString()} BACK brûlés`);
      }
    } catch (err) {
      console.error("Buyback error:", err);
      // Error toast is handled by the hook
    }
  };

  // Format numbers
  const formatNumber = (num: number, decimals = 2) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(decimals);
  };

  if (error) {
    return (
      <div className="w-full max-w-lg mx-auto theme-light">
        <div className="card-simple p-6 text-center">
          <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ExternalLink className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-red-400 mb-4">Erreur de chargement</p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-simple-secondary"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !buybackState) {
    return (
      <div className="w-full max-w-lg mx-auto theme-light">
        <div className="card-simple p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-gray-400">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = buybackState.progressPercent || 0;
  const canExecute = buybackState.canExecute || false;

  return (
    <div className="w-full max-w-lg mx-auto theme-light">
      <div className="space-y-4">
        
        {/* Hero Stats */}
        <div className="card-simple">
          {/* Main metric */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500/10 rounded-2xl mb-4">
              <Flame className="w-8 h-8 text-orange-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-1">
              {formatNumber(buybackState.totalBackBurned || 0)} BACK
            </h2>
            <p className="text-gray-400">Total brûlé</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">
                ${formatNumber(buybackState.totalUsdcSpent || 0)}
              </div>
              <div className="text-xs text-gray-400">USDC dépensé</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-emerald-400">
                {buybackState.buybackCount || 0}
              </div>
              <div className="text-xs text-gray-400">Buybacks</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white">
                ${formatNumber(buybackState.vaultBalance || 0)}
              </div>
              <div className="text-xs text-gray-400">Dans le vault</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Prochain buyback</span>
              <span className="text-white font-medium">{progressPercent.toFixed(0)}%</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>${formatNumber(buybackState.vaultBalance || 0)}</span>
              <span>Seuil: ${formatNumber(buybackState.minBuybackAmount || 100)}</span>
            </div>
          </div>

          {/* Execute button */}
          {canExecute ? (
            <button
              onClick={handleExecuteBuyback}
              disabled={isExecuting}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Exécution...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Lancer le Buyback
                </>
              )}
            </button>
          ) : (
            <div className="w-full py-3 bg-white/5 text-gray-400 text-center rounded-xl text-sm">
              Buyback automatique à {progressPercent >= 100 ? "100" : "100"}%
            </div>
          )}
        </div>

        {/* Collapsible: Comment ça marche */}
        <CollapsibleSection
          id="how"
          title="Comment ça marche"
          icon={<HelpCircle className="w-5 h-5" />}
          isExpanded={expandedSection === "how"}
          onToggle={() => toggleSection("how")}
        >
          <div className="space-y-4">
            <Step 
              number={1} 
              title="Collecte des frais"
              description="0.2% des frais de swap sont envoyés au vault de buyback"
            />
            <Step 
              number={2} 
              title="Accumulation"
              description="Les USDC s'accumulent jusqu'au seuil minimum"
            />
            <Step 
              number={3} 
              title="Exécution automatique"
              description="Le buyback achète des BACK sur le marché"
            />
            <Step 
              number={4} 
              title="Burn"
              description="100% des BACK achetés sont brûlés définitivement"
            />
          </div>
        </CollapsibleSection>

        {/* Collapsible: Historique */}
        <CollapsibleSection
          id="history"
          title="Historique récent"
          icon={<Clock className="w-5 h-5" />}
          isExpanded={expandedSection === "history"}
          onToggle={() => toggleSection("history")}
        >
          <RecentBuybacksList />
        </CollapsibleSection>

        {/* Collapsible: FAQ */}
        <CollapsibleSection
          id="faq"
          title="Questions fréquentes"
          icon={<BarChart3 className="w-5 h-5" />}
          isExpanded={expandedSection === "faq"}
          onToggle={() => toggleSection("faq")}
        >
          <div className="space-y-3">
            <FAQItem 
              question="Qu'est-ce que le buyback ?"
              answer="Le buyback est un mécanisme qui utilise les frais collectés pour racheter et brûler des tokens BACK, réduisant ainsi l'offre en circulation."
            />
            <FAQItem 
              question="À quelle fréquence ont lieu les buybacks ?"
              answer="Les buybacks sont exécutés automatiquement dès que le vault atteint le seuil minimum de 100 USDC."
            />
            <FAQItem 
              question="Puis-je déclencher un buyback manuellement ?"
              answer="Oui, si le seuil est atteint, n'importe qui peut déclencher le buyback en cliquant sur le bouton."
            />
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}

// Section collapsible
function CollapsibleSection({ 
  id, 
  title, 
  icon, 
  isExpanded, 
  onToggle, 
  children 
}: { 
  id: string;
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card-simple !p-0 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-gray-400">{icon}</div>
          <span className="font-medium text-white">{title}</span>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-white/5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Step component
function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 bg-emerald-500/15 rounded-full flex items-center justify-center flex-shrink-0">
        <span className="text-emerald-400 font-bold text-sm">{number}</span>
      </div>
      <div>
        <div className="font-medium text-white">{title}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
    </div>
  );
}

// FAQ Item
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="border-b border-white/5 last:border-0 pb-3 last:pb-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between text-left"
      >
        <span className="font-medium text-white pr-4">{question}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="text-sm text-gray-400 mt-2">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Recent buybacks list with real data
function RecentBuybacksList() {
  const { buybacks, isLoading } = useBuybackHistory();
  
  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  // Map buyback history to display format
  const recentBuybacks = buybacks.slice(0, 5).map(bb => ({
    date: new Date(bb.timestamp * 1000).toLocaleDateString('fr-FR'),
    amount: bb.usdcAmount,
    burned: bb.backBurned,
    signature: bb.signature
  }));

  if (recentBuybacks.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400">
        <Coins className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Aucun buyback récent</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recentBuybacks.map((bb, i) => (
        <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
          <div>
            <div className="text-white font-medium">{bb.burned.toLocaleString()} BACK brûlés</div>
            <div className="text-xs text-gray-400">{bb.date}</div>
          </div>
          <div className="text-right">
            <div className="text-emerald-400">${bb.amount}</div>
            <div className="text-xs text-gray-500">dépensé</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default SimpleBuybackCard;
