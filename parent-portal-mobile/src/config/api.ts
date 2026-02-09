import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000/api';

// Token management
export const getToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('conventpulse_token');
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

export const setToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem('conventpulse_token', token);
  } catch (error) {
    console.error('Error setting token:', error);
  }
};

export const removeToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('conventpulse_token');
  } catch (error) {
    console.error('Error removing token:', error);
  }
};

// API Helper
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = await getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      const errorMessage = errorData.details 
        ? `${errorData.error}: ${errorData.details}` 
        : (errorData.error || 'Request failed');
      const error = new Error(errorMessage);
      (error as any).response = { data: errorData };
      throw error;
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please check your internet connection.');
    }
    throw error;
  }
};

// Types
export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'parent';
  schoolId?: string;
  schoolName?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Child {
  id: string;
  name: string;
  rollNo: string;
  className: string;
  schoolName?: string;
  admissionNumber?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'leave';
  remarks?: string;
}

export interface Homework {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  dueDate?: string;
  createdAt: string;
  attachmentUrl?: string;
  isCompleted: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  senderName: string;
  senderRole: string;
  priority?: 'urgent' | 'normal';
  isRead: boolean;
  attachmentUrl?: string;
  createdAt: string;
}

export interface Fee {
  id: string;
  totalFee: number;
  paidAmount: number;
  pendingAmount: number;
  status: 'paid' | 'partial' | 'unpaid';
  dueDate?: string;
  componentBreakdown?: Record<string, { total: number; paid: number; pending: number }>;
}

export interface TestResult {
  id: string;
  testId: string;
  testName: string;
  testDate: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  marksObtained: number;
  maxMarks: number;
  percentage: string;
}

// Auth API
export const authApi = {
  parentLogin: async (phone: string): Promise<AuthResponse> => {
    return apiRequest<AuthResponse>('/auth/parent/login', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  verifyToken: async (): Promise<User> => {
    return apiRequest<User>('/auth/verify');
  },
};

// Parents API
export const parentsApi = {
  getChildren: async (): Promise<Child[]> => {
    return apiRequest<Child[]>('/parents/children');
  },
  
  getChildAttendance: async (studentId: string, startDate?: string, endDate?: string): Promise<AttendanceRecord[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    return apiRequest<AttendanceRecord[]>(`/parents/children/${studentId}/attendance${queryString ? '?' + queryString : ''}`);
  },
  
  getChildHomework: async (studentId: string): Promise<Homework[]> => {
    return apiRequest<Homework[]>(`/parents/children/${studentId}/homework`);
  },
  
  getChildNotifications: async (studentId: string): Promise<Notification[]> => {
    return apiRequest<Notification[]>(`/parents/children/${studentId}/notifications`);
  },
  
  getChildFees: async (studentId: string): Promise<Fee[]> => {
    return apiRequest<Fee[]>(`/parents/children/${studentId}/fees`);
  },
  
  getChildTestResults: async (studentId: string): Promise<TestResult[]> => {
    return apiRequest<TestResult[]>(`/parents/children/${studentId}/test-results`);
  },
  
  markNotificationRead: async (notificationId: string): Promise<{ success: boolean }> => {
    return apiRequest(`/parents/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  },
};



