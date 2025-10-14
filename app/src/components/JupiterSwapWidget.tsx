'use client';

import React, { useState, useEffect } from 'react';
import { useJupiter } from '../hooks/useJupiter';
import { JupiterRouteDisplay } from './JupiterRouteDisplay';
import type { JupiterQuote, RouteInfo } from '@swapback/sdk';

// Tokens populaires pour les tests
const POPULAR_TOKENS = [
  { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9, logo: '◎' },
  { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, logo: '$' },
  { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6, logo: '₮' },
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5, logo: '🐕' },
];

export const JupiterSwapWidget: React.FC = () => {
  const jupiter = useJupiter();

  // État du swap
  const [inputToken, setInputToken] = useState(POPULAR_TOKENS[0]);
  const [outputToken, setOutputToken] = useState(POPULAR_TOKENS[1]);
  const [inputAmount, setInputAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5); // 0.5%

  // État du quote
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // État du swap
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  // Inverser les tokens
  const handleSwapTokens = () => {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
    setQuote(null);
    setRouteInfo(null);
  };

  // Obtenir un quote
  const fetchQuote = async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setQuoteError('Veuillez entrer un montant valide');
      return;
    }

    setIsLoadingQuote(true);
    setQuoteError(null);
    setQuote(null);
    setRouteInfo(null);

    try {
      // Convertir le montant en lamports/smallest unit
      const amountInSmallestUnit = Math.floor(
        parseFloat(inputAmount) * Math.pow(10, inputToken.decimals)
      );

      const slippageBps = Math.floor(slippage * 100); // Convert % to bps

      const jupiterQuote = await jupiter.getQuote(
        inputToken.mint,
        outputToken.mint,
        amountInSmallestUnit,
        slippageBps,
        false
      );

      if (jupiterQuote) {
        setQuote(jupiterQuote);
        const route = jupiter.parseRouteInfo(jupiterQuote);
        setRouteInfo(route);
      } else {
        setQuoteError('Impossible d\'obtenir un quote. Vérifiez votre connexion.');
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du quote:', error);
      setQuoteError(error instanceof Error ? error.message : 'Erreur inconnue');
    } finally {
      setIsLoadingQuote(false);
    }
  };

  // Exécuter le swap
  const handleSwap = async () => {
    if (!quote || !jupiter.isReady) {
      return;
    }

    setIsSwapping(true);
    setSwapError(null);
    setSwapSuccess(null);

    try {
      const amountInSmallestUnit = Math.floor(
        parseFloat(inputAmount) * Math.pow(10, inputToken.decimals)
      );

      const slippageBps = Math.floor(slippage * 100);

      const signature = await jupiter.executeSwap(
        inputToken.mint,
        outputToken.mint,
        amountInSmallestUnit,
        slippageBps
      );

      if (signature) {
        setSwapSuccess(signature);
        setInputAmount('');
        setQuote(null);
        setRouteInfo(null);
      } else {
        setSwapError('Le swap a échoué. Veuillez réessayer.');
      }
    } catch (error) {
      console.error('Erreur lors du swap:', error);
      setSwapError(error instanceof Error ? error.message : 'Erreur inconnue');
    } finally {
      setIsSwapping(false);
    }
  };

  // Auto-refresh du quote toutes les 30s
  useEffect(() => {
    if (quote && inputAmount && parseFloat(inputAmount) > 0) {
      const interval = setInterval(() => {
        fetchQuote();
      }, 30000); // 30 secondes

      return () => clearInterval(interval);
    }
  }, [quote, inputAmount]);

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6 space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Jupiter Swap</h2>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">Slippage:</span>
          <select
            value={slippage}
            onChange={(e) => setSlippage(parseFloat(e.target.value))}
            className="text-xs border border-gray-300 rounded px-2 py-1"
          >
            <option value={0.1}>0.1%</option>
            <option value={0.5}>0.5%</option>
            <option value={1}>1%</option>
            <option value={2}>2%</option>
          </select>
        </div>
      </div>

      {/* Status du wallet */}
      {!jupiter.isReady && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
          <p className="text-sm text-yellow-800">
            ⚠️ Veuillez connecter votre wallet pour continuer
          </p>
        </div>
      )}

      {/* Input Token */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Vous payez</span>
          <select
            value={inputToken.symbol}
            onChange={(e) => {
              const token = POPULAR_TOKENS.find(t => t.symbol === e.target.value);
              if (token) setInputToken(token);
            }}
            className="text-sm font-medium border border-gray-300 rounded px-2 py-1"
          >
            {POPULAR_TOKENS.filter(t => t.symbol !== outputToken.symbol).map(token => (
              <option key={token.symbol} value={token.symbol}>
                {token.logo} {token.symbol}
              </option>
            ))}
          </select>
        </div>
        <input
          type="number"
          value={inputAmount}
          onChange={(e) => setInputAmount(e.target.value)}
          placeholder="0.00"
          className="w-full text-2xl font-bold bg-transparent outline-none"
          step="any"
          min="0"
        />
      </div>

      {/* Bouton pour inverser */}
      <div className="flex justify-center">
        <button
          onClick={handleSwapTokens}
          className="bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* Output Token */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Vous recevez</span>
          <select
            value={outputToken.symbol}
            onChange={(e) => {
              const token = POPULAR_TOKENS.find(t => t.symbol === e.target.value);
              if (token) setOutputToken(token);
            }}
            className="text-sm font-medium border border-gray-300 rounded px-2 py-1"
          >
            {POPULAR_TOKENS.filter(t => t.symbol !== inputToken.symbol).map(token => (
              <option key={token.symbol} value={token.symbol}>
                {token.logo} {token.symbol}
              </option>
            ))}
          </select>
        </div>
        <div className="text-2xl font-bold text-gray-800">
          {quote ? (
            (Number(quote.outAmount) / Math.pow(10, outputToken.decimals)).toFixed(6)
          ) : (
            '0.00'
          )}
        </div>
      </div>

      {/* Bouton Get Quote */}
      <button
        onClick={fetchQuote}
        disabled={!inputAmount || parseFloat(inputAmount) <= 0 || isLoadingQuote}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
      >
        {isLoadingQuote ? 'Chargement...' : 'Obtenir un Quote'}
      </button>

      {/* Affichage du quote */}
      {quote && routeInfo && (
        <JupiterRouteDisplay
          quote={quote}
          routeInfo={routeInfo}
          inputDecimals={inputToken.decimals}
          outputDecimals={outputToken.decimals}
          inputSymbol={inputToken.symbol}
          outputSymbol={outputToken.symbol}
        />
      )}

      {/* Erreur du quote */}
      {quoteError && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-800">❌ {quoteError}</p>
        </div>
      )}

      {/* Bouton Swap */}
      {quote && jupiter.isReady && (
        <button
          onClick={handleSwap}
          disabled={isSwapping}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {isSwapping ? 'Swap en cours...' : 'Exécuter le Swap'}
        </button>
      )}

      {/* Succès du swap */}
      {swapSuccess && (
        <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2">
          <p className="text-sm text-green-800 font-medium">✅ Swap réussi !</p>
          <a
            href={`https://solscan.io/tx/${swapSuccess}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline block"
          >
            Voir sur Solscan →
          </a>
        </div>
      )}

      {/* Erreur du swap */}
      {swapError && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-800">❌ {swapError}</p>
        </div>
      )}

      {/* Wallet info */}
      {jupiter.isReady && jupiter.walletAddress && (
        <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-200">
          Connecté: {jupiter.walletAddress.slice(0, 4)}...{jupiter.walletAddress.slice(-4)}
        </div>
      )}
    </div>
  );
};
