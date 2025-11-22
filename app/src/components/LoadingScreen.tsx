"use client";

export const LoadingScreen = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#19162F]">
      <div className="text-center">
        <div className="inline-block w-16 h-16 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="terminal-text text-xl text-[var(--primary)]">
          <span className="terminal-prefix">&gt;</span> LOADING_SWAPBACK...
        </div>
      </div>
    </div>
  );
};
