// API Client for ABC Health Care Backend Services
const API_BASE = '/api';

/**
 * Handle API responses with robust error and fallback support
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn(`[API ERROR] ${endpoint}:`, err.message);
    throw err;
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

  // LiveKit Token & Agent Dispatch
  async getToken(room = 'receptionist-room', name = 'Patient') {
    return apiRequest(`/token?room=${encodeURIComponent(room)}&name=${encodeURIComponent(name)}`);
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
