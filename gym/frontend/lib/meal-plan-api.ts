import { API_BASE_URL } from './auth-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MealDifficulty = 'Beginner' | 'Moderate' | 'Advanced';
export type PlanStatus = 'active' | 'archived';

export type Food = {
  _id: string;
  name: string;
  category: string;
  servingText: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageUrl: string;
  isCustom: boolean;
  createdAt: string;
};

export type MealFood = {
  foodId: string;
  name: string;
  servingText: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageUrl: string;
};

export type MealSlot = {
  name: string;
  timeLabel: string;
  foods: MealFood[];
};

export type MealPlan = {
  _id: string;
  planCode: string;
  memberId: string;
  trainerId: string;
  planName: string;
  description: string;
  goal: string;
  difficulty: MealDifficulty;
  durationWeeks: number;
  meals: MealSlot[];
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateMealPlanPayload = {
  memberId: string;
  trainerId: string;
  planName: string;
  description?: string;
  goal: string;
  difficulty: MealDifficulty;
  durationWeeks: number;
  meals?: MealSlot[];
};

export type CreateFoodPayload = {
  name: string;
  category?: string;
  servingText?: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
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

// ── Food library ───────────────────────────────────────────────────────────────

/** Get all foods. Optional search and category filter. */
export async function getFoodLibrary(
  token: string,
  search = '',
  category = 'all'
): Promise<{ data: Food[] }> {
  const params = new URLSearchParams({ search, category });
  const res = await fetch(`${API_BASE_URL}/api/meal-plans/foods?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}

/** Admin: create a custom food item (supports image upload). */
export async function createCustomFood(
  payload: CreateFoodPayload,
  token: string
): Promise<{ message: string; data: Food }> {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, val]) => {
    if (key === 'image' && val) {
      formData.append('image', val as any);
    } else if (val != null) {
      formData.append(key, String(val));
    }
  });
  const res = await fetch(`${API_BASE_URL}/api/meal-plans/foods/custom`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return handleResponse(res);
}

/** Admin: update a custom food item. */
export async function updateCustomFood(
  foodId: string,
  payload: Partial<CreateFoodPayload>,
  token: string
): Promise<{ message: string; data: Food }> {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, val]) => {
    if (key === 'image' && val) {
      formData.append('image', val as any);
    } else if (val != null) {
      formData.append(key, String(val));
    }
  });
  const res = await fetch(`${API_BASE_URL}/api/meal-plans/foods/custom/${foodId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return handleResponse(res);
}

// ── Meal plans ─────────────────────────────────────────────────────────────────

/** Trainer/Admin: create a meal plan for a member. */
export async function createMealPlan(
  payload: CreateMealPlanPayload,
  token: string
): Promise<{ message: string; data: MealPlan }> {
  const res = await fetch(`${API_BASE_URL}/api/meal-plans`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

/** Trainer/Admin: update an existing meal plan. */
export async function updateMealPlan(
  planId: string,
  payload: Partial<CreateMealPlanPayload>,
  token: string
): Promise<{ message: string; data: MealPlan }> {
  const res = await fetch(`${API_BASE_URL}/api/meal-plans/${planId}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

/** Get all meal plans for a specific member. */
export async function getMealPlansForMember(
  memberId: string,
  token: string,
  status: PlanStatus | 'all' = 'active'
): Promise<{ data: MealPlan[] }> {
  const params = new URLSearchParams({ status });
  const res = await fetch(
    `${API_BASE_URL}/api/meal-plans/member/${memberId}?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return handleResponse(res);
}

/** Get a single meal plan by ID. */
export async function getMealPlanById(
  planId: string,
  token: string
): Promise<{ data: MealPlan }> {
  const res = await fetch(`${API_BASE_URL}/api/meal-plans/${planId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}

/** Trainer/Admin: archive a meal plan. */
export async function archiveMealPlan(
  planId: string,
  token: string
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/meal-plans/${planId}/archive`, {
    method: 'PATCH',
    headers: headers(token),
  });
  return handleResponse(res);
}

/** Trainer/Admin: restore an archived meal plan. */
export async function restoreMealPlan(
  planId: string,
  token: string
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/meal-plans/${planId}/restore`, {
    method: 'PATCH',
    headers: headers(token),
  });
  return handleResponse(res);
}


export type FoodSubstitution = Food & { calorieGap?: number; substitutionReason?: string; recommendedForMeal?: string; tags?: string[]; strategy?: string };

export type MealCompletionStatus = 'completed' | 'partial' | 'skipped';
export type MealProgressSlot = {
  mealName: string;
  status: MealCompletionStatus;
  note?: string;
  completedAt: string;
};

export type MealPlanProgressSummary = {
  dateKey?: string | null;
  daysTracked: number;
  totalExpectedMealsPerDay: number;
  completedCount: number;
  partialCount: number;
  skippedCount: number;
  adherenceScore: number;
  logs: Array<{
    dateKey: string;
    adherenceScore: number;
    slots: MealProgressSlot[];
  }>;
};

export async function trackMealProgress(
  planId: string,
  payload: { dateKey?: string; mealName: string; status: MealCompletionStatus; note?: string },
  token: string
): Promise<{ message: string; data: any; summary: MealPlanProgressSummary }> {
  const res = await fetch(`${API_BASE_URL}/api/meal-plans/${planId}/track`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function getMealPlanProgress(
  planId: string,
  token: string,
  dateKey?: string
): Promise<{ data: MealPlanProgressSummary }> {
  const params = new URLSearchParams();
  if (dateKey) params.set('dateKey', dateKey);
  const res = await fetch(`${API_BASE_URL}/api/meal-plans/${planId}/progress?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}


export async function getFoodSubstitutions(
  planId: string,
  input: { mealName: string; foodName: string; category?: string; calories?: number; protein?: number; strategy?: string },
  token: string
): Promise<{ data: FoodSubstitution[] }> {
  const params = new URLSearchParams();
  params.set('mealName', input.mealName);
  params.set('foodName', input.foodName);
  if (input.category) params.set('category', input.category);
  if (input.calories != null) params.set('calories', String(input.calories));
  if (input.protein != null) params.set('protein', String(input.protein));
  if (input.strategy) params.set('strategy', String(input.strategy));
  const res = await fetch(`${API_BASE_URL}/api/meal-plans/${planId}/substitutions?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}
