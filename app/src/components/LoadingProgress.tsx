"use client";

import { motion } from "framer-motion";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

interface LoadingProgressProps {
  step: 'fetching' | 'routing' | 'building' | 'signing' | 'confirming';
  progress: number; // 0-100
}

const STEPS = [
  { id: 'fetching', label: 'Fetching quote', color: 'text-blue-400' },
  { id: 'routing', label: 'Finding best route', color: 'text-cyan-400' },
  { id: 'building', label: 'Building transaction', color: 'text-emerald-400' },
  { id: 'signing', label: 'Waiting for signature', color: 'text-yellow-400' },
  { id: 'confirming', label: 'Confirming on chain', color: 'text-purple-400' },
];

export function LoadingProgress({ step, progress }: LoadingProgressProps) {
  const currentStepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div className="w-full space-y-4">
      {/* Progress Bar */}
      <div className="relative w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
        />
        
        {/* Shimmer Effect */}
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ 
            repeat: Infinity, 
            duration: 1.5, 
            ease: 'linear' 
          }}
          className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {STEPS.map((s, index) => {
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;
          
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ 
                opacity: isActive || isCompleted ? 1 : 0.4,
                x: 0 
              }}
              className="flex items-center space-x-3"
            >
              {/* Step Indicator */}
              <div className="relative">
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                ) : isActive ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 1, 
                      ease: 'linear' 
                    }}
                    className={`w-5 h-5 ${s.color}`}
                  >
                    <ArrowPathIcon />
                  </motion.div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                )}
              </div>

              {/* Step Label */}
              <span className={`text-sm ${isActive ? s.color : 'text-gray-400'} ${isActive ? 'font-medium' : ''}`}>
                {s.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Percentage */}
      <div className="text-center">
        <motion.span
          key={progress}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent"
        >
          {Math.round(progress)}%
        </motion.span>
      </div>
    </div>
  );
}
