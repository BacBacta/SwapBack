"use client";

/**
 * 🗺️ Route Visualization Component
 * 
 * Affiche visuellement la route de swap:
 * - Graphique donut pour la répartition des venues DEX
 * - Chemin animé du swap
 * - Détails de chaque venue
 * - Comparaison avec le prix marché
 * 
 * @author SwapBack Team
 * @date January 2025
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Award, TrendingUp, Info } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export interface RouteVenue {
  venue: string;
  weight: number; // Pourcentage (0-100)
  outputAmount: number;
  priceImpactBps: number;
  latencyMs: number;
  estimatedNpiBps: number;
}

export interface RouteVisualizationProps {
  inputToken: {
    symbol: string;
    amount: number;
    logoURI?: string;
  };
  outputToken: {
    symbol: string;
    amount: number;
    logoURI?: string;
  };
  venues: RouteVenue[];
  /** @deprecated Use marketBenchmark instead */
  jupiterBenchmark?: {
    outputAmount: number;
    priceImpactBps: number;
  };
  /** Benchmark du prix marché pour comparaison */
  marketBenchmark?: {
    outputAmount: number;
    priceImpactBps: number;
  };
  estimatedRebate: number;
  estimatedNpi: number;
  compact?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const VENUE_COLORS: Record<string, string> = {
  'RAYDIUM_AMM': '#7B61FF',
  'RAYDIUM_CLMM': '#9B87FF',
  'ORCA_WHIRLPOOL': '#00B4D8',
  'METEORA_DLMM': '#FF6B6B',
  'PHOENIX': '#FFD93D',
  'LIFINITY': '#6BCB77',
  'SANCTUM': '#8B5CF6',
  'SABER': '#F97316',
  'default': '#6B7280',
};

const VENUE_ICONS: Record<string, string> = {
  'RAYDIUM_AMM': '🌊',
  'RAYDIUM_CLMM': '🌊',
  'ORCA_WHIRLPOOL': '🐋',
  'METEORA_DLMM': '☄️',
  'PHOENIX': '🔥',
  'LIFINITY': '♾️',
  'SANCTUM': '🏛️',
  'SABER': '⚔️',
  'default': '📊',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function RouteVisualization({
  inputToken,
  outputToken,
  venues,
  jupiterBenchmark,
  marketBenchmark,
  estimatedRebate,
  estimatedNpi,
  compact = false,
}: RouteVisualizationProps) {
  // Support legacy jupiterBenchmark prop
  const benchmark = marketBenchmark || jupiterBenchmark;
  
  // Calculer les données du graphique donut
  const donutData = useMemo(() => {
    const total = venues.reduce((sum, v) => sum + v.weight, 0);
    let currentAngle = 0;
    
    return venues.map((venue, index) => {
      const percentage = (venue.weight / total) * 100;
      const angle = (venue.weight / total) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      
      return {
        ...venue,
        percentage,
        startAngle,
        endAngle: currentAngle,
        color: VENUE_COLORS[venue.venue] || VENUE_COLORS.default,
        icon: VENUE_ICONS[venue.venue] || VENUE_ICONS.default,
      };
    });
  }, [venues]);
  
  // Calculer l'amélioration par rapport au prix marché
  const improvement = useMemo(() => {
    if (!benchmark) return null;
    
    const totalOutput = venues.reduce((sum, v) => sum + v.outputAmount, 0);
    const diff = totalOutput - benchmark.outputAmount;
    const percentImprovement = (diff / benchmark.outputAmount) * 100;
    
    return {
      absolute: diff,
      percent: percentImprovement,
      isBetter: diff > 0,
    };
  }, [venues, benchmark]);
  
  if (compact) {
    return (
      <CompactRouteView 
        venues={donutData} 
        improvement={improvement} 
        estimatedRebate={estimatedRebate}
      />
    );
  }
  
  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          Route Optimale
        </h3>
        {improvement && improvement.isBetter && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 px-2 py-1 bg-green-600/20 rounded-full"
          >
            <TrendingUp className="w-3 h-3 text-green-400" />
            <span className="text-xs text-green-400 font-medium">
              +{improvement.percent.toFixed(2)}% vs marché
            </span>
          </motion.div>
        )}
      </div>
      
      {/* Route Flow */}
      <div className="flex items-center justify-between mb-6">
        {/* Input Token */}
        <div className="flex items-center gap-2">
          <TokenBadge 
            symbol={inputToken.symbol} 
            logoURI={inputToken.logoURI} 
            amount={inputToken.amount}
          />
        </div>
        
        {/* Flow Arrow */}
        <div className="flex-1 flex items-center justify-center px-4">
          <motion.div
            className="flex items-center gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent flex-1"
              style={{ width: '60px' }}
              animate={{
                backgroundPosition: ['0% 0%', '100% 0%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
            <ArrowRight className="w-4 h-4 text-blue-400" />
          </motion.div>
        </div>
        
        {/* Output Token */}
        <div className="flex items-center gap-2">
          <TokenBadge 
            symbol={outputToken.symbol} 
            logoURI={outputToken.logoURI} 
            amount={outputToken.amount}
          />
        </div>
      </div>
      
      {/* Donut Chart + Venues List */}
      <div className="grid grid-cols-2 gap-4">
        {/* Donut Chart */}
        <div className="flex items-center justify-center">
          <DonutChart data={donutData} size={120} />
        </div>
        
        {/* Venues List */}
        <div className="space-y-2">
          {donutData.map((venue, index) => (
            <VenueItem key={venue.venue} venue={venue} index={index} />
          ))}
        </div>
      </div>
      
      {/* Rebate Info */}
      {(estimatedRebate > 0 || estimatedNpi > 0) && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <Award className="w-4 h-4 text-yellow-400" />
              <span>Cashback estimé</span>
            </div>
            <span className="text-green-400 font-medium">
              +{estimatedRebate.toFixed(4)} {outputToken.symbol}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface TokenBadgeProps {
  symbol: string;
  logoURI?: string;
  amount: number;
}

function TokenBadge({ symbol, logoURI, amount }: TokenBadgeProps) {
  return (
    <div className="flex items-center gap-2 bg-gray-700/50 rounded-lg px-3 py-2">
      {logoURI ? (
        <img 
          src={logoURI} 
          alt={symbol} 
          className="w-6 h-6 rounded-full"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center">
          <span className="text-xs font-bold">{symbol[0]}</span>
        </div>
      )}
      <div className="flex flex-col">
        <span className="text-white font-medium text-sm">{amount.toFixed(4)}</span>
        <span className="text-gray-400 text-xs">{symbol}</span>
      </div>
    </div>
  );
}

interface DonutChartProps {
  data: Array<{
    venue: string;
    percentage: number;
    startAngle: number;
    endAngle: number;
    color: string;
    icon: string;
  }>;
  size: number;
}

function DonutChart({ data, size }: DonutChartProps) {
  const center = size / 2;
  const radius = size / 2 - 10;
  const innerRadius = radius * 0.6;
  
  const createArcPath = (startAngle: number, endAngle: number) => {
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);
    
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    
    const x3 = center + innerRadius * Math.cos(endRad);
    const y3 = center + innerRadius * Math.sin(endRad);
    const x4 = center + innerRadius * Math.cos(startRad);
    const y4 = center + innerRadius * Math.sin(startRad);
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    return `
      M ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
      L ${x3} ${y3}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
      Z
    `;
  };
  
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((segment, index) => (
        <motion.path
          key={segment.venue}
          d={createArcPath(segment.startAngle, segment.endAngle)}
          fill={segment.color}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1, duration: 0.3 }}
        />
      ))}
      
      {/* Center text */}
      <text
        x={center}
        y={center - 5}
        textAnchor="middle"
        className="fill-white text-xs font-medium"
      >
        {data.length}
      </text>
      <text
        x={center}
        y={center + 10}
        textAnchor="middle"
        className="fill-gray-400 text-xs"
      >
        venues
      </text>
    </svg>
  );
}

interface VenueItemProps {
  venue: {
    venue: string;
    percentage: number;
    color: string;
    icon: string;
    priceImpactBps: number;
    latencyMs: number;
  };
  index: number;
}

function VenueItem({ venue, index }: VenueItemProps) {
  const displayName = venue.venue.replace('_', ' ').replace('WHIRLPOOL', '').replace('DLMM', '').replace('AMM', '');
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-2 text-sm"
    >
      <div 
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: venue.color }}
      />
      <span className="text-gray-300 flex-1 truncate">
        {venue.icon} {displayName}
      </span>
      <span className="text-gray-400 text-xs">
        {venue.percentage.toFixed(0)}%
      </span>
    </motion.div>
  );
}

interface CompactRouteViewProps {
  venues: Array<{
    venue: string;
    percentage: number;
    color: string;
    icon: string;
  }>;
  improvement: {
    absolute: number;
    percent: number;
    isBetter: boolean;
  } | null;
  estimatedRebate: number;
}

function CompactRouteView({ venues, improvement, estimatedRebate }: CompactRouteViewProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-gray-800/50 rounded-lg">
      {/* Venues Icons */}
      <div className="flex items-center -space-x-1">
        {venues.slice(0, 3).map((venue, index) => (
          <div
            key={venue.venue}
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 border-gray-800"
            style={{ backgroundColor: venue.color, zIndex: venues.length - index }}
            title={venue.venue}
          >
            {venue.icon}
          </div>
        ))}
        {venues.length > 3 && (
          <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs border-2 border-gray-800">
            +{venues.length - 3}
          </div>
        )}
      </div>
      
      {/* Route Info */}
      <div className="flex-1 text-xs text-gray-400">
        {venues.length} venue{venues.length > 1 ? 's' : ''} • Route native
      </div>
      
      {/* Improvement Badge */}
      {improvement && improvement.isBetter && (
        <div className="text-xs text-green-400 font-medium">
          +{improvement.percent.toFixed(2)}%
        </div>
      )}
      
      {/* Rebate Badge */}
      {estimatedRebate > 0 && (
        <div className="flex items-center gap-1 text-xs text-yellow-400">
          <Award className="w-3 h-3" />
          <span>Cashback</span>
        </div>
      )}
    </div>
  );
}

export default RouteVisualization;
