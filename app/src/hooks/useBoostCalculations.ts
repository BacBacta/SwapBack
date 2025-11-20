/**
 * 🧮 Hook pour les Calculs de Boost (Client-Side)
 *
 * Ce hook fournit les fonctions de calcul de boost sans interaction blockchain.
 * Utile pour afficher des estimations avant de soumettre une transaction.
 *
 * @author SwapBack Team
 * @date October 26, 2025
 */

"use client";

import { useMemo, useCallback } from "react";

export type CNFTLevel = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface BoostCalculation {
  amountScore: number; // 0-5000 BP
  durationScore: number; // 0-5000 BP
  totalBoost: number; // 0-10000 BP
  boostPercentage: number; // 0-100%
  level: CNFTLevel;
}

export interface RebateCalculation {
  baseRebate: number;
  boost: number;
  multiplier: number;
  boostedRebate: number;
  extraGain: number;
}

export interface BuybackShareCalculation {
  totalBuyback: number;
  distributable: number; // 50%
  burnAmount: number; // 50%
  userBoost: number;
  totalCommunityBoost: number;
  userShare: number;
  sharePercentage: number;
}

export function useBoostCalculations() {
  /**
   * Calculer le boost dynamique basé sur montant et durée
   *
   * Formule: boost = min((amount/1000)×50 + (days/10)×100, 10000) BP
   */
  const calculateBoost = useCallback(
    (amount: number, durationDays: number): BoostCalculation => {
      // Score du montant (max 50% = 5000 BP)
      const amountInK = amount / 1000;
      const amountScore = Math.min(amountInK * 50, 5000);

      // Score de la durée (max 50% = 5000 BP)
      const durationInTens = durationDays / 10;
      const durationScore = Math.min(durationInTens * 100, 5000);

      // Total boost (max 100% = 10000 BP)
      const totalBoost = Math.min(amountScore + durationScore, 10000);
      const boostPercentage = totalBoost / 100;

      // Déterminer le niveau
      const level = determineLevel(amount);

      return {
        amountScore: Math.round(amountScore),
        durationScore: Math.round(durationScore),
        totalBoost: Math.round(totalBoost),
        boostPercentage: Math.round(boostPercentage * 10) / 10,
        level,
      };
    },
    []
  );

  /**
   * Calculer le rebate boosté
   *
   * Formule: rebate = base × (1 + boost/10000)
   */
  const calculateBoostedRebate = useCallback(
    (baseRebate: number, boostBP: number): RebateCalculation => {
      const multiplier = (10_000 + boostBP) / 10_000;
      const boostedRebate = baseRebate * multiplier;
      const extraGain = boostedRebate - baseRebate;

      return {
        baseRebate,
        boost: boostBP,
        multiplier: Math.round(multiplier * 1000) / 1000,
        boostedRebate: Math.round(boostedRebate * 100) / 100,
        extraGain: Math.round(extraGain * 100) / 100,
      };
    },
    []
  );

  /**
   * Calculer la part de buyback
   *
   * Formule: user_share = (user_boost / total_boost) × (buyback × 50%)
   */
  const calculateBuybackShare = useCallback(
    (
      totalBuyback: number,
      userBoost: number,
      totalCommunityBoost: number
    ): BuybackShareCalculation => {
      const distributable = totalBuyback * 0.5;
      const burnAmount = totalBuyback * 0.5;

      if (totalCommunityBoost === 0) {
        return {
          totalBuyback,
          distributable,
          burnAmount,
          userBoost,
          totalCommunityBoost,
          userShare: 0,
          sharePercentage: 0,
        };
      }

      const userShare = (distributable * userBoost) / totalCommunityBoost;
      const sharePercentage = (userBoost / totalCommunityBoost) * 100;

      return {
        totalBuyback,
        distributable,
        burnAmount,
        userBoost,
        totalCommunityBoost,
        userShare: Math.round(userShare * 100) / 100,
        sharePercentage: Math.round(sharePercentage * 10) / 10,
      };
    },
    []
  );

  /**
   * Estimer l'APY basé sur les rebates et buybacks
   */
  const estimateAPY = useCallback(
    (
      lockedAmount: number,
      boostBP: number,
      monthlySwapVolume: number,
      baseRebateRate: number, // Ex: 0.003 pour 0.3%
      monthlyBuybackTokens: number
    ): number => {
      // Revenus mensuels des rebates boostés
      const multiplier = (10_000 + boostBP) / 10_000;
      const monthlyRebateRevenue =
        monthlySwapVolume * baseRebateRate * (multiplier - 1);

      // Revenus mensuels des buybacks (estimation)
      const monthlyBuybackRevenue = monthlyBuybackTokens * 0.5; // Assume 50% share

      // Total mensuel
      const monthlyTotal = monthlyRebateRevenue + monthlyBuybackRevenue;

      // Annualisé
      const annualRevenue = monthlyTotal * 12;

      // APY
      const apy = (annualRevenue / lockedAmount) * 100;

      return Math.round(apy * 100) / 100;
    },
    []
  );

  /**
   * Obtenir des exemples de boost pour différents scénarios
   */
  const getBoostExamples = useMemo(
    () => [
      {
        name: "Débutant",
        amount: 1_000,
        days: 30,
        ...calculateBoost(1_000, 30),
      },
      {
        name: "Intermédiaire",
        amount: 10_000,
        days: 180,
        ...calculateBoost(10_000, 180),
      },
      {
        name: "Avancé",
        amount: 50_000,
        days: 365,
        ...calculateBoost(50_000, 365),
      },
      {
        name: "Whale",
        amount: 100_000,
        days: 365,
        ...calculateBoost(100_000, 365),
      },
      {
        name: "Maximum",
        amount: 100_000,
        days: 730,
        ...calculateBoost(100_000, 730),
      },
    ],
    [calculateBoost]
  );

  /**
   * Obtenir des exemples de rebates
   */
  const getRebateExamples = useCallback(
    (baseRebate: number = 3) => [
      {
        scenario: "Sans boost",
        ...calculateBoostedRebate(baseRebate, 0),
      },
      {
        scenario: "Boost 23% (10k × 180j)",
        ...calculateBoostedRebate(baseRebate, 2300),
      },
      {
        scenario: "Boost 86.5% (100k × 365j)",
        ...calculateBoostedRebate(baseRebate, 8650),
      },
      {
        scenario: "Boost 100% (max)",
        ...calculateBoostedRebate(baseRebate, 10000),
      },
    ],
    [calculateBoostedRebate]
  );

  return {
    // Fonctions de calcul
    calculateBoost,
    calculateBoostedRebate,
    calculateBuybackShare,
    estimateAPY,

    // Exemples pré-calculés
    boostExamples: getBoostExamples,
    getRebateExamples,
  };
}

/**
 * Déterminer le niveau basé sur le montant locké
 */
function determineLevel(amount: number): CNFTLevel {
  if (amount >= 50_000) return "diamond";
  if (amount >= 25_000) return "platinum";
  if (amount >= 10_000) return "gold";
  if (amount >= 5_000) return "silver";
  return "bronze";
}

/**
 * Obtenir les seuils de niveau
 */
export function getLevelThresholds() {
  return {
    bronze: { min: 0, max: 4_999 },
    silver: { min: 5_000, max: 9_999 },
    gold: { min: 10_000, max: 24_999 },
    platinum: { min: 25_000, max: 49_999 },
    diamond: { min: 50_000, max: Infinity },
  };
}

/**
 * Obtenir les avantages de chaque niveau
 */
export function getLevelBenefits() {
  return {
    bronze: {
      name: "Bronze",
      icon: "🥉",
      maxBoost: "50%",
      benefits: ["Rebates boostés", "Distribution buyback"],
    },
    silver: {
      name: "Silver",
      icon: "🥈",
      maxBoost: "70%",
      benefits: ["Rebates boostés", "Distribution buyback", "Badge spécial"],
    },
    gold: {
      name: "Gold",
      icon: "🥇",
      maxBoost: "85%",
      benefits: [
        "Rebates boostés",
        "Distribution buyback",
        "Badge spécial",
        "Accès prioritaire",
      ],
    },
    platinum: {
      name: "Platinum",
      icon: "💎",
      maxBoost: "95%",
      benefits: [
        "Rebates boostés",
        "Distribution buyback",
        "Badge spécial",
        "Accès prioritaire",
        "Gouvernance",
      ],
    },
    diamond: {
      name: "Diamond",
      icon: "💎",
      maxBoost: "100%",
      benefits: [
        "Rebates boostés max",
        "Distribution buyback max",
        "Badge exclusif",
        "Accès VIP",
        "Gouvernance premium",
      ],
    },
  };
}
