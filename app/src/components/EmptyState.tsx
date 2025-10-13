"use client";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState = ({ icon = "📊", title, description, action }: EmptyStateProps) => {
  return (
    <div className="swap-card text-center py-16">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-[var(--primary)]/20 to-[var(--accent)]/10 border border-[var(--primary)]/20 mx-auto mb-6 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/10 to-transparent rounded-full animate-pulse"></div>
        <span className="text-5xl relative z-10">{icon}</span>
      </div>
      
      <h3 className="text-2xl font-bold mb-3">{title}</h3>
      <p className="text-gray-400 text-lg mb-6 max-w-md mx-auto">{description}</p>
      
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary px-8 py-3"
        >
          {action.label}
        </button>
      )}
      
      {/* Decorative elements */}
      <div className="mt-8 flex justify-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[var(--primary)]/30"></div>
        <div className="w-2 h-2 rounded-full bg-[var(--accent)]/30"></div>
        <div className="w-2 h-2 rounded-full bg-[var(--secondary)]/30"></div>
      </div>
    </div>
  );
};

export const NoActivityState = () => {
  return (
    <EmptyState
      icon="🚀"
      title="No Activity Yet"
      description="Start swapping to see your trading history and analytics appear here"
      action={{
        label: "Make Your First Swap",
        onClick: () => window.location.href = "/",
      }}
    />
  );
};

export const NoConnectionState = () => {
  return (
    <EmptyState
      icon="👛"
      title="Wallet Not Connected"
      description="Connect your wallet to view your personalized dashboard and trading statistics"
    />
  );
};
