// API Configuration and Service Layer
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Types
export interface User {
  id: string;
  name: string;
  email?: string;
  username?: string;
  role: 'superadmin' | 'admin' | 'teacher';
  schoolId?: string;
  schoolName?: string;
  className?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface School {
  id: string;
  name: string;
  code: string;
  type: string;
  location: string;
  address?: string;
  phone: string;
  email: string;
  students: number;
  teachers: number;
  admins: number;
  status: 'active' | 'pending' | 'inactive';
  createdAt: string;
}

export interface Teacher {
  id: string;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  subjects?: string[];
  isActive: boolean;
}

export interface SchoolAdmin {
  id: string;
  email: string;
  name: string;
  schoolId: string;
  isActive: boolean;
}

// Token management
export const getToken = (): string | null => {
  return localStorage.getItem('allpulse_token');
};

export const setToken = (token: string): void => {
  localStorage.setItem('allpulse_token', token);
};

export const removeToken = (): void => {
  localStorage.removeItem('allpulse_token');
};

// API Helper
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
};

// ============ AUTH API ============

export const authApi = {
  // Super Admin Login
  superadminLogin: async (email: string, password: string): Promise<AuthResponse> => {
    return apiRequest<AuthResponse>('/auth/superadmin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // School Admin Login
  adminLogin: async (email: string, password: string): Promise<AuthResponse> => {
    return apiRequest<AuthResponse>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Teacher Login (username/password)
  teacherLogin: async (username: string, password: string): Promise<AuthResponse> => {
    return apiRequest<AuthResponse>('/auth/teacher/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  // Verify Token
  verifyToken: async (): Promise<User> => {
    return apiRequest<User>('/auth/verify');
  },
};

// ============ SCHOOLS API (SuperAdmin) ============

export const schoolsApi = {
  getAll: async (): Promise<School[]> => {
    return apiRequest<School[]>('/schools');
  },

  getById: async (id: string): Promise<School> => {
    return apiRequest<School>(`/schools/${id}`);
  },

  create: async (data: {
    name: string;
    type: string;
    location: string;
    address?: string;
    phone?: string;
    email: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
  }): Promise<{ success: boolean; schoolId: string; schoolCode: string }> => {
    return apiRequest('/schools', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: Partial<School>): Promise<{ success: boolean }> => {
    return apiRequest(`/schools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deactivate: async (id: string): Promise<{ success: boolean }> => {
    return apiRequest(`/schools/${id}/deactivate`, {
      method: 'POST',
    });
  },
};

// ============ SCHOOL ADMINS API (SuperAdmin) ============

export const schoolAdminsApi = {
  getBySchool: async (schoolId: string): Promise<SchoolAdmin[]> => {
    return apiRequest<SchoolAdmin[]>(`/schools/${schoolId}/admins`);
  },

  create: async (data: {
    schoolId: string;
    email: string;
    password: string;
    name: string;
  }): Promise<{ success: boolean }> => {
    return apiRequest('/school-admins', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============ TEACHERS API (School Admin) ============

export const teachersApi = {
  getAll: async (): Promise<Teacher[]> => {
    return apiRequest<Teacher[]>('/teachers');
  },

  getById: async (id: string): Promise<Teacher> => {
    return apiRequest<Teacher>(`/teachers/${id}`);
  },

  create: async (data: {
    username: string;
    password: string;
    name: string;
    email?: string;
    phone?: string;
    subjects?: string[];
  }): Promise<{ success: boolean }> => {
    return apiRequest('/teachers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: Partial<Teacher>): Promise<{ success: boolean }> => {
    return apiRequest(`/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deactivate: async (id: string): Promise<{ success: boolean }> => {
    return apiRequest(`/teachers/${id}/deactivate`, {
      method: 'POST',
    });
  },
};

// ============ CLASSES API ============

export const classesApi = {
  getAll: async (): Promise<any[]> => {
    return apiRequest<any[]>('/classes');
  },

  create: async (data: {
    name: string;
    section?: string;
    classTeacherId?: string;
  }): Promise<{ success: boolean }> => {
    return apiRequest('/classes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============ STUDENTS API ============

export const studentsApi = {
  getAll: async (): Promise<any[]> => {
    return apiRequest<any[]>('/students');
  },

  getByClass: async (classId: string): Promise<any[]> => {
    return apiRequest<any[]>(`/classes/${classId}/students`);
  },

  create: async (data: {
    name: string;
    rollNo: string;
    classId: string;
    parentPhone?: string;
    parentEmail?: string;
  }): Promise<{ success: boolean }> => {
    return apiRequest('/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
