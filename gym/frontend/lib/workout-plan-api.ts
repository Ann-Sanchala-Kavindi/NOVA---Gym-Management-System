import { API_BASE_URL } from './auth-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type PlanStatus = 'active' | 'archived';
export type MetricProfile = 'Strength' | 'Cardio' | 'Flexibility' | 'Mixed';
export type EquipmentType = 'Cardio' | 'Strength' | 'Weights' | 'Flexibility' | 'Other';
export type TargetMetrics = {
  durationMinutes?: number | null;
  sets?: number | null;
  reps?: number | null;
  weight?: number | null;
  distance?: number | null;
  calories?: number | null;
  avgSpeed?: number | null;
};

export type Exercise = {
  _id: string;
  name: string;
  category: string;
  equipment: string;
  equipmentType?: EquipmentType;
  muscleGroup: string;
  difficulty: Difficulty;
  defaultSets: number;
  defaultReps: string;
  defaultRestSeconds: number;
  instructions: string;
  imageUrl: string;
  isCustom: boolean;
  metricProfile?: MetricProfile;
  createdAt: string;
};

export type ExerciseProgress = {
  status?: 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'skipped';
  firstStartedAt?: string | null;
  lastStartedAt?: string | null;
  lastCompletedAt?: string | null;
  completionCount?: number;
  adherenceScore?: number;
  bestPerformance?: {
    weight?: number;
    reps?: number;
    sets?: number;
    distance?: number;
    calories?: number;
    avgSpeed?: number;
    durationMinutes?: number;
    volume?: number;
  };
};

export type WorkoutProgressionSuggestion = { type: string; label: string; message: string };

export type WorkoutPlanExercise = {
  planExerciseId?: string;
  exerciseId: string;
  name: string;
  equipment: string;
  equipmentType?: EquipmentType;
  metricProfile?: MetricProfile;
  muscleGroup: string;
  difficulty: Difficulty;
  sets: number;
  reps: string;
  restSeconds: number;
  instructions: string;
  imageUrl: string;
  targetMetrics?: TargetMetrics;
  scheduledDay?: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday' | 'Anytime';
  progress?: ExerciseProgress;
  progressionSuggestion?: WorkoutProgressionSuggestion | null;
};

export type WorkoutPlan = {
  _id: string;
  planCode: string;
  memberId: string;
  trainerId: string;
  planName: string;
  description: string;
  goal: string;
  difficulty: Difficulty;
  durationWeeks: number;
  exercises: WorkoutPlanExercise[];
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateWorkoutPlanPayload = {
  memberId: string;
  trainerId: string;
  planName: string;
  description?: string;
  goal: string;
  difficulty: Difficulty;
  durationWeeks: number;
  exercises: Omit<WorkoutPlanExercise, 'name' | 'equipment' | 'muscleGroup' | 'difficulty' | 'imageUrl'>[];
};

export type CreateExercisePayload = {
  name: string;
  category?: string;
  equipment?: string;
  muscleGroup?: string;
  difficulty?: Difficulty;
  defaultSets?: number;
  defaultReps?: string;
  defaultRestSeconds?: number;
  instructions?: string;
  metricProfile?: MetricProfile;
  equipmentType?: EquipmentType;
  image?: File | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || 'Request failed.');
  return data as T;
}

// ── Exercise library ───────────────────────────────────────────────────────────

/** Get all exercises. Optional search and muscle-group category filter. */
export async function getExerciseLibrary(
  token: string,
  search = '',
  category = 'all'
): Promise<{ data: Exercise[] }> {
  const params = new URLSearchParams({ search, category });
  const res = await fetch(`${API_BASE_URL}/api/workout-plans/exercises?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}

/** Admin: create a custom exercise (supports image upload). */
export async function createCustomExercise(
  payload: CreateExercisePayload,
  token: string
): Promise<{ message: string; data: Exercise }> {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, val]) => {
    if (key === 'image' && val) {
      formData.append('image', val as any);
    } else if (val != null) {
      formData.append(key, String(val));
    }
  });
  const res = await fetch(`${API_BASE_URL}/api/workout-plans/exercises/custom`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return handleResponse(res);
}

/** Admin: update a custom exercise. */
export async function updateCustomExercise(
  exerciseId: string,
  payload: Partial<CreateExercisePayload>,
  token: string
): Promise<{ message: string; data: Exercise }> {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, val]) => {
    if (key === 'image' && val) {
      formData.append('image', val as any);
    } else if (val != null) {
      formData.append(key, String(val));
    }
  });
  const res = await fetch(
    `${API_BASE_URL}/api/workout-plans/exercises/custom/${exerciseId}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }
  );
  return handleResponse(res);
}

// ── Workout plans ──────────────────────────────────────────────────────────────

/** Trainer/Admin: create a workout plan for a member. */
export async function createWorkoutPlan(
  payload: CreateWorkoutPlanPayload,
  token: string
): Promise<{ message: string; data: WorkoutPlan }> {
  const res = await fetch(`${API_BASE_URL}/api/workout-plans`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

/** Trainer/Admin: update an existing workout plan. */
export async function updateWorkoutPlan(
  planId: string,
  payload: Partial<CreateWorkoutPlanPayload>,
  token: string
): Promise<{ message: string; data: WorkoutPlan }> {
  const res = await fetch(`${API_BASE_URL}/api/workout-plans/${planId}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

/** Get all workout plans for a specific member. */
export async function getWorkoutPlansForMember(
  memberId: string,
  token: string,
  status: PlanStatus | 'all' = 'active'
): Promise<{ data: WorkoutPlan[] }> {
  const params = new URLSearchParams({ status });
  const res = await fetch(
    `${API_BASE_URL}/api/workout-plans/member/${memberId}?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return handleResponse(res);
}

/** Get a single workout plan by ID. */
export async function getWorkoutPlanById(
  planId: string,
  token: string
): Promise<{ data: WorkoutPlan }> {
  const res = await fetch(`${API_BASE_URL}/api/workout-plans/${planId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}

/** Trainer/Admin: get active/archived plan counts. */
export async function getPlansCount(
  token: string
): Promise<{ activePlansCount: number; archivedPlansCount: number }> {
  const res = await fetch(`${API_BASE_URL}/api/workout-plans/plans/count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}

/** Trainer/Admin: archive a workout plan. */
export async function archiveWorkoutPlan(
  planId: string,
  token: string
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/workout-plans/${planId}/archive`, {
    method: 'PATCH',
    headers: headers(token),
  });
  return handleResponse(res);
}

/** Trainer/Admin: restore an archived workout plan. */
export async function restoreWorkoutPlan(
  planId: string,
  token: string
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/workout-plans/${planId}/restore`, {
    method: 'PATCH',
    headers: headers(token),
  });
  return handleResponse(res);
}
