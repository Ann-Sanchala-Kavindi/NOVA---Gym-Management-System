import { API_BASE_URL } from './auth-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type EquipmentAvailability = 'Available' | 'In Use' | 'Under Maintenance';
export type EquipmentType = 'Cardio' | 'Strength' | 'Weights' | 'Flexibility' | 'Other';

export type Equipment = {
  _id: string;
  name: string;
  equipmentType: EquipmentType;
  availability: EquipmentAvailability;
  photoUrl: string | null;
  imageUrl: string;
  description: string;
  category: string;
  location: string;
  maintenanceStatus: 'Good' | 'NeedsMaintenance' | 'OutOfOrder';
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EquipmentSession = {
  _id: string;
  equipmentId: string;
  userId: string | null;
  userLabel: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  reps: number | null;
  sets: number | null;
  weightKg: number | null;
  notes: string;
  status: 'active' | 'completed';
};

export type EquipmentStats = {
  equipmentId: string;
  totalSessions: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
  totalSets: number;
  totalReps: number;
  maxWeightKg: number;
  recentSessions: EquipmentSession[];
};

export type DashboardStats = {
  totalEquipment: number;
  availableCount: number;
  inUseCount: number;
  underMaintenanceCount: number;
  totalSessionsToday: number;
  averageSessionMinutes: number;
};

export type EndSessionPayload = {
  reps?: number | null;
  sets?: number | null;
  weightKg?: number | null;
  notes?: string;
};

export type AddEquipmentPayload = {
  name: string;
  equipmentType: EquipmentType;
  availability?: EquipmentAvailability;
  description?: string;
  photo?: File | null;
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

// ── Equipment CRUD ─────────────────────────────────────────────────────────────

/** Get all equipment. Optional type filter and search. */
export async function getAllEquipment(
  type = 'All',
  search = ''
): Promise<{ count: number; data: Equipment[] }> {
  const params = new URLSearchParams({ type, search });
  const res = await fetch(`${API_BASE_URL}/api/equipment-sessions?${params}`);
  return handleResponse(res);
}

/** Get a single equipment item by ID. */
export async function getEquipmentById(id: string): Promise<{ data: Equipment }> {
  const res = await fetch(`${API_BASE_URL}/api/equipment-sessions/${id}`);
  return handleResponse(res);
}

/** Get dashboard-level stats (admin). */
export async function getDashboardStats(token: string): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE_URL}/api/equipment-sessions/dashboard/stats`, {
    headers: authHeader(token),
  });
  return handleResponse(res);
}

/** Get usage stats for a specific equipment. */
export async function getEquipmentStats(
  equipmentId: string,
  token: string
): Promise<EquipmentStats> {
  const res = await fetch(
    `${API_BASE_URL}/api/equipment-sessions/${equipmentId}/stats`,
    { headers: authHeader(token) }
  );
  return handleResponse(res);
}

/** Get current user's personal equipment usage stats. */
export async function getMyEquipmentStats(token: string): Promise<EquipmentStats[]> {
  const res = await fetch(`${API_BASE_URL}/api/equipment-sessions/my-stats`, {
    headers: authHeader(token),
  });
  return handleResponse(res);
}

/** Admin: add new equipment (supports photo upload). */
export async function addEquipment(
  payload: AddEquipmentPayload,
  token: string
): Promise<{ message: string; data: Equipment }> {
  const formData = new FormData();
  formData.append('name', payload.name);
  formData.append('equipmentType', payload.equipmentType);
  if (payload.availability) formData.append('availability', payload.availability);
  if (payload.description) formData.append('description', payload.description);
  if (payload.photo) formData.append('photo', payload.photo as any);

  const res = await fetch(`${API_BASE_URL}/api/equipment-sessions`, {
    method: 'POST',
    headers: authHeader(token),
    body: formData,
  });
  return handleResponse(res);
}

/** Admin: update equipment (supports photo upload). */
export async function updateEquipment(
  id: string,
  payload: Partial<AddEquipmentPayload>,
  token: string
): Promise<{ message: string; data: Equipment }> {
  const formData = new FormData();
  if (payload.name) formData.append('name', payload.name);
  if (payload.equipmentType) formData.append('equipmentType', payload.equipmentType);
  if (payload.availability) formData.append('availability', payload.availability);
  if (payload.description != null) formData.append('description', payload.description);
  if (payload.photo) formData.append('photo', payload.photo as any);

  const res = await fetch(`${API_BASE_URL}/api/equipment-sessions/${id}`, {
    method: 'PUT',
    headers: authHeader(token),
    body: formData,
  });
  return handleResponse(res);
}

/** Admin: delete equipment. */
export async function deleteEquipment(
  id: string,
  token: string
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/equipment-sessions/${id}`, {
    method: 'DELETE',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
  });
  return handleResponse(res);
}

// ── Equipment session tracking ─────────────────────────────────────────────────

/** Start a usage session on a piece of equipment. */
export async function startEquipmentSession(
  equipmentId: string,
  token: string
): Promise<{ message: string; data: EquipmentSession }> {
  const res = await fetch(`${API_BASE_URL}/api/equipment-sessions/sessions/start`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ equipmentId }),
  });
  return handleResponse(res);
}

/** End an active session with optional workout data. */
export async function endEquipmentSession(
  sessionId: string,
  payload: EndSessionPayload,
  token: string
): Promise<{ message: string; data: EquipmentSession }> {
  const res = await fetch(
    `${API_BASE_URL}/api/equipment-sessions/sessions/${sessionId}/end`,
    {
      method: 'PUT',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return handleResponse(res);
}
