import { API_BASE_URL } from './auth-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemberSummary = {
  _id: string;
  fullName: string;
  email: string;
  goal: 'Weight Loss' | 'Muscle Gain' | 'Fitness';
  membershipStatus: 'active' | 'trial' | 'inactive';
  avatarEmoji: string;
  joinedAt: string;
  workoutPlanCount: number;
  mealPlanCount: number;
};

export type MembersListResponse = {
  counts: {
    total: number;
    active: number;
    trial: number;
    inactive: number;
  };
  data: MemberSummary[];
};

export type MemberProfileResponse = {
  data: MemberSummary & {
    age: number | null;
    workoutPlans: unknown[];
    mealPlans: unknown[];
  };
};

export type TrainerAnalytics = {
  overview: {
    totalMembers: number;
    totalPlans: number;
    engagedPercent: number;
    urgentAlerts?: number;
  };
  membershipStatus: {
    active: number;
    trial: number;
    inactive: number;
  };
  planAssignment: {
    workoutPlans: number;
    mealPlans: number;
    engagedPercent: number;
    urgentAlerts?: number;
  };
  goalBreakdown: Record<string, number>;
  activeRate: {
    activeMembers: number;
    totalMembers: number;
    percent: number;
  };
  workoutPerformance: {
    totalCompletedWorkouts: number;
    avgCompletionRate: number;
    avgActivityRate: number;
    totalAssignedExercises: number;
    avgAdherence?: number;
    overdueExercises?: number;
    inProgressExercises?: number;
  };
  mealPerformance: { avgAdherence: number; trackedMembers: number; avgLast7DayAdherence?: number };
  equipmentAnalytics: { totalIssues: number; unsafeIssues: number; damagedIssues: number; cleaningIssues: number };
  reviewAnalytics: { totalVisible: number; averageRating: number; topCategory: string };
  trainerAlerts: Array<{
    type: string;
    severity: 'high' | 'medium' | 'low' | string;
    memberId: string;
    memberName: string;
    avatarEmoji?: string;
    title: string;
    message: string;
    metric?: number;
  }>;
  maintenancePredictions: Array<{
    equipmentId: string;
    name: string;
    location?: string;
    maintenanceStatus: string;
    usageCount: number;
    totalDurationHours: number;
    issueCount: number;
    openIssueCount: number;
    unsafeCount: number;
    damagedCount: number;
    maintenanceRiskScore: number;
    recommendedAction: string;
  }>;
  topMembers: Array<{
    _id: string;
    fullName: string;
    avatarEmoji: string;
    membershipStatus: string;
    goal: string;
    workoutCount: number;
    mealCount: number;
    completionRate?: number;
    activityRate?: number;
    avgAdherence?: number;
    avgMealAdherence?: number;
    exerciseStatusBreakdown?: Record<string, number>;
    total: number;
  }>;

  memberMealInsights: Array<{
    _id: string;
    fullName: string;
    avatarEmoji: string;
    goal: string;
    mealCount: number;
    avgMealAdherence: number;
    last7DayMealAdherence: number;
    trackedMealDays: number;
    recentTrackedMealDays: number;
    latestMealLogDate?: string | null;
    latestMealPlanName?: string;
    status: 'on_track' | 'watch' | 'needs_attention' | string;
  }>;
  needsAttention: Array<{
    _id: string;
    fullName: string;
    avatarEmoji: string;
    membershipStatus: string;
    goal: string;
    completionRate?: number;
    activityRate?: number;
    total: number;
  }>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || 'Request failed.');
  return data as T;
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Trainer/Admin: get all members with plan counts.
 * Optional status filter: 'all' | 'active' | 'trial' | 'inactive'
 * Optional search string (matches fullName or email).
 */
export async function getMembers(
  token: string,
  status = 'all',
  search = ''
): Promise<MembersListResponse> {
  const params = new URLSearchParams({ status, search });
  const res = await fetch(`${API_BASE_URL}/api/member-plans?${params}`, {
    headers: authHeader(token),
  });
  return handleResponse(res);
}

/** Trainer/Admin: get a full member profile including their plans. */
export async function getMemberProfile(
  memberId: string,
  token: string
): Promise<MemberProfileResponse> {
  const res = await fetch(`${API_BASE_URL}/api/member-plans/${memberId}`, {
    headers: authHeader(token),
  });
  return handleResponse(res);
}

/** Trainer/Admin: get aggregated analytics for the trainer dashboard. */
export async function getTrainerAnalytics(token: string): Promise<TrainerAnalytics> {
  const res = await fetch(`${API_BASE_URL}/api/member-plans/analytics`, {
    headers: authHeader(token),
  });
  return handleResponse(res);
}
