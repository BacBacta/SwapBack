"use client";

/**
 * 💵 Fiat Equivalent Display Component
 * 
 * Affiche les équivalents en monnaie fiat:
 * - Montant d'entrée en USD/EUR
 * - Montant de sortie en USD/EUR
 * - Cashback en USD/EUR
 * - Frais en USD/EUR
 * 
 * Utilise un cache pour les taux de change.
 * 
 * @author SwapBack Team
 * @date January 2025
 */

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, Euro, RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export type FiatCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF';

export interface TokenAmount {
  amount: number;
  symbol: string;
  mint: string;
}

export interface FiatEquivalentProps {
  inputToken: TokenAmount;
  outputToken: TokenAmount;
  cashbackAmount?: number;
  feeAmount?: number;
  currency?: FiatCurrency;
  showTrend?: boolean;
  compact?: boolean;
  className?: string;
}

export interface PriceData {
  price: number;
  change24h: number;
  currency: FiatCurrency;
  timestamp: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CURRENCY_SYMBOLS: Record<FiatCurrency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CHF: 'CHF',
};

const CURRENCY_LOCALES: Record<FiatCurrency, string> = {
  USD: 'en-US',
  EUR: 'fr-FR',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  CHF: 'de-CH',
};

// Cache de prix (token mint -> price data)
const priceCache = new Map<string, { data: PriceData; expiry: number }>();
const CACHE_TTL_MS = 30000; // 30 secondes

// ============================================================================
// PRICE FETCHING
// ============================================================================

async function fetchTokenPrice(mint: string, currency: FiatCurrency = 'USD'): Promise<PriceData | null> {
  const cacheKey = `${mint}:${currency}`;
  const cached = priceCache.get(cacheKey);
  
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }
  
  try {
    // Utiliser l'API proxy pour éviter CORS
    const response = await fetch(`/api/price?mint=${mint}&currency=${currency}`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      // Fallback sur l'API Jupiter
      const jupResponse = await fetch(`https://api.jup.ag/price/v2?ids=${mint}`, {
        signal: AbortSignal.timeout(3000),
      });
      
      if (jupResponse.ok) {
        const data = await jupResponse.json();
        const price = data?.data?.[mint]?.price ?? 0;
        
        const priceData: PriceData = {
          price,
          change24h: 0,
          currency,
          timestamp: Date.now(),
        };
        
        priceCache.set(cacheKey, { data: priceData, expiry: Date.now() + CACHE_TTL_MS });
        return priceData;
      }
      
      return null;
    }
    
    const data = await response.json();
    const priceData: PriceData = {
      price: data.price ?? 0,
      change24h: data.change24h ?? 0,
      currency,
      timestamp: Date.now(),
    };
    
    priceCache.set(cacheKey, { data: priceData, expiry: Date.now() + CACHE_TTL_MS });
    return priceData;
  } catch {
    return null;
  }
}

// ============================================================================
// HOOKS
// ============================================================================

function useTokenPrices(tokens: TokenAmount[], currency: FiatCurrency) {
  const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  
  useEffect(() => {
    const fetchPrices = async () => {
      setLoading(true);
      
      const uniqueMints = [...new Set(tokens.map(t => t.mint))];
      const results = await Promise.all(
        uniqueMints.map(mint => fetchTokenPrice(mint, currency))
      );
      
      const newPrices = new Map<string, PriceData>();
      for (let i = 0; i < uniqueMints.length; i++) {
        if (results[i]) {
          newPrices.set(uniqueMints[i], results[i]!);
        }
      }
      
      setPrices(newPrices);
      setLoading(false);
      setLastUpdate(Date.now());
    };
    
    fetchPrices();
    
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [tokens.map(t => t.mint).join(','), currency]);
  
  return { prices, loading, lastUpdate };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FiatEquivalent({
  inputToken,
  outputToken,
  cashbackAmount = 0,
  feeAmount = 0,
  currency = 'USD',
  showTrend = true,
  compact = false,
  className = '',
}: FiatEquivalentProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<FiatCurrency>(currency);
  const [showCurrencySelect, setShowCurrencySelect] = useState(false);
  
  const { prices, loading, lastUpdate } = useTokenPrices(
    [inputToken, outputToken],
    selectedCurrency
  );
  
  // Calculer les équivalents fiat
  const fiatValues = useMemo(() => {
    const inputPrice = prices.get(inputToken.mint);
    const outputPrice = prices.get(outputToken.mint);
    
    return {
      inputFiat: inputPrice ? inputToken.amount * inputPrice.price : null,
      outputFiat: outputPrice ? outputToken.amount * outputPrice.price : null,
      cashbackFiat: outputPrice && cashbackAmount > 0 ? cashbackAmount * outputPrice.price : null,
      feeFiat: outputPrice && feeAmount > 0 ? feeAmount * outputPrice.price : null,
      inputChange24h: inputPrice?.change24h ?? 0,
      outputChange24h: outputPrice?.change24h ?? 0,
    };
  }, [prices, inputToken, outputToken, cashbackAmount, feeAmount]);
  
  const formatFiat = (value: number | null) => {
    if (value === null) return '—';
    
    return new Intl.NumberFormat(CURRENCY_LOCALES[selectedCurrency], {
      style: 'currency',
      currency: selectedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };
  
  const currencySymbol = CURRENCY_SYMBOLS[selectedCurrency];
  
  if (compact) {
    return (
      <CompactFiatDisplay
        inputFiat={fiatValues.inputFiat}
        outputFiat={fiatValues.outputFiat}
        currency={selectedCurrency}
        loading={loading}
        formatFiat={formatFiat}
      />
    );
  }
  
  return (
    <div className={`bg-gray-800/30 rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <DollarSign className="w-4 h-4" />
          <span>Équivalent Fiat</span>
        </div>
        
        {/* Currency Selector */}
        <div className="relative">
          <button
            onClick={() => setShowCurrencySelect(!showCurrencySelect)}
            className="flex items-center gap-1 px-2 py-1 bg-gray-700/50 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <span>{currencySymbol}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showCurrencySelect ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {showCurrencySelect && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute right-0 top-full mt-1 bg-gray-700 rounded-lg shadow-lg overflow-hidden z-10"
              >
                {(['USD', 'EUR', 'GBP', 'CHF'] as FiatCurrency[]).map((curr) => (
                  <button
                    key={curr}
                    onClick={() => {
                      setSelectedCurrency(curr);
                      setShowCurrencySelect(false);
                    }}
                    className={`
                      w-full px-3 py-2 text-left text-sm flex items-center gap-2
                      ${curr === selectedCurrency ? 'bg-blue-600/30 text-blue-400' : 'text-gray-300 hover:bg-gray-600'}
                    `}
                  >
                    <span>{CURRENCY_SYMBOLS[curr]}</span>
                    <span>{curr}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Values Grid */}
      <div className="space-y-2">
        {/* Input Value */}
        <FiatRow
          label="Vous payez"
          value={fiatValues.inputFiat}
          change={showTrend ? fiatValues.inputChange24h : undefined}
          formatFiat={formatFiat}
          loading={loading}
        />
        
        {/* Output Value */}
        <FiatRow
          label="Vous recevez"
          value={fiatValues.outputFiat}
          change={showTrend ? fiatValues.outputChange24h : undefined}
          formatFiat={formatFiat}
          loading={loading}
          highlight
        />
        
        {/* Cashback */}
        {fiatValues.cashbackFiat !== null && fiatValues.cashbackFiat > 0 && (
          <FiatRow
            label="Cashback"
            value={fiatValues.cashbackFiat}
            formatFiat={formatFiat}
            loading={loading}
            positive
          />
        )}
        
        {/* Fee */}
        {fiatValues.feeFiat !== null && fiatValues.feeFiat > 0 && (
          <FiatRow
            label="Frais"
            value={fiatValues.feeFiat}
            formatFiat={formatFiat}
            loading={loading}
            negative
          />
        )}
      </div>
      
      {/* Last Update */}
      <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between text-xs text-gray-500">
        <span>
          {loading ? 'Chargement...' : `Mis à jour ${formatTimeAgo(lastUpdate)}`}
        </span>
        <button
          onClick={() => {
            priceCache.clear();
            window.location.reload();
          }}
          className="flex items-center gap-1 hover:text-gray-400 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface FiatRowProps {
  label: string;
  value: number | null;
  change?: number;
  formatFiat: (value: number | null) => string;
  loading: boolean;
  highlight?: boolean;
  positive?: boolean;
  negative?: boolean;
}

function FiatRow({ 
  label, 
  value, 
  change, 
  formatFiat, 
  loading,
  highlight = false,
  positive = false,
  negative = false,
}: FiatRowProps) {
  const TrendIcon = change !== undefined && change !== 0
    ? change > 0 ? TrendingUp : TrendingDown
    : Minus;
  
  const trendColor = change !== undefined && change !== 0
    ? change > 0 ? 'text-green-400' : 'text-red-400'
    : 'text-gray-500';
  
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {loading ? (
          <div className="w-16 h-4 bg-gray-700 rounded animate-pulse" />
        ) : (
          <>
            <span className={`
              font-medium
              ${highlight ? 'text-white text-base' : ''}
              ${positive ? 'text-green-400' : ''}
              ${negative ? 'text-red-400' : ''}
              ${!highlight && !positive && !negative ? 'text-gray-200 text-sm' : ''}
            `}>
              {positive && '+'}
              {negative && '-'}
              {formatFiat(value)}
            </span>
            
            {change !== undefined && (
              <span className={`flex items-center gap-0.5 text-xs ${trendColor}`}>
                <TrendIcon className="w-3 h-3" />
                <span>{Math.abs(change).toFixed(1)}%</span>
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface CompactFiatDisplayProps {
  inputFiat: number | null;
  outputFiat: number | null;
  currency: FiatCurrency;
  loading: boolean;
  formatFiat: (value: number | null) => string;
}

function CompactFiatDisplay({ 
  inputFiat, 
  outputFiat, 
  currency, 
  loading,
  formatFiat,
}: CompactFiatDisplayProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className="w-12 h-3 bg-gray-700 rounded animate-pulse" />
        <span>→</span>
        <div className="w-12 h-3 bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <span>≈ {formatFiat(inputFiat)}</span>
      <span className="text-gray-600">→</span>
      <span className="text-gray-300">{formatFiat(outputFiat)}</span>
    </div>
  );
}

// ============================================================================
// UTILS
// ============================================================================

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 5) return 'à l\'instant';
  if (seconds < 60) return `il y a ${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes}min`;
  
  const hours = Math.floor(minutes / 60);
  return `il y a ${hours}h`;
}

export default FiatEquivalent;
