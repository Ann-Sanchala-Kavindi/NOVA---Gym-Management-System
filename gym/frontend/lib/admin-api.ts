import { API_BASE_URL } from './auth-api';

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  isFormData?: boolean;
};

export type Trainer = {
  id: string;
  name: string;
  email: string;
  specialization: string;
  experienceLevel: 'Beginner' | 'Intermediate' | 'Advanced' | null;
  bio: string;
  hourlyRate: number | null;
  createdAt?: string;
};

export type TrainerCreateInput = {
  name: string;
  email: string;
  password: string;
  specialization: string;
  experienceLevel: 'Beginner' | 'Intermediate' | 'Advanced' | null;
  bio: string;
  hourlyRate: number | null;
};

export type TrainerUpdateInput = {
  name: string;
  email: string;
  password?: string;
  specialization: string;
  experienceLevel: 'Beginner' | 'Intermediate' | 'Advanced' | null;
  bio: string;
  hourlyRate: number | null;
};

export type AdminResponse<T = any> = {
  message: string;
  data?: T;
  trainers?: Trainer[];
  trainer?: Trainer;
  members?: MemberAssignment[];
  member?: MemberAssignment;
  equipment?: Equipment[];
  products?: Product[];
  leaveRequests?: LeaveRequestItem[];
  leaveRequest?: LeaveRequestItem;
  trainerSchedules?: TrainerScheduleItem[];
  updatedCount?: number;
  assignedTrainerId?: string | null;
  assignedTrainerName?: string | null;
};

export type MemberAssignment = {
  id: string;
  name: string;
  email: string;
  memberType?: 'normal' | 'premium';
  createdAt?: string;
  assignedTrainerId: string | null;
  assignedTrainerName: string | null;
};

export type LeaveRequestItem = {
  id: string;
  trainerId: string | null;
  trainerName: string;
  trainerEmail: string;
  startDate: string;
  endDate: string;
  type: 'Personal' | 'Medical' | 'Vacation' | 'Other';
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  decisionNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type MembershipUpgradeRequestItem = {
  id: string;
  memberId: string | null;
  memberName: string;
  memberEmail: string;
  currentMemberType: 'normal' | 'premium';
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  decisionNote: string;
  reviewedBy: string | null;
  reviewedByName: string;
  reviewedAt: string | null;
  createdAt: string;
};

export type TrainerDaySchedule = {
  day: string;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
};

export type TrainerScheduleItem = {
  trainerId: string;
  trainerName: string;
  trainerEmail: string;
  sameTimeAllDays: boolean;
  days: TrainerDaySchedule[];
  availableDaysCount: number;
  updatedAt: string | null;
};

export type Equipment = {
  id: string;
  name: string;
  category: 'Cardio' | 'Strength' | 'Weights' | 'Flexibility' | 'Other';
  description: string;
  imageUrl?: string;
  location: string;
  maintenanceStatus: 'Good' | 'NeedsMaintenance' | 'OutOfOrder';
  isAvailable: boolean;
  createdAt?: string;
};

export type Product = {
  _id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
  isActive: boolean;
  createdAt?: string;
};

export type GymFeedback = {
  _id: string;
  memberId: {
    _id: string;
    name: string;
    email: string;
  };
  message: string;
  category: 'normal' | 'negative' | 'positive';
  aiSummaryHint: string;
  adminReply: string;
  repliedAt: string | null;
  createdAt: string;
};

export type AdminOrder = {
  _id: string;
  memberId: {
    _id: string;
    name: string;
    email: string;
  };
  items: Array<{ productId: string; name: string; price: number; quantity: number }>;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'packed' | 'delivered' | 'cancelled';
  createdAt: string;
};

export type AdminWorkoutOverview = {
  monthlySummary: {
    totalWorkouts: number;
    totalMinutes: number;
  };
  workouts: Array<{
    id: string;
    memberId: string | null;
    memberName: string;
    memberEmail: string;
    equipmentName: string;
    equipmentCategory: string;
    durationMinutes: number;
    status: string;
    endTime: string | null;
    updatedAt: string;
  }>;
};

async function apiRequest<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, token, isFormData = false } = options;

  if (!API_BASE_URL) {
    throw new Error('Missing EXPO_PUBLIC_API_URL. Set it in frontend/.env and restart Expo with --clear.');
  }

  let response: Response;
  try {
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    // Don't set Content-Type for FormData, let the browser set it with boundary
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: isFormData ? (body as FormData) : (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new Error(
      `Cannot connect to backend at ${API_BASE_URL}. Start backend server and set EXPO_PUBLIC_API_URL if needed.`
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message || 'Request failed.';
    throw new Error(message);
  }

  return data as T;
}

export const adminApi = {
  listTrainers: (token: string) =>
    apiRequest<AdminResponse<Trainer[]>>('/api/admin/trainers', {
      method: 'GET',
      token,
    }),

  createTrainer: (input: TrainerCreateInput, token: string) =>
    apiRequest<AdminResponse<Trainer>>('/api/admin/trainers', {
      method: 'POST',
      body: input,
      token,
    }),

  updateTrainer: (trainerId: string, input: TrainerUpdateInput, token: string) =>
    apiRequest<AdminResponse<Trainer>>(`/api/admin/trainers/${trainerId}`, {
      method: 'PUT',
      body: input,
      token,
    }),

  deleteTrainer: (trainerId: string, token: string) =>
    apiRequest<AdminResponse>(`/api/admin/trainers/${trainerId}`, {
      method: 'DELETE',
      token,
    }),

  listMembers: (token: string) =>
    apiRequest<AdminResponse<MemberAssignment[]>>('/api/admin/members', {
      method: 'GET',
      token,
    }),

  assignMemberToTrainer: (
    memberId: string,
    trainerId: string | null,
    token: string
  ) =>
    apiRequest<AdminResponse<MemberAssignment>>(`/api/admin/members/${memberId}/assign-trainer`, {
      method: 'PUT',
      body: { trainerId },
      token,
    }),

  bulkAssignMembersToTrainer: (
    memberIds: string[],
    trainerId: string | null,
    token: string
  ) =>
    apiRequest<AdminResponse>('/api/admin/members/assign-trainer-bulk', {
      method: 'PUT',
      body: { memberIds, trainerId },
      token,
    }),

  listLeaveRequests: (token: string, status?: 'pending' | 'approved' | 'rejected') => {
    const path = status
      ? `/api/admin/leave-requests?status=${status}`
      : '/api/admin/leave-requests';
    return apiRequest<AdminResponse<LeaveRequestItem[]>>(path, {
      method: 'GET',
      token,
    });
  },

  updateLeaveRequestStatus: (
    leaveRequestId: string,
    status: 'approved' | 'rejected',
    token: string,
    decisionNote?: string
  ) =>
    apiRequest<AdminResponse<LeaveRequestItem>>(`/api/admin/leave-requests/${leaveRequestId}/status`, {
      method: 'PATCH',
      body: { status, decisionNote: decisionNote || '' },
      token,
    }),

  listMembershipUpgradeRequests: (
    token: string,
    status?: 'pending' | 'approved' | 'rejected'
  ) => {
    const path = status
      ? `/api/admin/membership-upgrade-requests?status=${status}`
      : '/api/admin/membership-upgrade-requests';
    return apiRequest<{ message: string; requests: MembershipUpgradeRequestItem[] }>(path, {
      method: 'GET',
      token,
    });
  },

  updateMembershipUpgradeRequestStatus: (
    requestId: string,
    status: 'approved' | 'rejected',
    token: string,
    decisionNote?: string
  ) =>
    apiRequest<{ message: string; request: MembershipUpgradeRequestItem }>(
      `/api/admin/membership-upgrade-requests/${requestId}/status`,
      {
        method: 'PATCH',
        body: { status, decisionNote: decisionNote || '' },
        token,
      }
    ),

  setTrainerLeaveBalance: (trainerId: string, totalLeaveBalance: number, token: string) =>
    apiRequest<AdminResponse<Trainer>>(`/api/admin/trainers/${trainerId}/leave-balance`, {
      method: 'PATCH',
      body: { totalLeaveBalance },
      token,
    }),

  listTrainerSchedules: (token: string) =>
    apiRequest<AdminResponse<TrainerScheduleItem[]>>('/api/admin/trainers/schedules', {
      method: 'GET',
      token,
    }),

  updateMemberType: (memberId: string, memberType: 'normal' | 'premium', token: string) =>
    apiRequest<AdminResponse<MemberAssignment>>(`/api/admin/members/${memberId}/member-type`, {
      method: 'PATCH',
      body: { memberType },
      token,
    }),

  createEquipment: (input: { name: string; category?: string; description?: string; imageUrl?: string; location?: string; maintenanceStatus?: string; isAvailable?: boolean; image?: any }, token: string) => {
    const formData = new FormData();
    formData.append('name', input.name);
    if (input.category) formData.append('category', input.category);
    if (input.description) formData.append('description', input.description);
    if (input.imageUrl) formData.append('imageUrl', input.imageUrl);
    if (input.location) formData.append('location', input.location);
    if (input.maintenanceStatus) formData.append('maintenanceStatus', input.maintenanceStatus);
    if (input.isAvailable !== undefined) formData.append('isAvailable', String(input.isAvailable));
    if (input.image) formData.append('image', input.image);

    return apiRequest<AdminResponse<Equipment>>('/api/admin/equipment', {
      method: 'POST',
      body: formData,
      token,
      isFormData: true,
    });
  },

  listEquipment: (token: string) =>
    apiRequest<AdminResponse<Equipment[]>>('/api/admin/equipment', {
      method: 'GET',
      token,
    }),

  updateEquipment: (equipmentId: string, input: Partial<Equipment> & { image?: any }, token: string) => {
    const formData = new FormData();
    if (input.name) formData.append('name', input.name);
    if (input.category) formData.append('category', input.category);
    if (input.description !== undefined) formData.append('description', input.description || '');
    if (input.imageUrl !== undefined) formData.append('imageUrl', input.imageUrl || '');
    if (input.location !== undefined) formData.append('location', input.location || '');
    if (input.maintenanceStatus) formData.append('maintenanceStatus', input.maintenanceStatus);
    if (input.isAvailable !== undefined) formData.append('isAvailable', String(input.isAvailable));
    if (input.image) formData.append('image', input.image);

    return apiRequest<AdminResponse<Equipment>>(`/api/admin/equipment/${equipmentId}`, {
      method: 'PATCH',
      body: formData,
      token,
      isFormData: true,
    });
  },

  deleteEquipment: (equipmentId: string, token: string) =>
    apiRequest<AdminResponse>(`/api/admin/equipment/${equipmentId}`, {
      method: 'DELETE',
      token,
    }),

  createProduct: (input: { name: string; description?: string; price: number; imageUrl?: string; stock?: number; isActive?: boolean }, token: string) =>
    apiRequest<{ message: string; product: Product }>('/api/admin/products', {
      method: 'POST',
      body: input,
      token,
    }),

  listProducts: (token: string) =>
    apiRequest<{ message: string; products: Product[] }>('/api/admin/products', {
      method: 'GET',
      token,
    }),

  updateProduct: (productId: string, input: Partial<Product>, token: string) =>
    apiRequest<{ message: string; product: Product }>(`/api/admin/products/${productId}`, {
      method: 'PATCH',
      body: input,
      token,
    }),

  deleteProduct: (productId: string, token: string) =>
    apiRequest<{ message: string }>(`/api/admin/products/${productId}`, {
      method: 'DELETE',
      token,
    }),

  listFeedback: (token: string) =>
    apiRequest<{ message: string; feedback: GymFeedback[]; summary: { total: number; totals: Record<string, number>; summary: string } }>('/api/admin/feedback', {
      method: 'GET',
      token,
    }),

  deleteFeedback: (feedbackId: string, token: string) =>
    apiRequest<{ message: string; feedback: GymFeedback[]; summary: { total: number; totals: Record<string, number>; summary: string } }>(`/api/admin/feedback/${feedbackId}`, {
      method: 'DELETE',
      token,
    }),

  replyFeedback: (feedbackId: string, reply: string, token: string) =>
    apiRequest<{ message: string; feedback: GymFeedback }>(`/api/admin/feedback/${feedbackId}/reply`, {
      method: 'PATCH',
      body: { reply },
      token,
    }),

  listOrders: (token: string) =>
    apiRequest<{ message: string; orders: AdminOrder[] }>('/api/admin/orders', {
      method: 'GET',
      token,
    }),

  updateOrderStatus: (orderId: string, status: AdminOrder['status'], token: string) =>
    apiRequest<{ message: string; order: AdminOrder }>(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: { status },
      token,
    }),

  getWorkoutOverview: (token: string) =>
    apiRequest<{ message: string } & AdminWorkoutOverview>('/api/admin/workouts/overview', {
      method: 'GET',
      token,
    }),
};
