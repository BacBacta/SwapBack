"use client";

import { motion } from "framer-motion";
import { ArrowPathIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

interface LoadingProgressProps {
  step: 'fetching' | 'routing' | 'building' | 'signing' | 'confirming';
  progress: number; // 0-100
}

const STEPS = [
  { id: 'fetching', label: 'Fetching prices', color: 'text-blue-400', estimatedTime: '~2s' },
  { id: 'routing', label: 'Finding best route', color: 'text-cyan-400', estimatedTime: '~3s' },
  { id: 'building', label: 'Building transaction', color: 'text-emerald-400', estimatedTime: '~1s' },
  { id: 'signing', label: 'Awaiting signature', color: 'text-yellow-400', estimatedTime: '~5s' },
  { id: 'confirming', label: 'Confirming on-chain', color: 'text-purple-400', estimatedTime: '~20s' },
];

export function LoadingProgress({ step, progress }: LoadingProgressProps) {
  const currentStepIndex = STEPS.findIndex(s => s.id === step);
  const currentStep = STEPS[currentStepIndex];

  return (
    <div className="w-full space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
      {/* Header with current step */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${currentStep?.color || 'text-gray-400'}`}>
          {currentStep?.label || 'Processing...'}
        </span>
        <span className="text-xs text-gray-500">
          {currentStep?.estimatedTime || ''}
        </span>
      </div>

      {/* Progress Bar with Gradient */}
      <div className="relative w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500 rounded-full"
        />
        
        {/* Shimmer Effect */}
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ 
            repeat: Infinity, 
            duration: 1.5, 
            ease: 'linear' 
          }}
          className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-sm"
        />
      </div>

      {/* Percentage Display */}
      <div className="text-center">
        <motion.span
          key={progress}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-2xl font-bold text-white"
        >
          {Math.round(progress)}%
        </motion.span>
      </div>

      {/* Steps List */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        {STEPS.map((s, index) => {
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;
          
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ 
                opacity: isActive ? 1 : isCompleted ? 0.7 : 0.3,
                x: 0 
              }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3"
            >
              {/* Step Icon */}
              <div className="relative flex-shrink-0">
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
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
                  <div className="w-5 h-5 rounded-full border-2 border-gray-700" />
                )}
              </div>

              {/* Step Label */}
              <span className={`text-sm ${
                isActive ? `${s.color} font-medium` : 
                isCompleted ? 'text-gray-300' : 
                'text-gray-600'
              }`}>
                {s.label}
              </span>

              {/* Time estimate for active step */}
              {isActive && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-gray-500 ml-auto"
                >
                  {s.estimatedTime}
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
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
