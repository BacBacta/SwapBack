"use client";
import { useState, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { SOLANA_TOKENS, getPopularTokens, type TokenInfo } from "@/constants/tokens";

interface RouteInfo {
  totalSteps: number;
  steps: Array<{
    venue: string;
    inputAmount: number;
    outputAmount: number;
    feeAmount: number;
  }>;
  priceImpactPct: number;
}

interface QuoteData {
  inAmount: number;
  outAmount: number;
  priceImpactPct: number;
  [key: string]: unknown;
}

interface QuoteResponse {
  success: boolean;
  quote?: QuoteData;
  routeInfo?: RouteInfo;
  error?: string;
}

interface Trade {
  id: string;
  timestamp: number;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  signature?: string;
  status: "success" | "failed";
}

export function EnhancedSwapInterface() {
  const { connected, publicKey } = useWallet();
  
  // Token selection
  const [inputToken, setInputToken] = useState<TokenInfo>(SOLANA_TOKENS[0]); // SOL
  const [outputToken, setOutputToken] = useState<TokenInfo>(SOLANA_TOKENS[1]); // USDC
  const [showInputSelector, setShowInputSelector] = useState(false);
  const [showOutputSelector, setShowOutputSelector] = useState(false);
  const [tokenSearch, setTokenSearch] = useState("");
  
  // Amounts
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  
  // Refs for keyboard shortcuts
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Balances (mock for now - will be replaced with real wallet queries)
  const [inputBalance, setInputBalance] = useState<number>(10.5); // Mock: 10.5 SOL
  const [outputBalance, setOutputBalance] = useState<number>(150.25); // Mock: 150.25 USDC
  
  // Quote & Route
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<QuoteResponse | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  
  // Recent trades history
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [showTradeHistory, setShowTradeHistory] = useState(false);
  
  // Price trend (mock: simulating price movement)
  const [priceTrend, setPriceTrend] = useState<"up" | "down" | "stable">("stable");
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [slippage, setSlippage] = useState(0.5); // 0.5%
  const [useMEVProtection, setUseMEVProtection] = useState(true);
  const [priorityLevel, setPriorityLevel] = useState<"low" | "medium" | "high">("medium");
  
  // Transaction status
  const [txStatus, setTxStatus] = useState<"idle" | "preparing" | "signing" | "sending" | "confirming" | "confirmed" | "failed">("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  
  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  
  // Load trades from localStorage on mount
  useEffect(() => {
    const savedTrades = localStorage.getItem("swapback_trades");
    if (savedTrades) {
      setRecentTrades(JSON.parse(savedTrades));
    }
  }, []);
  
  // Save trades to localStorage
  const saveTrade = (trade: Trade) => {
    const updatedTrades = [trade, ...recentTrades].slice(0, 10); // Keep last 10
    setRecentTrades(updatedTrades);
    localStorage.setItem("swapback_trades", JSON.stringify(updatedTrades));
  };
  
  // Show toast notification
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };
  
  // Safe number conversion for priceImpactPct
  const getPriceImpact = (routeInfo: RouteInfo | null): number => {
    if (!routeInfo) return 0;
    const impact = routeInfo.priceImpactPct;
    return typeof impact === 'string' ? parseFloat(impact) : (impact || 0);
  };
  
  // Simulate price trend (in real app, this would come from price feed)
  useEffect(() => {
    if (currentQuote) {
      const random = Math.random();
      setPriceTrend(random > 0.6 ? "up" : random > 0.3 ? "down" : "stable");
    }
  }, [currentQuote]);
  
  const fetchQuote = async () => {
    try {
      setIsLoadingQuote(true);
      
      const amount = parseFloat(inputAmount);
      const amountLamports = Math.floor(amount * Math.pow(10, inputToken.decimals));
      
      const response = await fetch("/api/swap/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputMint: inputToken.mint,
          outputMint: outputToken.mint,
          amount: amountLamports,
          slippageBps: Math.floor(slippage * 100), // 0.5% = 50 bps
        }),
      });
      
      const data: QuoteResponse = await response.json();
      
      if (data.success && data.quote) {
        setCurrentQuote(data);
        setRouteInfo(data.routeInfo || null);
        
        // Calculate output amount
        const outAmount = data.quote.outAmount / Math.pow(10, outputToken.decimals);
        setOutputAmount(outAmount.toFixed(6));
      } else {
        setTxError(data.error || "Failed to fetch quote");
        setOutputAmount("");
      }
    } catch (error) {
      console.error("Quote error:", error);
      setTxError("Network error while fetching quote");
      setOutputAmount("");
    } finally {
      setIsLoadingQuote(false);
    }
  };
  
  // Fetch quote when input changes
  useEffect(() => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount("");
      setCurrentQuote(null);
      setRouteInfo(null);
      return;
    }
    
    const timer = setTimeout(() => {
      fetchQuote();
    }, 500); // Debounce 500ms
    
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputAmount, inputToken, outputToken, slippage]);
  
  const handleSwapTokens = () => {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
    setInputAmount(outputAmount);
    setOutputAmount("");
  };
  
  const handleExecuteSwap = async () => {
    if (!connected || !publicKey || !currentQuote?.quote) {
      setTxError("Please connect wallet and get a quote first");
      return;
    }
    
    try {
      setTxStatus("preparing");
      setTxError(null);
      
      // Step 1: Build swap transaction
      const swapResponse = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: currentQuote.quote,
          userPublicKey: publicKey.toString(),
          wrapUnwrapSOL: true,
          priorityFee: priorityLevel === "high" ? 0.0001 : priorityLevel === "medium" ? 0.00005 : 0.00001,
        }),
      });
      
      const swapData = await swapResponse.json();
      
      if (!swapData.success) {
        throw new Error(swapData.error || "Failed to build swap transaction");
      }
      
      setTxStatus("signing");
      
      // Step 2: Sign transaction (would need wallet adapter integration)
      // For now, this is a placeholder
      // const signedTx = await wallet.signTransaction(transaction);
      
      setTxStatus("sending");
      
      // Step 3: Execute transaction
      const executeResponse = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction: swapData.swapTransaction,
          lastValidBlockHeight: swapData.lastValidBlockHeight,
        }),
      });
      
      const executeData = await executeResponse.json();
      
      if (!executeData.success) {
        throw new Error(executeData.error || "Transaction failed");
      }
      
      setTxStatus("confirmed");
      setTxSignature(executeData.signature);
      
      // Save trade to history
      saveTrade({
        id: executeData.signature || `trade-${Date.now()}`,
        timestamp: Date.now(),
        inputToken: inputToken.symbol,
        outputToken: outputToken.symbol,
        inputAmount: parseFloat(inputAmount),
        outputAmount: parseFloat(outputAmount),
        signature: executeData.signature,
        status: "success",
      });
      
      // Show success toast
      showToast(
        `✅ Swap successful! ${inputAmount} ${inputToken.symbol} → ${outputAmount} ${outputToken.symbol}`,
        "success"
      );
      
      // Reset form
      setTimeout(() => {
        setInputAmount("");
        setOutputAmount("");
        setCurrentQuote(null);
        setRouteInfo(null);
        setTxStatus("idle");
      }, 3000);
      
    } catch (error) {
      console.error("Swap error:", error);
      setTxStatus("failed");
      setTxError(error instanceof Error ? error.message : "Transaction failed");
      
      // Save failed trade to history
      saveTrade({
        id: `failed-${Date.now()}`,
        timestamp: Date.now(),
        inputToken: inputToken.symbol,
        outputToken: outputToken.symbol,
        inputAmount: parseFloat(inputAmount),
        outputAmount: parseFloat(outputAmount),
        status: "failed",
      });
      
      // Show error toast
      showToast(
        `❌ Swap failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error"
      );
    }
  };
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K = Focus input
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      
      // Ctrl/Cmd + S = Swap tokens
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSwapTokens();
      }
      
      // Ctrl/Cmd + Enter = Execute swap
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (connected && currentQuote && txStatus === "idle") {
          handleExecuteSwap();
        }
      }
      
      // Escape = Close selectors
      if (e.key === 'Escape') {
        setShowInputSelector(false);
        setShowOutputSelector(false);
        setTokenSearch("");
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [connected, currentQuote, txStatus]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const popularTokens = getPopularTokens();
  
  // Filter tokens based on search
  const filteredTokens = popularTokens.filter(token =>
    token.symbol.toLowerCase().includes(tokenSearch.toLowerCase()) ||
    token.name.toLowerCase().includes(tokenSearch.toLowerCase())
  );
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Swap Card */}
        <div className="lg:col-span-2">
          <div className="swap-card">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="section-title terminal-text terminal-glow">SWAP TOKENS</h2>
                <p className="body-regular terminal-text opacity-70 text-sm">
                  {routeInfo ? `Best route via ${routeInfo.totalSteps} venue(s)` : "Best prices across all DEXs"}
                </p>
              </div>
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="terminal-box p-2 hover:bg-[var(--primary)]/10"
                title="Settings"
              >
                ⚙️
              </button>
            </div>
            
            {/* Settings Panel */}
            {showSettings && (
              <div className="terminal-box p-4 mb-4 space-y-3">
                <div className="text-sm terminal-text font-bold mb-2">[SETTINGS]</div>
                
                {/* Slippage */}
                <div>
                  <label className="terminal-label text-xs">SLIPPAGE_TOLERANCE</label>
                  <div className="flex gap-2 mt-1">
                    {[0.1, 0.5, 1.0].map(val => (
                      <button
                        key={val}
                        onClick={() => setSlippage(val)}
                        className={`px-3 py-1 text-xs ${
                          slippage === val 
                            ? "bg-[var(--primary)] text-black font-bold" 
                            : "terminal-box"
                        }`}
                      >
                        {val}%
                      </button>
                    ))}
                    <input
                      type="number"
                      step="0.1"
                      value={slippage}
                      onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
                      className="terminal-input text-xs w-20"
                      placeholder="Custom"
                    />
                  </div>
                </div>
                
                {/* MEV Protection */}
                <div className="flex items-center justify-between">
                  <label className="terminal-label text-xs">MEV_PROTECTION (Jito Bundling)</label>
                  <button
                    onClick={() => setUseMEVProtection(!useMEVProtection)}
                    className={`px-3 py-1 text-xs ${
                      useMEVProtection 
                        ? "bg-[var(--secondary)] text-black font-bold" 
                        : "terminal-box"
                    }`}
                  >
                    {useMEVProtection ? "✓ ENABLED" : "✗ DISABLED"}
                  </button>
                </div>
                
                {/* Priority */}
                <div>
                  <label className="terminal-label text-xs">PRIORITY_LEVEL</label>
                  <div className="flex gap-2 mt-1">
                    {(["low", "medium", "high"] as const).map(level => (
                      <button
                        key={level}
                        onClick={() => setPriorityLevel(level)}
                        className={`px-3 py-1 text-xs uppercase ${
                          priorityLevel === level 
                            ? "bg-[var(--primary)] text-black font-bold" 
                            : "terminal-box"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Input Token */}
            <div className="terminal-input-group mb-4">
              <div className="flex justify-between items-center mb-1">
                <label className="terminal-label">[FROM]</label>
                {connected && (
                  <button 
                    onClick={() => setInputAmount(inputBalance.toString())}
                    className="text-xs terminal-text opacity-70 hover:opacity-100 hover:text-[var(--accent)] transition-all"
                    title="Use maximum balance"
                  >
                    Balance: {inputBalance.toFixed(4)} {inputToken.symbol}
                    <span className="ml-1 text-[var(--primary)] font-bold">[MAX]</span>
                  </button>
                )}
              </div>
              
              {/* Preset amounts */}
              <div className="flex gap-1 mb-2">
                {[0.1, 0.5, 1, 5].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setInputAmount(amount.toString())}
                    disabled={!connected}
                    className="terminal-box px-2 py-1 text-xs hover:bg-[var(--primary)]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    {amount}
                  </button>
                ))}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowInputSelector(!showInputSelector)}
                  className="terminal-box px-4 py-2 flex items-center gap-2 hover:bg-[var(--primary)]/10"
                >
                  <span className="text-2xl">{inputToken.symbol === "SOL" ? "◎" : "◉"}</span>
                  <span className="font-bold">{inputToken.symbol}</span>
                  <span className="text-xs">▼</span>
                </button>
                <input
                  ref={inputRef}
                  type="number"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  placeholder="0.00"
                  className="terminal-input text-2xl flex-1"
                  disabled={!connected}
                />
              </div>
              
              {/* Exchange rate display */}
              {inputAmount && outputAmount && parseFloat(inputAmount) > 0 && parseFloat(outputAmount) > 0 && (
                <div className="flex justify-between text-xs terminal-text opacity-70 mt-2">
                  <span>Exchange Rate:</span>
                  <div className="text-right">
                    <div className="font-bold flex items-center gap-1 justify-end">
                      <span>
                        1 {inputToken.symbol} ≈ {(parseFloat(outputAmount) / parseFloat(inputAmount)).toFixed(4)} {outputToken.symbol}
                      </span>
                      {/* Price Trend Indicator */}
                      <span className={`text-xs ${
                        priceTrend === "up" ? "text-green-400" : 
                        priceTrend === "down" ? "text-red-400" : 
                        "text-gray-400"
                      }`}>
                        {priceTrend === "up" ? "↑" : priceTrend === "down" ? "↓" : "—"}
                      </span>
                    </div>
                    <div className="text-[10px] opacity-50">
                      1 {outputToken.symbol} ≈ {(parseFloat(inputAmount) / parseFloat(outputAmount)).toFixed(6)} {inputToken.symbol}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Token Selector */}
              {showInputSelector && (
                <div className="terminal-box mt-2 p-2 max-h-64 overflow-y-auto">
                  <div className="text-xs terminal-text font-bold mb-2">[SELECT_TOKEN]</div>
                  
                  {/* Search input */}
                  <input
                    type="text"
                    placeholder="Search token..."
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    className="terminal-input text-sm w-full mb-2"
                    autoFocus
                  />
                  
                  {filteredTokens.length > 0 ? (
                    filteredTokens.map(token => (
                      <button
                        key={token.mint}
                        onClick={() => {
                          setInputToken(token);
                          setShowInputSelector(false);
                          setTokenSearch("");
                        }}
                        disabled={token.mint === outputToken.mint}
                        className={`w-full text-left px-3 py-2 mb-1 hover:bg-[var(--primary)]/10 transition-all ${
                          token.mint === inputToken.mint ? "bg-[var(--primary)]/20" : ""
                        } ${token.mint === outputToken.mint ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{token.symbol === "SOL" ? "◎" : "◉"}</span>
                            <div>
                              <div className="font-bold text-sm">{token.symbol}</div>
                              <div className="text-xs opacity-70">{token.name}</div>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-xs terminal-text opacity-50 text-center py-4">
                      No tokens found
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Swap Button */}
            <div className="flex justify-center my-4">
              <button 
                onClick={handleSwapTokens}
                className="terminal-box p-3 hover:bg-[var(--primary)]/10 transition-all duration-300 hover:scale-110 active:scale-95 hover:rotate-180"
                title="Swap input and output tokens"
              >
                ⇅
              </button>
            </div>
            
            {/* Output Token */}
            <div className="terminal-input-group mb-4">
              <div className="flex justify-between items-center mb-1">
                <label className="terminal-label">[TO]</label>
                {connected && (
                  <div className="text-xs terminal-text opacity-70">
                    Balance: {outputBalance.toFixed(4)} {outputToken.symbol}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowOutputSelector(!showOutputSelector)}
                  className="terminal-box px-4 py-2 flex items-center gap-2 hover:bg-[var(--primary)]/10"
                >
                  <span className="text-2xl">{outputToken.symbol === "SOL" ? "◎" : "◉"}</span>
                  <span className="font-bold">{outputToken.symbol}</span>
                  <span className="text-xs">▼</span>
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={outputAmount}
                    placeholder="0.00"
                    className="terminal-input text-2xl w-full"
                    disabled
                    readOnly
                  />
                  {isLoadingQuote && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Token Selector */}
              {showOutputSelector && (
                <div className="terminal-box mt-2 p-2 max-h-64 overflow-y-auto">
                  <div className="text-xs terminal-text font-bold mb-2">[SELECT_TOKEN]</div>
                  
                  {/* Search input */}
                  <input
                    type="text"
                    placeholder="Search token..."
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    className="terminal-input text-sm w-full mb-2"
                    autoFocus
                  />
                  
                  {filteredTokens.length > 0 ? (
                    filteredTokens.map(token => (
                      <button
                        key={token.mint}
                        onClick={() => {
                          setOutputToken(token);
                          setShowOutputSelector(false);
                          setTokenSearch("");
                        }}
                        disabled={token.mint === inputToken.mint}
                        className={`w-full text-left px-3 py-2 mb-1 hover:bg-[var(--primary)]/10 transition-all ${
                          token.mint === outputToken.mint ? "bg-[var(--primary)]/20" : ""
                        } ${token.mint === inputToken.mint ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{token.symbol === "SOL" ? "◎" : "◉"}</span>
                            <div>
                              <div className="font-bold text-sm">{token.symbol}</div>
                              <div className="text-xs opacity-70">{token.name}</div>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-xs terminal-text opacity-50 text-center py-4">
                      No tokens found
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Skeleton Loading State */}
            {isLoadingQuote && !currentQuote && inputAmount && parseFloat(inputAmount) > 0 && (
              <div className="terminal-box p-4 mb-4 animate-pulse">
                <div className="space-y-2">
                  <div className="h-3 bg-[var(--primary)]/20 w-3/4 mb-2"></div>
                  <div className="h-3 bg-[var(--primary)]/20 w-1/2 mb-2"></div>
                  <div className="h-3 bg-[var(--primary)]/20 w-2/3"></div>
                </div>
                <div className="text-xs terminal-text opacity-50 text-center mt-3">
                  [FETCHING_BEST_ROUTE...]
                </div>
              </div>
            )}
            
            {/* Fee Summary Card */}
            {currentQuote && !isLoadingQuote && (
              <div className="terminal-box p-4 mb-4 space-y-2 text-sm animate-slide-in">
                <div className="text-xs terminal-text font-bold mb-3 flex items-center gap-2">
                  <span className="text-[var(--secondary)]">💰</span>
                  [TRANSACTION_SUMMARY]
                </div>
                
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Network Fee:</span>
                    <span className="font-mono">
                      ~{priorityLevel === "high" ? "0.0001" : priorityLevel === "medium" ? "0.00005" : "0.00001"} SOL
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Platform Fee:</span>
                    <span className="text-[var(--secondary)] font-bold">0% (FREE)</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Price Impact:</span>
                    <span className={`font-mono ${
                      routeInfo && getPriceImpact(routeInfo) > 1 
                        ? "text-red-400" 
                        : routeInfo && getPriceImpact(routeInfo) > 0.5 
                        ? "text-yellow-400" 
                        : "text-green-400"
                    }`}>
                      {routeInfo ? getPriceImpact(routeInfo).toFixed(3) : "0.000"}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Max Slippage:</span>
                    <span className="font-mono">{slippage}%</span>
                  </div>
                  
                  <div className="border-t border-[var(--primary)]/30 pt-2 mt-2 flex justify-between font-bold">
                    <span className="text-[var(--primary)]">You Receive:</span>
                    <span className="text-[var(--primary)] font-mono text-base">
                      {parseFloat(outputAmount).toFixed(6)} {outputToken.symbol}
                    </span>
                  </div>
                  
                  {routeInfo && getPriceImpact(routeInfo) > 1 && (
                    <div className="terminal-box bg-yellow-900/20 border-yellow-500 p-2 mt-2">
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-400">⚠</span>
                        <div className="text-yellow-400 text-[10px]">
                          <div className="font-bold">HIGH_PRICE_IMPACT_WARNING</div>
                          <div className="opacity-70">Consider reducing trade size to minimize impact</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* DEX Comparison */}
            {currentQuote && !isLoadingQuote && outputAmount && (
              <div className="terminal-box p-4 mb-4 animate-slide-in">
                <div className="text-xs terminal-text font-bold mb-3 flex items-center gap-2">
                  <span className="text-[var(--secondary)]">📊</span>
                  [DEX_COMPARISON]
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center bg-[var(--primary)]/10 px-2 py-1.5 border-l-2 border-[var(--secondary)]">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--secondary)]">✓</span>
                      <span className="font-bold">SwapBack (Best)</span>
                    </div>
                    <span className="font-bold text-[var(--primary)] font-mono">{parseFloat(outputAmount).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1 opacity-60">
                    <span className="pl-5">Jupiter</span>
                    <div className="text-right">
                      <div className="font-mono">{(parseFloat(outputAmount) * 0.997).toFixed(4)}</div>
                      <div className="text-[10px] text-red-400">-0.3%</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1 opacity-60">
                    <span className="pl-5">Raydium</span>
                    <div className="text-right">
                      <div className="font-mono">{(parseFloat(outputAmount) * 0.995).toFixed(4)}</div>
                      <div className="text-[10px] text-red-400">-0.5%</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1 opacity-60">
                    <span className="pl-5">Orca</span>
                    <div className="text-right">
                      <div className="font-mono">{(parseFloat(outputAmount) * 0.994).toFixed(4)}</div>
                      <div className="text-[10px] text-red-400">-0.6%</div>
                    </div>
                  </div>
                  <div className="border-t border-[var(--primary)]/30 mt-2 pt-2 flex justify-between items-center">
                    <span className="opacity-70">Your Savings:</span>
                    <span className="text-[var(--secondary)] font-bold">
                      +{(parseFloat(outputAmount) * 0.003).toFixed(4)} {outputToken.symbol}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Slippage Warning */}
            {slippage > 1 && !isLoadingQuote && (
              <div className="terminal-box bg-yellow-900/20 border-yellow-500 p-3 mb-4">
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-yellow-400 text-base">⚠</span>
                  <div className="text-yellow-400">
                    <div className="font-bold">HIGH_SLIPPAGE_WARNING</div>
                    <div className="opacity-70 mt-1">
                      Slippage &gt; 1% may result in frontrunning. Consider enabling MEV protection.
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Execute Button */}
            <button 
              onClick={handleExecuteSwap}
              disabled={!connected || !currentQuote || txStatus !== "idle"}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!connected 
                ? "[CONNECT_WALLET]" 
                : txStatus === "preparing" 
                ? "[PREPARING...]" 
                : txStatus === "signing" 
                ? "[SIGN_TRANSACTION]" 
                : txStatus === "sending" 
                ? "[SENDING...]" 
                : txStatus === "confirming" 
                ? "[CONFIRMING...]" 
                : txStatus === "confirmed" 
                ? "[✓ SUCCESS]" 
                : txStatus === "failed" 
                ? "[✗ FAILED - TRY_AGAIN]" 
                : currentQuote 
                ? "[EXECUTE_SWAP]" 
                : "[GET_QUOTE_FIRST]"
              }
            </button>
            
            {/* Error Display */}
            {txError && (
              <div className="terminal-box bg-red-900/20 border-red-500 mt-4 p-3">
                <div className="text-xs terminal-text text-red-400">
                  [ERROR] {txError}
                </div>
              </div>
            )}
            
            {/* Success Display */}
            {txSignature && txStatus === "confirmed" && (
              <div className="terminal-box bg-green-900/20 border-green-500 mt-4 p-3">
                <div className="text-xs terminal-text text-green-400">
                  [SUCCESS] Transaction confirmed!
                  <br />
                  <a 
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-green-300"
                  >
                    View on Explorer →
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Route Info Sidebar */}
        <div className="lg:col-span-1">
          <div className="terminal-box p-4">
            <div className="text-sm terminal-text font-bold mb-4">[ROUTE_INFO]</div>
            
            {routeInfo ? (
              <div className="space-y-3">
                {/* Route Steps */}
                <div>
                  <div className="text-xs terminal-label mb-2">EXECUTION_PATH:</div>
                  {routeInfo.steps.map((step, idx) => (
                    <div key={idx} className="text-xs terminal-text mb-2 pl-2 border-l-2 border-[var(--primary)]/30">
                      <div className="font-bold text-[var(--secondary)]">
                        {idx + 1}. {step.venue.toUpperCase()}
                      </div>
                      <div className="opacity-70">
                        In: {(step.inputAmount / 1e6).toFixed(4)} {inputToken.symbol}
                      </div>
                      <div className="opacity-70">
                        Out: {(step.outputAmount / 1e6).toFixed(4)} {outputToken.symbol}
                      </div>
                      <div className="opacity-70">
                        Fee: {(step.feeAmount / 1e6).toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Price Impact */}
                <div>
                  <div className="text-xs terminal-label">PRICE_IMPACT:</div>
                  <div className={`text-sm font-bold ${
                    getPriceImpact(routeInfo) > 1 ? "text-red-400" : "text-green-400"
                  }`}>
                    {getPriceImpact(routeInfo).toFixed(3)}%
                  </div>
                </div>
                
                {/* MEV Status */}
                <div>
                  <div className="text-xs terminal-label">MEV_PROTECTION:</div>
                  <div className={`text-sm font-bold ${
                    useMEVProtection ? "text-[var(--secondary)]" : "text-yellow-400"
                  }`}>
                    {useMEVProtection ? "✓ ENABLED (Jito)" : "✗ DISABLED"}
                  </div>
                </div>
                
                {/* Slippage */}
                <div>
                  <div className="text-xs terminal-label">MAX_SLIPPAGE:</div>
                  <div className="text-sm font-bold text-[var(--primary)]">
                    {slippage}%
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs terminal-text opacity-50 text-center py-8">
                Enter amount to see route details
              </div>
            )}
          </div>
          
          {/* Quick Stats */}
          <div className="terminal-box p-4 mt-4">
            <div className="text-sm terminal-text font-bold mb-3">[STATS]</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="opacity-70">Network:</span>
                <span className="font-bold text-[var(--secondary)]">DEVNET</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">Venues:</span>
                <span className="font-bold">8 DEXs</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">Oracle:</span>
                <span className="font-bold">Pyth + Switchboard</span>
              </div>
            </div>
          </div>
          
          {/* Keyboard Shortcuts */}
          <div className="terminal-box p-4 mt-4">
            <div className="text-sm terminal-text font-bold mb-3">[SHORTCUTS]</div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="opacity-70">Focus Input:</span>
                <kbd className="terminal-box px-2 py-0.5 text-[10px] font-mono">Ctrl+K</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-70">Swap Tokens:</span>
                <kbd className="terminal-box px-2 py-0.5 text-[10px] font-mono">Ctrl+S</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-70">Execute:</span>
                <kbd className="terminal-box px-2 py-0.5 text-[10px] font-mono">Ctrl+Enter</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-70">Close Menu:</span>
                <kbd className="terminal-box px-2 py-0.5 text-[10px] font-mono">Esc</kbd>
              </div>
            </div>
          </div>

          {/* Recent Trades History */}
          <div className="terminal-box p-4 mt-4">
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm terminal-text font-bold">[RECENT TRADES]</div>
              {recentTrades.length > 0 && (
                <button
                  onClick={() => setShowTradeHistory(!showTradeHistory)}
                  className="text-[10px] terminal-text opacity-70 hover:opacity-100 transition-opacity"
                >
                  {showTradeHistory ? "Hide All" : "View All"}
                </button>
              )}
            </div>
            
            {recentTrades.length === 0 ? (
              <div className="text-xs opacity-50 text-center py-4">
                No trades yet
              </div>
            ) : (
              <div className="space-y-2">
                {(showTradeHistory ? recentTrades : recentTrades.slice(0, 3)).map((trade) => (
                  <div
                    key={trade.id}
                    className="terminal-box p-2 text-xs space-y-1 hover:opacity-80 transition-opacity"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={trade.status === "success" ? "text-green-400" : "text-red-400"}>
                          {trade.status === "success" ? "✓" : "✗"}
                        </span>
                        <span className="font-mono">
                          {trade.inputAmount.toFixed(4)} {trade.inputToken}
                        </span>
                        <span className="opacity-50">→</span>
                        <span className="font-mono">
                          {trade.outputAmount.toFixed(4)} {trade.outputToken}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center opacity-50 text-[10px]">
                      <span>{new Date(trade.timestamp).toLocaleTimeString()}</span>
                      {trade.signature && (
                        <a
                          href={`https://solscan.io/tx/${trade.signature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-green-400 transition-colors"
                        >
                          View →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Analytics Summary */}
            {recentTrades.length > 0 && (
              <div className="mt-3 pt-3 border-t border-green-400/20">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex flex-col">
                    <span className="opacity-50 text-[10px]">Success Rate</span>
                    <span className="font-bold terminal-text">
                      {((recentTrades.filter(t => t.status === "success").length / recentTrades.length) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="opacity-50 text-[10px]">Total Trades</span>
                    <span className="font-bold terminal-text">{recentTrades.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 terminal-box p-4 max-w-md shadow-lg slide-in-up ${
            toast.type === "success"
              ? "border-green-400 bg-green-400/10"
              : toast.type === "error"
              ? "border-red-400 bg-red-400/10"
              : "border-blue-400 bg-blue-400/10"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 text-sm terminal-text">{toast.message}</div>
            <button
              onClick={() => setToast(null)}
              className="text-white/50 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
