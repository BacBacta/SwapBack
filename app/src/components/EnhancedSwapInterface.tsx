"use client";
import { useState, useEffect } from "react";
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

export function EnhancedSwapInterface() {
  const { connected, publicKey } = useWallet();
  
  // Token selection
  const [inputToken, setInputToken] = useState<TokenInfo>(SOLANA_TOKENS[0]); // SOL
  const [outputToken, setOutputToken] = useState<TokenInfo>(SOLANA_TOKENS[1]); // USDC
  const [showInputSelector, setShowInputSelector] = useState(false);
  const [showOutputSelector, setShowOutputSelector] = useState(false);
  
  // Amounts
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  
  // Quote & Route
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<QuoteResponse | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [slippage, setSlippage] = useState(0.5); // 0.5%
  const [useMEVProtection, setUseMEVProtection] = useState(true);
  const [priorityLevel, setPriorityLevel] = useState<"low" | "medium" | "high">("medium");
  
  // Transaction status
  const [txStatus, setTxStatus] = useState<"idle" | "preparing" | "signing" | "sending" | "confirming" | "confirmed" | "failed">("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  
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
    }
  };
  
  const popularTokens = getPopularTokens();
  
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
              <label className="terminal-label">[FROM]</label>
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
                  type="number"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  placeholder="0.00"
                  className="terminal-input text-2xl flex-1"
                  disabled={!connected}
                />
              </div>
              
              {/* Token Selector */}
              {showInputSelector && (
                <div className="terminal-box mt-2 p-2 max-h-64 overflow-y-auto">
                  <div className="text-xs terminal-text font-bold mb-2">[SELECT_TOKEN]</div>
                  {popularTokens.map(token => (
                    <button
                      key={token.mint}
                      onClick={() => {
                        setInputToken(token);
                        setShowInputSelector(false);
                      }}
                      disabled={token.mint === outputToken.mint}
                      className={`w-full text-left px-3 py-2 mb-1 hover:bg-[var(--primary)]/10 ${
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
                  ))}
                </div>
              )}
            </div>
            
            {/* Swap Button */}
            <div className="flex justify-center my-4">
              <button 
                onClick={handleSwapTokens}
                className="terminal-box p-3 hover:bg-[var(--primary)]/10 hover:rotate-180 transition-transform"
              >
                ⇅
              </button>
            </div>
            
            {/* Output Token */}
            <div className="terminal-input-group mb-6">
              <label className="terminal-label">[TO]</label>
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
                  {popularTokens.map(token => (
                    <button
                      key={token.mint}
                      onClick={() => {
                        setOutputToken(token);
                        setShowOutputSelector(false);
                      }}
                      disabled={token.mint === inputToken.mint}
                      className={`w-full text-left px-3 py-2 mb-1 hover:bg-[var(--primary)]/10 ${
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
                  ))}
                </div>
              )}
            </div>
            
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
                    routeInfo.priceImpactPct > 1 ? "text-red-400" : "text-green-400"
                  }`}>
                    {routeInfo.priceImpactPct.toFixed(3)}%
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
        </div>
      </div>
    </div>
  );
}
