/**
 * 💰 Composant ClaimBuyback - Interface de Réclamation des Buybacks
 *
 * Permet aux utilisateurs de:
 * - Voir le buyback disponible total
 * - Calculer leur part proportionnelle basée sur le boost
 * - Claim leur portion de tokens $BACK
 * - Consulter l'historique des claims
 *
 * @author SwapBack Team
 * @date October 26, 2025
 */

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useBoostSystem } from "../hooks/useBoostSystem";
import { useBoostCalculations } from "../hooks/useBoostCalculations";

interface BuybackStats {
  totalAvailable: number;
  totalClaimed: number;
  totalBurned: number;
  userClaimable: number;
  userBoost: number;
  totalCommunityBoost: number;
}

interface ClaimHistory {
  timestamp: number;
  amount: number;
  signature: string;
  boost: number;
  sharePercentage: number;
}

export default function ClaimBuyback() {
  const { connected, publicKey } = useWallet();
  const { claimBuyback, calculateBuybackShare } = useBoostSystem();
  const { calculateBuybackShare: calcShare } = useBoostCalculations();

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [stats, setStats] = useState<BuybackStats | null>(null);
  const [claimHistory, setClaimHistory] = useState<ClaimHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculs temps réel
  const buybackCalculation = useMemo(() => {
    if (!stats) return null;

    return calcShare(
      stats.totalAvailable,
      stats.userBoost,
      stats.totalCommunityBoost
    );
  }, [stats, calcShare]);

  // Charger les stats au montage
  useEffect(() => {
    if (connected && publicKey) {
      loadBuybackStats();
      loadClaimHistory();
    }
  }, [connected, publicKey]);

  const loadBuybackStats = async () => {
    setIsLoading(true);
    try {
      // TODO: Fetch real data from blockchain
      // Pour l'instant, données de démo
      const mockStats: BuybackStats = {
        totalAvailable: 1_000_000, // 1M BACK disponible
        totalClaimed: 250_000, // 250k BACK déjà claimed
        totalBurned: 250_000, // 250k BACK brûlés
        userClaimable: 0, // Sera calculé
        userBoost: 8650, // 86.5% boost (exemple)
        totalCommunityBoost: 100_000, // 100k BP total
      };

      // Calculer la part utilisateur
      const userShare = calcShare(
        mockStats.totalAvailable,
        mockStats.userBoost,
        mockStats.totalCommunityBoost
      );
      mockStats.userClaimable = userShare.userShare;

      setStats(mockStats);
    } catch (err) {
      console.error("Erreur chargement stats:", err);
      setError("Impossible de charger les statistiques");
    } finally {
      setIsLoading(false);
    }
  };

  const loadClaimHistory = async () => {
    try {
      // TODO: Fetch real history from blockchain
      const mockHistory: ClaimHistory[] = [
        {
          timestamp: Date.now() - 86400000 * 7, // Il y a 7 jours
          amount: 5250,
          signature: "3x7Ym...",
          boost: 8650,
          sharePercentage: 8.65,
        },
        {
          timestamp: Date.now() - 86400000 * 14, // Il y a 14 jours
          amount: 4800,
          signature: "2aB9c...",
          boost: 7900,
          sharePercentage: 7.9,
        },
      ];

      setClaimHistory(mockHistory);
    } catch (err) {
      console.error("Erreur chargement historique:", err);
    }
  };

  const handleClaim = async () => {
    if (!stats || stats.userClaimable === 0) {
      setError("Aucun buyback à réclamer");
      return;
    }

    setIsClaiming(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Claim avec le montant max disponible
      const signature = await claimBuyback({
        maxTokens: stats.totalAvailable,
      });

      setSuccessMessage(
        `✅ Claim réussi! ${stats.userClaimable.toFixed(2)} BACK réclamés`
      );

      // Recharger les stats
      await loadBuybackStats();
      await loadClaimHistory();
    } catch (err: any) {
      console.error("Erreur claim:", err);
      setError(err.message || "Échec du claim");
    } finally {
      setIsClaiming(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  if (!connected) {
    return (
      <div className="claim-buyback-container">
        <div className="not-connected">
          <h2>💰 Claim Buyback</h2>
          <p>Connectez votre wallet pour voir vos buybacks disponibles</p>
        </div>
      </div>
    );
  }

  return (
    <div className="claim-buyback-container">
      <div className="header">
        <h2>💰 Claim Your Buyback Share</h2>
        <p className="subtitle">
          Réclamez votre part proportionnelle du buyback basée sur votre boost
        </p>
      </div>

      {/* Stats Globales */}
      {isLoading ? (
        <div className="loading">Chargement des statistiques...</div>
      ) : stats ? (
        <>
          <div className="stats-grid">
            <div className="stat-card primary">
              <div className="stat-icon">🎁</div>
              <div className="stat-content">
                <p className="stat-label">Buyback Disponible Total</p>
                <p className="stat-value">{formatNumber(stats.totalAvailable)} BACK</p>
                <p className="stat-detail">50% distribués, 50% brûlés</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <p className="stat-label">Votre Boost</p>
                <p className="stat-value">{(stats.userBoost / 100).toFixed(1)}%</p>
                <p className="stat-detail">
                  {stats.userBoost.toLocaleString()} BP / {stats.totalCommunityBoost.toLocaleString()} BP total
                </p>
              </div>
            </div>

            <div className="stat-card success">
              <div className="stat-icon">💎</div>
              <div className="stat-content">
                <p className="stat-label">Votre Part</p>
                <p className="stat-value">{formatNumber(stats.userClaimable)} BACK</p>
                <p className="stat-detail">
                  {buybackCalculation?.sharePercentage.toFixed(3)}% du total
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🔥</div>
              <div className="stat-content">
                <p className="stat-label">Brûlés (Deflationary)</p>
                <p className="stat-value">{formatNumber(stats.totalBurned)} BACK</p>
                <p className="stat-detail">50% brûlés en permanence</p>
              </div>
            </div>
          </div>

          {/* Calcul Détaillé */}
          {buybackCalculation && (
            <div className="calculation-breakdown">
              <h3>📐 Calcul de Votre Part</h3>
              <div className="calc-steps">
                <div className="calc-step">
                  <span className="step-number">1</span>
                  <div className="step-content">
                    <p className="step-label">Total Buyback</p>
                    <p className="step-value">{formatNumber(buybackCalculation.totalBuyback)} BACK</p>
                  </div>
                </div>

                <div className="calc-arrow">→</div>

                <div className="calc-step">
                  <span className="step-number">2</span>
                  <div className="step-content">
                    <p className="step-label">Distribuable (50%)</p>
                    <p className="step-value">{formatNumber(buybackCalculation.distributable)} BACK</p>
                  </div>
                </div>

                <div className="calc-arrow">→</div>

                <div className="calc-step">
                  <span className="step-number">3</span>
                  <div className="step-content">
                    <p className="step-label">Votre Part ({buybackCalculation.sharePercentage.toFixed(2)}%)</p>
                    <p className="step-value highlight">{formatNumber(buybackCalculation.userShare)} BACK</p>
                  </div>
                </div>
              </div>

              <div className="formula">
                <p>Formule: user_share = (user_boost / total_boost) × (buyback × 50%)</p>
                <p className="formula-calc">
                  = ({stats.userBoost.toLocaleString()} / {stats.totalCommunityBoost.toLocaleString()}) × {formatNumber(buybackCalculation.distributable)} BACK
                </p>
                <p className="formula-result">= {formatNumber(buybackCalculation.userShare)} BACK</p>
              </div>
            </div>
          )}

          {/* Bouton Claim */}
          <div className="claim-section">
            <button
              className="claim-button"
              onClick={handleClaim}
              disabled={isClaiming || stats.userClaimable === 0}
            >
              {isClaiming ? (
                <>
                  <span className="spinner"></span>
                  Claiming...
                </>
              ) : stats.userClaimable > 0 ? (
                `🎁 Claim ${formatNumber(stats.userClaimable)} BACK`
              ) : (
                "Aucun buyback disponible"
              )}
            </button>

            {error && <div className="error-message">❌ {error}</div>}
            {successMessage && <div className="success-message">{successMessage}</div>}
          </div>

          {/* Historique */}
          {claimHistory.length > 0 && (
            <div className="claim-history">
              <h3>📜 Historique des Claims</h3>
              <div className="history-table">
                <div className="history-header">
                  <span>Date</span>
                  <span>Montant</span>
                  <span>Boost</span>
                  <span>Part</span>
                  <span>Transaction</span>
                </div>
                {claimHistory.map((claim, index) => (
                  <div key={index} className="history-row">
                    <span>{formatDate(claim.timestamp)}</span>
                    <span className="amount">{formatNumber(claim.amount)} BACK</span>
                    <span>{(claim.boost / 100).toFixed(1)}%</span>
                    <span>{claim.sharePercentage.toFixed(2)}%</span>
                    <a
                      href={`https://explorer.solana.com/tx/${claim.signature}?cluster=${process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'testnet'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="signature-link"
                    >
                      {claim.signature}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="info-box">
            <h4>ℹ️ Comment ça marche?</h4>
            <ul>
              <li>
                <strong>Distribution proportionnelle:</strong> Votre part est calculée selon votre boost par rapport au boost total de la communauté
              </li>
              <li>
                <strong>Split 50/50:</strong> 50% du buyback est distribué aux holders, 50% est brûlé (déflationniste)
              </li>
              <li>
                <strong>Boost dynamique:</strong> Plus vous lockez (montant + durée), plus votre part est importante
              </li>
              <li>
                <strong>Claim à tout moment:</strong> Réclamez vos tokens quand vous voulez, ils s'accumulent
              </li>
            </ul>
          </div>
        </>
      ) : (
        <div className="error">Impossible de charger les données</div>
      )}

      <style jsx>{`
        .claim-buyback-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .header h2 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subtitle {
          color: #666;
          font-size: 1rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          display: flex;
          gap: 1rem;
          transition: transform 0.2s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .stat-card.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .stat-card.success {
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          color: white;
        }

        .stat-icon {
          font-size: 2.5rem;
        }

        .stat-content {
          flex: 1;
        }

        .stat-label {
          font-size: 0.85rem;
          opacity: 0.9;
          margin-bottom: 0.25rem;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: bold;
          margin-bottom: 0.25rem;
        }

        .stat-detail {
          font-size: 0.8rem;
          opacity: 0.8;
        }

        .calculation-breakdown {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 2rem;
          margin-bottom: 2rem;
        }

        .calculation-breakdown h3 {
          margin-bottom: 1.5rem;
          color: #333;
        }

        .calc-steps {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .calc-step {
          flex: 1;
          min-width: 150px;
          background: white;
          border-radius: 8px;
          padding: 1rem;
          text-align: center;
        }

        .step-number {
          display: inline-block;
          width: 30px;
          height: 30px;
          background: #667eea;
          color: white;
          border-radius: 50%;
          line-height: 30px;
          margin-bottom: 0.5rem;
          font-weight: bold;
        }

        .step-label {
          font-size: 0.85rem;
          color: #666;
          margin-bottom: 0.5rem;
        }

        .step-value {
          font-size: 1.2rem;
          font-weight: bold;
          color: #333;
        }

        .step-value.highlight {
          color: #11998e;
        }

        .calc-arrow {
          font-size: 2rem;
          color: #667eea;
        }

        .formula {
          background: white;
          border-left: 4px solid #667eea;
          padding: 1rem;
          border-radius: 4px;
        }

        .formula p {
          margin: 0.5rem 0;
          font-family: monospace;
        }

        .formula-result {
          color: #11998e;
          font-weight: bold;
          font-size: 1.1rem;
        }

        .claim-section {
          text-align: center;
          margin-bottom: 2rem;
        }

        .claim-button {
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          color: white;
          border: none;
          padding: 1rem 3rem;
          font-size: 1.2rem;
          font-weight: bold;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .claim-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(17, 153, 142, 0.4);
        }

        .claim-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-message,
        .success-message {
          margin-top: 1rem;
          padding: 1rem;
          border-radius: 8px;
          font-weight: 500;
        }

        .error-message {
          background: #fee;
          color: #c33;
          border: 1px solid #fcc;
        }

        .success-message {
          background: #efe;
          color: #3c3;
          border: 1px solid #cfc;
        }

        .claim-history {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          margin-bottom: 2rem;
        }

        .claim-history h3 {
          margin-bottom: 1.5rem;
        }

        .history-table {
          overflow-x: auto;
        }

        .history-header,
        .history-row {
          display: grid;
          grid-template-columns: 180px 150px 80px 80px 1fr;
          gap: 1rem;
          padding: 1rem;
          align-items: center;
        }

        .history-header {
          font-weight: bold;
          border-bottom: 2px solid #eee;
          color: #666;
          font-size: 0.9rem;
        }

        .history-row {
          border-bottom: 1px solid #f0f0f0;
        }

        .history-row:hover {
          background: #f8f9fa;
        }

        .history-row .amount {
          font-weight: bold;
          color: #11998e;
        }

        .signature-link {
          color: #667eea;
          text-decoration: none;
          font-family: monospace;
          font-size: 0.85rem;
        }

        .signature-link:hover {
          text-decoration: underline;
        }

        .info-box {
          background: #e8f4f8;
          border-left: 4px solid #667eea;
          border-radius: 8px;
          padding: 1.5rem;
        }

        .info-box h4 {
          margin-bottom: 1rem;
          color: #333;
        }

        .info-box ul {
          list-style: none;
          padding: 0;
        }

        .info-box li {
          padding: 0.5rem 0;
          color: #555;
        }

        .info-box strong {
          color: #667eea;
        }

        .not-connected,
        .loading,
        .error {
          text-align: center;
          padding: 3rem;
          color: #666;
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .calc-steps {
            flex-direction: column;
          }

          .calc-arrow {
            transform: rotate(90deg);
          }

          .history-header,
          .history-row {
            grid-template-columns: 1fr;
            gap: 0.5rem;
          }

          .history-header span,
          .history-row span,
          .history-row a {
            text-align: left;
          }

          .history-header span::before {
            content: attr(data-label);
            font-weight: bold;
            display: inline-block;
            width: 100px;
          }
        }
      `}</style>
    </div>
  );
}
