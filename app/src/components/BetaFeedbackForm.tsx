/**
 * Beta Feedback Form Component
 * 
 * Allows beta users to submit feedback, bug reports, and feature requests
 */

'use client';

import { useState } from 'react';
import { submitBetaFeedback, reportBug, isBetaUser } from '@/lib/betaTracking';
import type { BetaFeedback } from '@/lib/betaTracking';
import { toast } from 'react-hot-toast';

type FeedbackType = BetaFeedback['type'];
type FeedbackCategory = BetaFeedback['category'];

interface BetaFeedbackFormProps {
  onClose?: () => void;
  defaultType?: FeedbackType;
  defaultCategory?: FeedbackCategory;
}

export default function BetaFeedbackForm({
  onClose,
  defaultType = 'general_feedback',
  defaultCategory = 'other',
}: BetaFeedbackFormProps) {
  const [type, setType] = useState<FeedbackType>(defaultType);
  const [category, setCategory] = useState<FeedbackCategory>(defaultCategory);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [screenshot, setScreenshot] = useState<string>('');
  const [steps, setSteps] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if user is beta tester
  if (!isBetaUser()) {
    return (
      <div className="rounded-lg border border-orange-500/20 bg-black/40 p-6 text-center">
        <p className="text-orange-400">
          Beta feedback is only available for beta testers.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      let result;

      if (type === 'bug_report') {
        // Use specialized bug report function
        const bugSteps = steps.filter(s => s.trim());
        result = await reportBug(title, description, bugSteps, screenshot);
      } else {
        // Use general feedback submission
        result = await submitBetaFeedback({
          type,
          category,
          title,
          description,
          rating: rating || undefined,
          screenshot: screenshot || undefined,
        });
      }

      if (result.success) {
        toast.success('Feedback submitted successfully! Thank you! 🎉');
        
        // Reset form
        setTitle('');
        setDescription('');
        setRating(0);
        setScreenshot('');
        setSteps(['']);
        
        // Close modal if callback provided
        onClose?.();
      } else {
        toast.error(result.error || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addStep = () => {
    setSteps([...steps, '']);
  };

  const updateStep = (index: number, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = value;
    setSteps(newSteps);
  };

  const removeStep = (index: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="rounded-lg border border-green-500/20 bg-black/60 backdrop-blur-sm p-6">
      <h2 className="text-2xl font-bold text-green-400 mb-6">
        📝 Beta Feedback
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Feedback Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Feedback Type *
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FeedbackType)}
            className="w-full bg-black/60 border border-green-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
          >
            <option value="general_feedback">💬 General Feedback</option>
            <option value="bug_report">🐛 Bug Report</option>
            <option value="feature_request">✨ Feature Request</option>
            <option value="ux_improvement">🎨 UX Improvement</option>
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Category *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
            className="w-full bg-black/60 border border-green-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
          >
            <option value="swap">🔄 Swap Functionality</option>
            <option value="buyback">💰 Buyback System</option>
            <option value="ui_ux">🎨 UI/UX Design</option>
            <option value="performance">⚡ Performance</option>
            <option value="mobile">📱 Mobile Experience</option>
            <option value="other">🔧 Other</option>
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief summary of your feedback"
            className="w-full bg-black/60 border border-green-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of your feedback..."
            rows={5}
            className="w-full bg-black/60 border border-green-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 resize-none"
            required
          />
        </div>

        {/* Steps to Reproduce (for bug reports) */}
        {type === 'bug_report' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Steps to Reproduce
            </label>
            {steps.map((step, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <span className="text-gray-400 mt-2 text-sm">{index + 1}.</span>
                <input
                  type="text"
                  value={step}
                  onChange={(e) => updateStep(index, e.target.value)}
                  placeholder={`Step ${index + 1}`}
                  className="flex-1 bg-black/60 border border-green-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                />
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="px-3 py-2 text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addStep}
              className="mt-2 text-sm text-green-400 hover:text-green-300"
            >
              + Add Step
            </button>
          </div>
        )}

        {/* Rating (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Overall Rating (optional)
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={`text-2xl transition-colors ${
                  star <= rating ? 'text-yellow-400' : 'text-gray-600'
                } hover:text-yellow-300`}
              >
                ⭐
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              {rating === 5 && '🎉 Excellent!'}
              {rating === 4 && '👍 Good'}
              {rating === 3 && '😐 Okay'}
              {rating === 2 && '😕 Needs improvement'}
              {rating === 1 && '😞 Poor'}
            </p>
          )}
        </div>

        {/* Screenshot URL (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Screenshot URL (optional)
          </label>
          <input
            type="url"
            value={screenshot}
            onChange={(e) => setScreenshot(e.target.value)}
            placeholder="https://imgur.com/..."
            className="w-full bg-black/60 border border-green-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Upload your screenshot to Imgur or similar service and paste the link
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold py-3 px-6 rounded-lg hover:from-green-500 hover:to-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '⏳ Submitting...' : '📤 Submit Feedback'}
          </button>
          
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-sm text-blue-300">
          💡 <strong>Tip:</strong> The more detailed your feedback, the better we can improve SwapBack!
          Your input is invaluable to us.
        </p>
      </div>
    </div>
  );
}
