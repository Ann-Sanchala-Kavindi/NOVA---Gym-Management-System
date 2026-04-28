import { API_BASE_URL } from './auth-api';

export type FlagCategory =
  | 'Inappropriate Language'
  | 'Harassment / Abuse'
  | 'Hate / Discrimination'
  | 'Sexual / Explicit Content'
  | 'Spam / Misleading'
  | 'Other';

export type ReviewCategory =
  | 'Equipment'
  | 'Cleanliness'
  | 'Trainer Support'
  | 'Meal Guidance'
  | 'Class Experience'
  | 'App Experience'
  | 'General';

export type ReviewSentiment = 'positive' | 'neutral' | 'negative';
export type AdminStatus = 'visible' | 'flagged' | 'removed';

export type ReviewReply = {
  message: string;
  repliedAt: string;
};

export type FlagReport = {
  reporterId?: string | null;
  category: FlagCategory;
  note?: string;
  reportedAt: string;
};

export type Review = {
  _id: string;
  userId: string | null;
  userName: string;
  country: string;
  category: ReviewCategory;
  relatedFeature?: 'equipment' | 'meal-plan' | 'workout-plan' | 'general';
  topic: string;
  comment: string;
  rating: number;
  sentiment: ReviewSentiment;
  recommended: boolean;
  reply?: ReviewReply;
  isFlaggedByUsers: boolean;
  flagCount: number;
  flagReports: FlagReport[];
  hasReportedByCurrentUser?: boolean;
  adminStatus: AdminStatus;
  removalReason?: string;
  removedAt?: string | null;
  removedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewSummary = {
  totalReviews: number;
  averageRating: number;
  pendingReply: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  recommendationPercentage: number;
  ratingBreakdown: Record<string, number>;
  reportedCount: number;
  flaggedCount: number;
  quickSummary: string;
  summarySource: 'rule-based' | 'gemini';
  topKeywords: string[];
  categoryBreakdown: Record<string, number>;
};

export type CreateReviewPayload = {
  category: ReviewCategory;
  relatedFeature?: 'equipment' | 'meal-plan' | 'workout-plan' | 'general';
  userName?: string;
  country?: string;
  topic: string;
  comment: string;
  rating: number;
};

export type ReplyPayload = { message: string };
export type ReportPayload = { category: FlagCategory; note?: string };

type SentimentFilter = 'all' | ReviewSentiment;
type VisibilityFilter = 'public' | 'flagged' | 'reported' | 'all' | 'unflagged' | 'mine';

function authHeaders(token?: string) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : null;

  if (!res.ok) {
    const fallback = res.status >= 500 ? 'Server error. Please try again.' : 'Request failed.';
    throw new Error((data as any)?.message || fallback);
  }

  return (data ?? ({} as T)) as T;
}

export async function getReviews(
  filter: SentimentFilter = 'all',
  visibility: VisibilityFilter = 'public',
  token?: string
): Promise<Review[]> {
  const params = new URLSearchParams({ filter, visibility });
  const res = await fetch(`${API_BASE_URL}/api/reviews?${params}`, {
    headers: token ? authHeaders(token) : undefined,
  });
  return handleResponse<Review[]>(res);
}

export async function getReviewSummary(token?: string): Promise<ReviewSummary> {
  const res = await fetch(`${API_BASE_URL}/api/reviews/summary`, {
    headers: token ? authHeaders(token) : undefined,
  });
  return handleResponse<ReviewSummary>(res);
}

export async function createReview(payload: CreateReviewPayload, token: string): Promise<Review> {
  const res = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<Review>(res);
}

export async function reportReview(reviewId: string, payload: ReportPayload, token: string): Promise<Review> {
  const res = await fetch(`${API_BASE_URL}/api/reviews/${reviewId}/report`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<Review>(res);
}

export async function replyToReview(reviewId: string, payload: ReplyPayload, token: string): Promise<Review> {
  const res = await fetch(`${API_BASE_URL}/api/reviews/${reviewId}/reply`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<Review>(res);
}

export async function updateReviewStatus(reviewId: string, adminStatus: AdminStatus, token: string): Promise<Review> {
  const res = await fetch(`${API_BASE_URL}/api/reviews/${reviewId}/status`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ adminStatus }),
  });
  return handleResponse<Review>(res);
}

export async function deleteReview(reviewId: string, token: string, reason?: string): Promise<{ message: string; deletedId: string }> {
  const res = await fetch(`${API_BASE_URL}/api/reviews/${reviewId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify(reason ? { reason } : {}),
  });
  return handleResponse(res);
}
