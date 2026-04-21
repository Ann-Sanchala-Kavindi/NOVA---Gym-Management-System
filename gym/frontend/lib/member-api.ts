import { API_BASE_URL } from './auth-api';

export type MemberSession = {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'pending' | 'confirmed';
  cancellationReason: string;
  trainerId: string | null;
  trainerName: string;
  trainerEmail: string;
  sessionType?: 'personal-training' | 'group';
  memberCount?: number;
  isBooked?: boolean;
  isInvited?: boolean;
};

export type MemberProfile = {
  id: string;
  name: string;
  email: string;
  role: 'member';
  memberType: 'normal' | 'premium';
  points: number;
  onboardingCompleted: boolean;
  assignedTrainerId: string | null;
  assignedTrainerName: string;
  assignedTrainerEmail: string;
  assignedTrainerSpecialization: string;
};

export type Equipment = {
  id: string;
  name: string;
  category: 'Cardio' | 'Strength' | 'Weights' | 'Flexibility' | 'Other';
  description: string;
  imageUrl?: string;
  location: string;
  maintenanceStatus: 'Good' | 'NeedsMaintenance' | 'OutOfOrder';
};

export type WorkoutCompletionQuality = 'as_prescribed' | 'partial' | 'skipped' | 'pain_stop';

export type PerformanceMetrics = {
  reps?: number;
  sets?: number;
  weight?: number;
  distance?: number;
  calories?: number;
  avgSpeed?: number;
  notes?: string;
  completionQuality?: WorkoutCompletionQuality;
  difficultyRating?: number;
  discomfortLevel?: number;
  painNote?: string;
};

export type WorkoutSession = {
  id: string;
  equipmentName: string;
  equipmentCategory: 'Cardio' | 'Strength' | 'Weights' | 'Flexibility' | 'Other';
  startTime: string;
  endTime: string | null;
  durationSeconds?: number;
  durationMinutes: number;
  performanceMetrics: PerformanceMetrics;
  status: 'active' | 'completed' | 'paused';
};

export type WorkoutStats = {
  totalWorkouts: number;
  totalMinutes: number;
  averageMinutesPerWorkout: number;
  byCategory: Record<string, { count: number; totalMinutes: number }>;
};

export type TrainerAvailability = {
  trainerId: string;
  trainerName: string;
  trainerEmail: string;
  availability: {
    day: string;
    startTime: string;
    endTime: string;
  };
  busySlots: Array<{ startTime: string; endTime: string }>;
};

export type MemberMealPlan = {
  id: string;
  trainerId: string | null;
  trainerName: string;
  trainerEmail: string;
  phase: string;
  targetCalories: number;
  macros: {
    protein: number;
    carbs: number;
    fats: number;
  };
  waterIntakeLiters?: number;
  notes?: string;
  meals: Array<{
    name: string;
    time: string;
    items: Array<{
      food: string;
      quantity: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }>;
    totals?: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  }>;
  updatedAt: string;
};

export type MonthlyProgress = {
  year: number;
  month: number;
  totalWorkouts: number;
  totalMinutes: number;
  daily: Record<string, { count: number; totalMinutes: number }>;
};

export type ShopProduct = {
  _id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
  isActive: boolean;
};

export type ShopOrder = {
  _id: string;
  items: Array<{ productId: string; name: string; price: number; quantity: number }>;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'packed' | 'delivered' | 'cancelled';
  createdAt: string;
};

export type MemberFeedback = {
  _id: string;
  message: string;
  adminReply: string;
  createdAt: string;
   rating?: number;
   likeCount?: number;
   dislikeCount?: number;
   memberId?: string | null;
   memberName?: string;
};

export type MembershipUpgradeRequest = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  decisionNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
} | null;

export type MemberLeaderboardEntry = {
  rank: number;
  id: string;
  name: string;
  email: string;
  points: number;
  avatar?: string | null;
};

export type MemberChallenge = {
  id: string;
  title: string;
  description: string;
  pointsReward: number;
  difficulty: 'easy' | 'medium' | 'hard';
  challengeType: 'daily' | 'one-time' | 'milestone-based';
  completionMode: 'manual' | 'progress' | 'proof';
  equipmentId: string | null;
  equipmentName: string;
  workoutGoalType: 'none' | 'duration-minutes' | 'reps' | 'sets';
  targetValue: number;
  targetUnit: string;
  requiresTrainerApproval: boolean;
  startsAt: string | null;
  endsAt: string | null;
  status: 'active' | 'completed' | 'expired' | 'upcoming' | 'pending-approval' | 'rejected';
  started: boolean;
  progressValue: number;
  progressDays: number;
  progressPercent: number;
  proofUrl: string;
  proofNote: string;
  completedAt: string | null;
};

export type MemberChallengesDashboard = {
  summary: {
    challengePointsEarned: number;
    completedChallenges: number;
    currentLeaderboardRank: number | null;
  };
  activeChallenges: MemberChallenge[];
  completedChallenges: MemberChallenge[];
  upcomingChallenges: MemberChallenge[];
  expiredChallenges: MemberChallenge[];
};

export type WorkoutChallengeUpdate = {
  challengeId: string;
  title: string;
  workoutGoalType: 'none' | 'duration-minutes' | 'reps' | 'sets';
  addedProgress: number;
  progressValue: number;
  targetValue: number;
  status: 'active' | 'pending-approval' | 'completed' | 'expired' | 'rejected';
};

const EMPTY_CHALLENGES_DASHBOARD: MemberChallengesDashboard = {
  summary: {
    challengePointsEarned: 0,
    completedChallenges: 0,
    currentLeaderboardRank: null,
  },
  activeChallenges: [],
  completedChallenges: [],
  upcomingChallenges: [],
  expiredChallenges: [],
};

function normalizeMemberChallenge(raw: any): MemberChallenge {
  return {
    id: String(raw?.id || raw?._id || ''),
    title: String(raw?.title || ''),
    description: String(raw?.description || ''),
    pointsReward: Number(raw?.pointsReward || 0),
    difficulty: (raw?.difficulty || 'medium') as MemberChallenge['difficulty'],
    challengeType: (raw?.challengeType || 'one-time') as MemberChallenge['challengeType'],
    completionMode: (raw?.completionMode || 'manual') as MemberChallenge['completionMode'],
    equipmentId: raw?.equipmentId ? String(raw.equipmentId) : null,
    equipmentName: String(raw?.equipmentName || ''),
    workoutGoalType: (raw?.workoutGoalType || 'none') as MemberChallenge['workoutGoalType'],
    targetValue: Number(raw?.targetValue || 1),
    targetUnit: String(raw?.targetUnit || 'steps'),
    requiresTrainerApproval: Boolean(raw?.requiresTrainerApproval),
    startsAt: raw?.startsAt || null,
    endsAt: raw?.endsAt || null,
    status: (raw?.status || (raw?.completed ? 'completed' : 'active')) as MemberChallenge['status'],
    started: Boolean(raw?.started || raw?.completed),
    progressValue: Number(raw?.progressValue || 0),
    progressDays: Number(raw?.progressDays || 0),
    progressPercent: Number(raw?.progressPercent || 0),
    proofUrl: String(raw?.proofUrl || ''),
    proofNote: String(raw?.proofNote || ''),
    completedAt: raw?.completedAt || null,
  };
}

function normalizeChallengesDashboard(raw: any): MemberChallengesDashboard {
  if (!raw || typeof raw !== 'object') {
    return EMPTY_CHALLENGES_DASHBOARD;
  }

  // Backward compatibility for old API shape: { challenges: [] }
  if (Array.isArray(raw?.challenges)) {
    const normalized = raw.challenges.map(normalizeMemberChallenge);
    const completed = normalized.filter((c) => c.status === 'completed');
    const active = normalized.filter((c) => c.status !== 'completed' && c.status !== 'upcoming' && c.status !== 'expired');
    const upcoming = normalized.filter((c) => c.status === 'upcoming');
    const expired = normalized.filter((c) => c.status === 'expired');

    return {
      summary: {
        challengePointsEarned: completed.reduce((sum, c) => sum + (c.pointsReward || 0), 0),
        completedChallenges: completed.length,
        currentLeaderboardRank: null,
      },
      activeChallenges: active,
      completedChallenges: completed,
      upcomingChallenges: upcoming,
      expiredChallenges: expired,
    };
  }

  return {
    summary: {
      challengePointsEarned: Number(raw?.summary?.challengePointsEarned || 0),
      completedChallenges: Number(raw?.summary?.completedChallenges || 0),
      currentLeaderboardRank:
        raw?.summary?.currentLeaderboardRank === null || raw?.summary?.currentLeaderboardRank === undefined
          ? null
          : Number(raw.summary.currentLeaderboardRank),
    },
    activeChallenges: Array.isArray(raw?.activeChallenges) ? raw.activeChallenges.map(normalizeMemberChallenge) : [],
    completedChallenges: Array.isArray(raw?.completedChallenges) ? raw.completedChallenges.map(normalizeMemberChallenge) : [],
    upcomingChallenges: Array.isArray(raw?.upcomingChallenges) ? raw.upcomingChallenges.map(normalizeMemberChallenge) : [],
    expiredChallenges: Array.isArray(raw?.expiredChallenges) ? raw.expiredChallenges.map(normalizeMemberChallenge) : [],
  };
}

export const memberApi = {
  async getProfile(token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch profile');
    }

    const json = (await response.json()) as { profile: MemberProfile };
    return json.profile;
  },

  async getMembershipUpgradeRequest(token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/membership/upgrade-request`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch membership upgrade request');
    }

    const json = (await response.json()) as { request: MembershipUpgradeRequest };
    return json.request;
  },

  async getPointsLeaderboard(token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/points/leaderboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch points leaderboard');
    }

    const json = (await response.json()) as { leaderboard: MemberLeaderboardEntry[]; myRank: number | null };
    return json;
  },

  async getChallenges(token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/challenges`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch challenges');
    }

    const json = await response.json().catch(() => ({}));
    return normalizeChallengesDashboard(json);
  },

  async startChallenge(challengeId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/user-challenges/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ challengeId }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || 'Failed to start challenge');
    }

    return data as { message: string };
  },

  async updateChallengeProgress(
    input: {
      challengeId: string;
      incrementValue?: number;
      markDay?: boolean;
      proofUrl?: string;
      proofNote?: string;
    },
    token: string
  ) {
    const response = await fetch(`${API_BASE_URL}/api/member/user-challenges/progress`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || 'Failed to update challenge progress');
    }

    return data as { message: string };
  },

  async completeChallenge(
    input: {
      challengeId: string;
      proofUrl?: string;
      proofNote?: string;
    },
    token: string
  ) {
    const response = await fetch(`${API_BASE_URL}/api/member/user-challenges/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || 'Failed to complete challenge');
    }

    return data as { message: string; status?: string; pointsAwarded?: number; totalPoints?: number; challengeId?: string };
  },

  async createMembershipUpgradeRequest(token: string, reason?: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/membership/upgrade-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: reason || '' }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message || 'Failed to submit membership upgrade request');
    }

    return data as { message: string; request: Exclude<MembershipUpgradeRequest, null> };
  },

  async listSessions(token: string, date?: string) {
    const url = new URL(`${API_BASE_URL}/api/member/sessions`);
    if (date) url.searchParams.append('date', date);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch sessions');
    }

    return response.json() as Promise<MemberSession[]>;
  },

  async listEquipment(token: string) {
    const paths = ['/api/member/equipment', '/api/trainer/equipment', '/api/admin/equipment'];
    let lastError = 'Failed to fetch equipment';

    for (const path of paths) {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        if (Array.isArray(data)) {
          return data as Equipment[];
        }
        return (data?.equipment || []) as Equipment[];
      }

      lastError = data?.message || data?.error || lastError;
    }

    throw new Error(lastError);
  },

  async startWorkout(
    equipmentId: string,
    token: string,
    extraPayload?: {
      workoutPlanId?: string;
      planExerciseId?: string;
      linkedExerciseName?: string;
      equipmentCategory?: string;
    }
  ) {
    const payload = {
      ...(equipmentId ? { equipmentId } : {}),
      ...(extraPayload || {}),
    };

    const response = await fetch(`${API_BASE_URL}/api/member/workouts/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to start workout');
    }

    const json = await response.json() as { workoutSession: WorkoutSession };
    return json.workoutSession;
  },

  async updateWorkout(workoutId: string, updates: Partial<{ performanceMetrics: PerformanceMetrics; status: string; elapsedSeconds: number }>, token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/workouts/${workoutId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to update workout');
    }

    const json = await response.json() as { workoutSession: WorkoutSession };
    return json.workoutSession;
  },

  async finishWorkout(workoutId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/workouts/${workoutId}/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to finish workout');
    }

    const json = await response.json() as { workoutSession: WorkoutSession; challengeUpdates?: WorkoutChallengeUpdate[] };
    return {
      workoutSession: json.workoutSession,
      challengeUpdates: Array.isArray(json.challengeUpdates) ? json.challengeUpdates : [],
    };
  },

  async listWorkouts(token: string, page = 1, limit = 10) {
    const url = new URL(`${API_BASE_URL}/api/member/workouts`);
    url.searchParams.append('page', String(page));
    url.searchParams.append('limit', String(limit));

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch workouts');
    }

    const json = await response.json() as {
      workouts: WorkoutSession[];
      pagination: { page: number; limit: number; total: number; pages: number };
    };
    return json;
  },

  async getWorkoutStats(token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/workouts/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch workout stats');
    }

    const json = await response.json() as { stats: WorkoutStats };
    return json.stats;
  },

  async getTrainerAvailability(date: string, token: string) {
    const url = new URL(`${API_BASE_URL}/api/member/booking/availability`);
    url.searchParams.append('date', date);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch trainer availability');
    }

    const json = await response.json() as { trainers: TrainerAvailability[] };
    return json.trainers || [];
  },

  async createBooking(input: { trainerId: string; date: string; startTime: string; endTime: string; name?: string; notes?: string }, token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to create booking');
    }

    return response.json();
  },

  async getMealPlan(token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/meal-plan`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch meal plan');
    }

    const json = await response.json() as { mealPlan: MemberMealPlan };
    return json.mealPlan;
  },

  async getMonthlyProgress(token: string, year?: number, month?: number) {
    const url = new URL(`${API_BASE_URL}/api/member/workouts/monthly-progress`);
    if (year) url.searchParams.append('year', String(year));
    if (month) url.searchParams.append('month', String(month));

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch monthly progress');
    }

    const json = await response.json() as { progress: MonthlyProgress };
    return json.progress;
  },

  async listShopProducts(token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/shop/products`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch products');
    }

    const json = await response.json() as { products: ShopProduct[] };
    return json.products || [];
  },

  async createOrder(items: Array<{ productId: string; quantity: number }>, token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/shop/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to place order');
    }

    return response.json();
  },

  async listMyOrders(token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/shop/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch orders');
    }

    const json = await response.json() as { orders: ShopOrder[] };
    return json.orders || [];
  },

  async submitFeedback(message: string, token: string, rating?: number) {
    const response = await fetch(`${API_BASE_URL}/api/member/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, rating }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to submit feedback');
    }

    return response.json();
  },

  async listFeedback(token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/feedback`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch feedback');
    }

    const json = await response.json() as { feedback: MemberFeedback[] };
    return json.feedback || [];
  },

  async reactToFeedback(feedbackId: string, reaction: 'like' | 'dislike', token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/feedback/${feedbackId}/react`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reaction }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to react to feedback');
    }

    const json = await response.json() as { feedback: MemberFeedback };
    return json.feedback;
  },

  async joinSession(sessionId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to join session');
    }

    return response.json() as Promise<{ message: string; session: MemberSession }>;
  },

  async getNotifications(token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch notifications');
    }

    return response.json() as Promise<{
      notifications: Array<{
        id: string;
        type: string;
        title: string;
        message: string;
        priority: 'low' | 'normal' | 'high' | 'urgent';
        isRead: boolean;
        createdAt: string;
        relatedEntityId?: string;
        relatedEntityType?: string;
        senderName?: string;
        senderEmail?: string;
      }>;
      unreadCount: number;
    }>;
  },

  async markNotificationAsRead(notificationId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/api/member/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to mark notification as read');
    }

    return response.json();
  },

  async setNotificationReadState(notificationId: string, isRead: boolean, token: string) {
    if (isRead) {
      return this.markNotificationAsRead(notificationId, token);
    }

    return { message: 'Unread state is not supported by this API yet.' };
  },
};
