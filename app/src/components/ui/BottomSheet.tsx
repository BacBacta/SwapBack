"use client";

/**
 * BottomSheet - Panneau coulissant depuis le bas
 * 
 * Alternative simplifiée aux modales, adapté mobile.
 */

import { motion, AnimatePresence } from "framer-motion";
import { ReactNode, useEffect } from "react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  height?: "auto" | "half" | "full";
  showHandle?: boolean;
}

export function BottomSheet({ 
  isOpen, 
  onClose, 
  children,
  height = "auto",
  showHandle = true,
}: BottomSheetProps) {
  
  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Bloquer le scroll du body quand ouvert
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const heightClasses = {
    auto: "max-h-[90vh]",
    half: "h-[50vh]",
    full: "h-[95vh]",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ 
              type: "spring", 
              damping: 30, 
              stiffness: 400,
              mass: 0.8
            }}
            className={`
              fixed bottom-0 left-0 right-0 z-50 
              bg-zinc-900 border-t border-white/10 
              rounded-t-2xl overflow-hidden
              ${heightClasses[height]}
            `}
          >
            {/* Handle pour swipe */}
            {showHandle && (
              <div className="flex justify-center py-3">
                <div className="w-12 h-1 bg-white/20 rounded-full" />
              </div>
            )}
            
            {/* Contenu scrollable */}
            <div className={`overflow-y-auto ${showHandle ? 'max-h-[calc(90vh-2rem)]' : 'max-h-[90vh]'}`}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default BottomSheet;
