/**
 * Beta Activation Modal Component
 * 
 * Allows users to enter their beta invite code and activate beta access
 */

'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { validateInviteCode, markInviteCodeUsed, getTierBenefits } from '@/lib/betaInvites';
import { initializeBetaTracking } from '@/lib/betaTracking';
import { toast } from 'react-hot-toast';

interface BetaActivationProps {
  onClose: () => void;
  onActivated: () => void;
}

export default function BetaActivation({ onClose, onActivated }: BetaActivationProps) {
  const { publicKey } = useWallet();
  const [inviteCode, setInviteCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [showBenefits, setShowBenefits] = useState(false);
  const [tier, setTier] = useState<'alpha' | 'beta' | 'gamma' | 'delta' | 'omega' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code');
      return;
    }

    setIsValidating(true);

    try {
      // Validate invite code
      const validation = validateInviteCode(inviteCode);

      if (!validation.valid) {
        toast.error(validation.message);
        return;
      }

      // Mark code as used
      markInviteCodeUsed(inviteCode);

      // Initialize beta tracking
      initializeBetaTracking(publicKey.toString(), inviteCode.toUpperCase().trim());

      // Show benefits
      setTier(validation.tier || 'omega');
      setShowBenefits(true);

      toast.success(validation.message);
    } catch (error) {
      console.error('Error activating beta:', error);
      toast.error('Failed to activate beta access. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleComplete = () => {
    onActivated();
    onClose();
  };

  if (showBenefits && tier) {
    const benefits = getTierBenefits(tier);

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-xl border border-purple-500/30 max-w-2xl w-full p-8 animate-slide-up">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{benefits.emoji}</div>
            <h2 className="text-3xl font-bold text-purple-400 mb-2">
              Welcome, {benefits.name}!
            </h2>
            <p className="text-gray-300">
              You're now part of the SwapBack Beta Program
            </p>
          </div>

          {/* Tier Benefits */}
          <div className="bg-black/40 rounded-lg p-6 mb-6 border border-purple-500/20">
            <h3 className="text-xl font-semibold text-purple-300 mb-4">
              🎁 Your Exclusive Benefits
            </h3>
            <ul className="space-y-3">
              {benefits.benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-gray-300">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Reward Details */}
          <div className="bg-gradient-to-r from-green-600/20 to-blue-600/20 rounded-lg p-6 mb-6 border border-green-500/30">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-green-400 mb-1">
                  Token Airdrop Reward
                </h4>
                <p className="text-sm text-gray-400">
                  Will be distributed after beta program completion
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-400">
                  {benefits.backReward.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">$BACK</div>
              </div>
            </div>
          </div>

          {/* Getting Started */}
          <div className="bg-blue-500/10 rounded-lg p-4 mb-6 border border-blue-500/20">
            <h4 className="text-sm font-semibold text-blue-300 mb-2">
              🚀 Getting Started
            </h4>
            <p className="text-sm text-gray-400">
              Start using SwapBack to earn progress towards your rewards! Complete swaps,
              provide feedback, and report bugs to maximize your impact.
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={handleComplete}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-4 px-6 rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            🎉 Start Testing SwapBack!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-green-500/30 max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">🧪</div>
          <h2 className="text-2xl font-bold text-green-400 mb-2">
            Join Beta Testing
          </h2>
          <p className="text-gray-400 text-sm">
            Enter your exclusive beta invite code to get started
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Beta Invite Code
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="SWAP-ALPHA-001"
              className="w-full bg-black/60 border border-green-500/30 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-500 focus:outline-none focus:border-green-500 text-center text-lg tracking-wider"
              disabled={isValidating}
              required
            />
          </div>

          {/* Wallet Info */}
          {publicKey && (
            <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
              <div className="text-xs text-gray-400 mb-1">Connected Wallet</div>
              <div className="text-sm text-green-400 font-mono">
                {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isValidating || !publicKey}
            className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold py-3 px-6 rounded-lg hover:from-green-500 hover:to-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isValidating ? '⏳ Validating...' : '✅ Activate Beta Access'}
          </button>
        </form>

        {/* Info */}
        <div className="mt-6 space-y-3">
          <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
            <p className="text-xs text-blue-300">
              💡 <strong>Don't have a code?</strong> Follow us on{' '}
              <a href="https://twitter.com/swapback_dex" className="underline hover:text-blue-200" target="_blank" rel="noopener noreferrer">
                Twitter
              </a>{' '}
              or join our{' '}
              <a href="https://discord.gg/swapback" className="underline hover:text-blue-200" target="_blank" rel="noopener noreferrer">
                Discord
              </a>{' '}
              to get an invite!
            </p>
          </div>

          <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
            <p className="text-xs text-purple-300">
              🎁 Beta testers receive exclusive rewards, early access, and fee discounts!
            </p>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="mt-6 w-full text-gray-400 hover:text-white transition-colors text-sm"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
