"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createContext, useContext, useState, ReactNode } from "react";
import { useSwipeable } from "react-swipeable";

interface SheetContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = createContext<SheetContextType | undefined>(undefined);

export function Sheet({ 
  children, 
  open, 
  onOpenChange 
}: { 
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <SheetContext.Provider value={{ open, setOpen: onOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

export function SheetTrigger({ 
  children, 
  asChild = false 
}: { 
  children: ReactNode;
  asChild?: boolean;
}) {
  const context = useContext(SheetContext);
  if (!context) throw new Error("SheetTrigger must be used within Sheet");

  const handleClick = () => context.setOpen(true);

  if (asChild && typeof children === "object" && children !== null && "props" in children) {
    return <div onClick={handleClick}>{children}</div>;
  }

  return <button onClick={handleClick}>{children}</button>;
}

export function SheetContent({ 
  children,
  side = "left",
  className = ""
}: { 
  children: ReactNode;
  side?: "left" | "right";
  className?: string;
}) {
  const context = useContext(SheetContext);
  if (!context) throw new Error("SheetContent must be used within Sheet");

  const { open, setOpen } = context;

  // Swipe to close
  const swipeHandlers = useSwipeable({
    onSwipedLeft: side === "left" ? () => setOpen(false) : undefined,
    onSwipedRight: side === "right" ? () => setOpen(false) : undefined,
    trackMouse: false,
    delta: 50,
    preventScrollOnSwipe: false
  });

  const variants = {
    left: {
      closed: { x: "-100%" },
      open: { x: 0 }
    },
    right: {
      closed: { x: "100%" },
      open: { x: 0 }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Sheet Content */}
          <motion.div
            {...swipeHandlers}
            initial={variants[side].closed}
            animate={variants[side].open}
            exit={variants[side].closed}
            transition={{ 
              type: "spring", 
              damping: 30, 
              stiffness: 300 
            }}
            className={`fixed ${side === "left" ? "left-0" : "right-0"} top-0 bottom-0 z-50 ${className}`}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
