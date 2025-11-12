"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  fallbackUrl?: string;
  label?: string;
  variant?: "default" | "minimal" | "floating";
  className?: string;
}

export const BackButton = ({ 
  fallbackUrl = "/", 
  label = "Retour",
  variant = "default",
  className = ""
}: BackButtonProps) => {
  const router = useRouter();

  const handleBack = () => {
    // Try to go back in history, fallback to URL if no history
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackUrl);
    }
  };

  // Floating variant - Fixed position bottom-left
  if (variant === "floating") {
    return (
      <button
        onClick={handleBack}
        className={`fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-3 
          border-2 border-[var(--primary)] bg-black/90 backdrop-blur-sm
          hover:bg-[var(--primary)] hover:text-black
          transition-all duration-200 terminal-glow
          shadow-lg hover:shadow-[0_0_20px_rgba(0,255,0,0.5)]
          ${className}`}
        aria-label="Retour à la page précédente"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-bold terminal-text uppercase tracking-wider text-sm">
          {label}
        </span>
      </button>
    );
  }

  // Minimal variant - Icon only
  if (variant === "minimal") {
    return (
      <button
        onClick={handleBack}
        className={`flex items-center justify-center w-10 h-10 
          border-2 border-[var(--primary)] 
          hover:bg-[var(--primary)] hover:text-black
          transition-all duration-200
          ${className}`}
        aria-label="Retour à la page précédente"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
    );
  }

  // Default variant - Full button
  return (
    <button
      onClick={handleBack}
      className={`flex items-center gap-2 px-4 py-2 
        border-2 border-[var(--primary)] 
        text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black
        transition-all duration-200 terminal-text font-bold uppercase tracking-wider
        ${className}`}
      aria-label="Retour à la page précédente"
    >
      <ArrowLeft className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );
};

// Breadcrumb component for better navigation context
interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb = ({ items, className = "" }: BreadcrumbProps) => {
  const router = useRouter();

  return (
    <nav className={`flex items-center gap-2 text-sm ${className}`} aria-label="Breadcrumb">
      {items.map((item, index) => (
        <React.Fragment key={item.href}>
          {index > 0 && (
            <span className="text-[var(--primary)]/50 font-bold">/</span>
          )}
          {index === items.length - 1 ? (
            <span className="text-[var(--primary)] font-bold terminal-text uppercase tracking-wider">
              {item.label}
            </span>
          ) : (
            <button
              onClick={() => router.push(item.href)}
              className="text-[var(--primary)]/70 hover:text-[var(--primary)] 
                font-bold terminal-text uppercase tracking-wider transition-colors"
            >
              {item.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

// Page header with back button and breadcrumb
interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbItems?: BreadcrumbItem[];
  showBackButton?: boolean;
  backButtonVariant?: "default" | "minimal";
  children?: React.ReactNode;
}

export const PageHeader = ({
  title,
  description,
  breadcrumbItems,
  showBackButton = true,
  backButtonVariant = "minimal",
  children
}: PageHeaderProps) => {
  return (
    <div className="mb-8">
      {/* Breadcrumb navigation */}
      {breadcrumbItems && breadcrumbItems.length > 0 && (
        <div className="mb-4">
          <Breadcrumb items={breadcrumbItems} />
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Back button */}
        {showBackButton && (
          <BackButton variant={backButtonVariant} className="mt-1" />
        )}

        {/* Title and description */}
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-bold terminal-text terminal-glow mb-2 uppercase tracking-wider">
            {title}
          </h1>
          {description && (
            <p className="text-[var(--primary)]/70 text-lg">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
};
