// API Client for ABC Health Care Backend Services
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

/**
 * Handle API responses with timeout and fallback support
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const { timeoutMs, ...fetchOptions } = options;
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller ? controller.signal : fetchOptions.signal,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn(`[API ERROR] ${endpoint}:`, err.message);
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const api = {
  // Appointments
  async getAppointments(filters = {}) {
    const params = new URLSearchParams();
    if (filters.doctor_id) params.append('doctor_id', filters.doctor_id);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.date) params.append('date', filters.date);
    if (filters.search) params.append('search', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/appointments${query}`);
  },

  async getAppointmentById(id) {
    return apiRequest(`/appointments/${id}`);
  },

  async createAppointment(data) {
    return apiRequest('/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAppointment(id, data) {
    return apiRequest(`/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteAppointment(id) {
    return apiRequest(`/appointments/${id}`, {
      method: 'DELETE',
    });
  },

  // Doctors
  async getDoctors() {
    return apiRequest('/doctors');
  },

  // Stats
  async getStats() {
    return apiRequest('/stats');
  },

  // Settings
  async getSettings() {
    return apiRequest('/settings');
  },

  async updateSettings(settings) {
    return apiRequest('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  // LiveKit Config & Token
  async getConfig() {
    return apiRequest('/config', { timeoutMs: 2500 });
  },

  async getToken(room = 'receptionist-room', name = 'Patient') {
    return apiRequest(`/token?room=${encodeURIComponent(room)}&name=${encodeURIComponent(name)}`, {
      timeoutMs: 4000,
    });
  },
};

// Default fallback doctors if backend is offline during preview
export const FALLBACK_DOCTORS = [
  {
    id: 'doc-001-rahul',
    name: 'Dr. Rahul Nair',
    specialization: 'General Physician',
    degrees: 'MBBS, MD (Medicine)',
    room: 'Room 101',
  },
  {
    id: 'doc-002-priya',
    name: 'Dr. Priya Menon',
    specialization: 'Dermatologist',
    degrees: 'MBBS, MD (Dermatology)',
    room: 'Room 204',
  },
  {
    id: 'doc-003-anil',
    name: 'Dr. Anil Kumar',
    specialization: 'Cardiologist',
    degrees: 'MBBS, DM (Cardiology)',
    room: 'Room 305',
  },
];
