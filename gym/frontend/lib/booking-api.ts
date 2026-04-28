import { API_BASE_URL } from './auth-api';

export type BookingSlot = {
  _id: string;
  trainerId: string;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  bookedBy: string | null;
  slotDurationMinutes: number;
  status: 'available' | 'booked' | 'completed' | 'cancelled';
  notes?: string;
};

export type BookingRecord = {
  _id: string;
  slotId: string;
  trainerId: { _id: string; name: string; email: string; specialization?: string };
  memberId: { _id: string; name: string; email: string };
  date: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  cancellationReason?: string;
  cancelledBy?: 'trainer' | 'member' | 'admin';
  cancelledAt?: string;
  notes?: string;
  sessionName: string;
  bookedAt: string;
};

export type UnavailableWindow = {
  startTime: string;
  endTime: string;
  reason: 'trainer_session' | 'member_booking';
  label: string;
};

export const bookingApi = {
  // ============== TRAINER ENDPOINTS ==============

  async getTrainerSlots(trainerId: string, date: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/api/booking/trainer/slots/${date}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch slots');
    }

    return response.json() as Promise<{
      message: string;
      date: string;
      summary: {
        totalSlots: number;
        bookedSlots: number;
        availableSlots: number;
        completedSlots: number;
        cancelledSlots: number;
      };
      unavailableWindows: UnavailableWindow[];
      slots: BookingSlot[];
    }>;
  },

  async createTrainerSlots(
    date: string,
    slots: Array<{ startTime: string; endTime: string; slotDurationMinutes?: number; notes?: string }>,
    token: string
  ) {
    const response = await fetch(`${API_BASE_URL}/api/booking/trainer/slots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date, slots }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to create slots');
    }

    return response.json();
  },

  async generateTrainerSlots(
    date: string,
    durationMinutes: number,
    maxSlots: number,
    token: string,
    options?: {
      replaceExisting?: boolean;
      windowStartTime?: string;
      windowEndTime?: string;
    }
  ) {
    const response = await fetch(`${API_BASE_URL}/api/booking/trainer/slots/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        date,
        durationMinutes,
        maxSlots,
        replaceExisting: options?.replaceExisting ?? true,
        windowStartTime: options?.windowStartTime,
        windowEndTime: options?.windowEndTime,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to generate slots');
    }

    return response.json() as Promise<{ message: string; created: number; slots: BookingSlot[] }>;
  },

  async updateSlot(
    slotId: string,
    updates: {
      status?: string;
      notes?: string;
      startTime?: string;
      endTime?: string;
      slotDurationMinutes?: number;
    },
    token: string
  ) {
    const response = await fetch(`${API_BASE_URL}/api/booking/trainer/slots/${slotId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to update slot');
    }

    return response.json();
  },

  async deleteSlot(slotId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/api/booking/trainer/slots/${slotId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to delete slot');
    }

    return response.json();
  },

  async getTrainerBookings(token: string, filters?: { startDate?: string; endDate?: string; status?: string }) {
    const url = new URL(`${API_BASE_URL}/api/booking/trainer/bookings`);
    if (filters?.startDate) url.searchParams.append('startDate', filters.startDate);
    if (filters?.endDate) url.searchParams.append('endDate', filters.endDate);
    if (filters?.status) url.searchParams.append('status', filters.status);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch bookings');
    }

    return response.json();
  },

  async updateTrainerBooking(
    bookingId: string,
    updates: { status?: string; cancellationReason?: string },
    token: string
  ) {
    const response = await fetch(`${API_BASE_URL}/api/booking/trainer/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to update booking');
    }

    return response.json();
  },

  // ============== MEMBER ENDPOINTS ==============

  async getAvailableSlots(trainerId: string, date: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/api/booking/booking/slots/${trainerId}/${date}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch available slots');
    }

    const json = await response.json() as { message: string; trainer: any; date: string; slots: BookingSlot[] };
    return json;
  },

  async bookSlots(slotIds: string[], sessionName: string, token: string) {
    if (!Array.isArray(slotIds) || slotIds.length === 0) {
      throw new Error('Please select at least one slot.');
    }

    const response = await fetch(`${API_BASE_URL}/api/booking/booking/book-slot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ slotIds, sessionName }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || data?.message || 'Failed to book slot');
    }

    return response.json();
  },

  async bookSlot(slotId: string, sessionName: string, token: string) {
    return this.bookSlots([slotId], sessionName, token);
  },

  async getMemberBookings(token: string, status?: string) {
    const url = new URL(`${API_BASE_URL}/api/booking/booking/my-bookings`);
    if (status) url.searchParams.append('status', status);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to fetch bookings');
    }

    const json = await response.json() as { message: string; bookings: BookingRecord[] };
    return json.bookings;
  },

  async cancelBooking(bookingId: string, cancellationReason: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/api/booking/booking/cancel/${bookingId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ cancellationReason }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to cancel booking');
    }

    return response.json();
  },

  // Approve a pending trainer booking
  async approveTrainerBooking(bookingId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/api/booking/trainer/bookings/${bookingId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to approve booking');
    }

    return response.json();
  },

  // Reschedule a trainer booking
  async rescheduleTrainerBooking(
    bookingId: string,
    newDate: string,
    newStartTime: string,
    newEndTime: string,
    reason?: string,
    token?: string
  ) {
    const response = await fetch(`${API_BASE_URL}/api/booking/trainer/bookings/${bookingId}/reschedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        newDate,
        newStartTime,
        newEndTime,
        reason,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Failed to reschedule booking');
    }

    return response.json();
  },
};
