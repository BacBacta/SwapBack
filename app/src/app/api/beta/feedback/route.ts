/**
 * API Route: /api/beta/feedback
 * 
 * Handles beta user feedback submission
 */

import { NextResponse } from 'next/server';
import type { BetaFeedback } from '@/lib/betaTracking';

// In-memory storage (replace with database in production)
const feedbackStore: BetaFeedback[] = [];

export async function POST(request: Request) {
  try {
    const feedback: BetaFeedback = await request.json();

    // Validate required fields
    if (!feedback.userId || !feedback.walletAddress || !feedback.title || !feedback.description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Store feedback (in production, save to database)
    feedbackStore.push(feedback);

    // Log to console for now
    console.log('📝 Beta Feedback Received:', {
      id: feedback.id,
      type: feedback.type,
      category: feedback.category,
      title: feedback.title,
      priority: feedback.priority,
      walletAddress: feedback.walletAddress.slice(0, 8) + '...',
    });

    // In production, you might want to:
    // 1. Save to database (Supabase, MongoDB, etc.)
    // 2. Send notification to Discord/Slack
    // 3. Create GitHub issue for bugs
    // 4. Send email to team

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    console.error('Error processing feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return all feedback (admin only in production)
  return NextResponse.json({
    feedbacks: feedbackStore,
    total: feedbackStore.length,
  });
}
