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
      (error as any).details = errorData.details;
      (error as any).code = errorData.code;
      throw error;
    }

    return response.json();
  } catch (error) {
    // Check if it's a network/connection error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please check if the backend is running and the database is connected.');
    }
    // Re-throw other errors
    throw error;
  }
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

  getPending: async (): Promise<any[]> => {
    return apiRequest<any[]>('/students/pending');
  },

  create: async (data: {
    registrationCode?: string;
    name?: string;
    studentName?: string;
    rollNo?: string;
    classId?: string;
    schoolId?: string;
    parentPhone?: string;
    parentEmail?: string;
    parentName?: string;
    address?: string;
    dateOfBirth?: string;
    gender?: string;
    bloodGroup?: string;
    photoUrl?: string;
    fatherName?: string;
    fatherPhone?: string;
    fatherEmail?: string;
    fatherOccupation?: string;
    motherName?: string;
    motherPhone?: string;
    motherOccupation?: string;
    emergencyContact?: string;
    previousSchool?: string;
    medicalConditions?: string;
    [key: string]: any; // Allow any additional custom fields
  }): Promise<{ success: boolean }> => {
    return apiRequest('/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  approve: async (id: string | number): Promise<{ success: boolean }> => {
    return apiRequest(`/students/${id}/approve`, {
      method: 'POST',
    });
  },

  reject: async (id: string | number): Promise<{ success: boolean }> => {
    return apiRequest(`/students/${id}/reject`, {
      method: 'POST',
    });
  },
};

// ============ REGISTRATION LINKS API ============

export const registrationLinksApi = {
  create: async (data: {
    classId: string;
    section: string;
    fieldConfig: any[];
    expiresAt?: string;
  }): Promise<{
    success: boolean;
    id: string;
    linkCode: string;
    link: string;
    fieldConfig: any[];
    expiresAt?: string;
    createdAt: string;
  }> => {
    return apiRequest('/registration-links', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAll: async (): Promise<any[]> => {
    return apiRequest<any[]>('/registration-links');
  },

  getById: async (id: string): Promise<any> => {
    return apiRequest(`/registration-links/${id}`);
  },

  getByCode: async (code: string): Promise<any> => {
    return apiRequest(`/registration-links/code/${code}`);
  },

  deactivate: async (id: string): Promise<{ success: boolean }> => {
    return apiRequest(`/registration-links/${id}/deactivate`, {
      method: 'PATCH',
    });
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    return apiRequest(`/registration-links/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============ UPLOAD API ============

export const uploadApi = {
  uploadPhoto: async (file: File): Promise<{ success: boolean; photoUrl: string; fileName: string }> => {
    const formData = new FormData();
    formData.append('photo', file);
    
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/upload/photo`, {
      method: 'POST',
      headers: token ? {
        'Authorization': `Bearer ${token}`
      } : {},
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Failed to upload photo');
    }
    
    return response.json();
  },
};

// ============ TIMETABLE API ============

export const attendanceApi = {
  // Student Attendance
  getStudentAttendance: async (classId: string, date?: string): Promise<any> => {
    const params = date ? `?date=${date}` : '';
    return apiRequest<any>(`/attendance/students/${classId}${params}`);
  },
  saveStudentAttendance: async (data: {
    classId: string;
    date: string;
    students: Array<{ id: string; status: string }>;
  }): Promise<{ success: boolean }> => {
    return apiRequest('/attendance/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getStudentAttendanceHistory: async (classId: string, startDate?: string, endDate?: string): Promise<any[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<any[]>(`/attendance/students/${classId}/history${query}`);
  },

  // Teacher Attendance
  getTeacherAttendance: async (date?: string): Promise<any[]> => {
    const params = date ? `?date=${date}` : '';
    return apiRequest<any[]>(`/attendance/teachers${params}`);
  },
  markTeacherCheckIn: async (): Promise<{ success: boolean; checkInTime?: string; time?: string }> => {
    return apiRequest('/attendance/teachers/checkin', {
      method: 'POST',
    });
  },
  markTeacherCheckOut: async (): Promise<{ success: boolean; checkOutTime?: string; time?: string }> => {
    return apiRequest('/attendance/teachers/checkout', {
      method: 'POST',
    });
  },
  markTeacherAttendance: async (data: {
    teacherId: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'leave' | 'not-marked';
    remarks?: string;
  }): Promise<{ success: boolean }> => {
    return apiRequest('/attendance/teachers/mark', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getTeacherAttendanceHistory: async (teacherId?: string, startDate?: string, endDate?: string): Promise<any[]> => {
    const params = new URLSearchParams();
    if (teacherId) params.append('teacherId', teacherId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<any[]>(`/attendance/teachers/history${query}`);
  },

  // Statistics
  getMonthlyStats: async (classId?: string, month?: string, year?: string): Promise<any[]> => {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<any[]>(`/attendance/stats/monthly${query}`);
  },
};

export const homeworkApi = {
  // Get all homework (filtered by teacher for teachers, by school for admins)
  getAll: async (): Promise<any[]> => {
    return apiRequest<any[]>('/homework');
  },

  // Get homework by class
  getByClass: async (classId: string): Promise<any[]> => {
    return apiRequest<any[]>(`/homework/class/${classId}`);
  },

  // Create homework (Teacher only)
  create: async (data: {
    title: string;
    description?: string;
    subject?: string;
    classId: string;
    dueDate?: string;
  }): Promise<{ success: boolean; homeworkId: string }> => {
    return apiRequest('/homework', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Mark homework as completed
  complete: async (id: string): Promise<{ success: boolean }> => {
    return apiRequest(`/homework/${id}/complete`, {
      method: 'POST',
    });
  },
};

export const timetableApi = {
  // Time Slots
  getTimeSlots: async (): Promise<any[]> => {
    return apiRequest<any[]>('/timetable/time-slots');
  },

  createTimeSlot: async (data: {
    startTime: string;
    endTime: string;
    type: 'class' | 'break' | 'lunch';
    displayOrder?: number;
  }): Promise<{ success: boolean; id: string }> => {
    return apiRequest('/timetable/time-slots', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateTimeSlot: async (id: string, data: {
    startTime?: string;
    endTime?: string;
    type?: 'class' | 'break' | 'lunch';
    displayOrder?: number;
  }): Promise<{ success: boolean }> => {
    return apiRequest(`/timetable/time-slots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteTimeSlot: async (id: string): Promise<{ success: boolean }> => {
    return apiRequest(`/timetable/time-slots/${id}`, {
      method: 'DELETE',
    });
  },

  // Timetable Entries
  getTimetableByClass: async (classId: string): Promise<any[]> => {
    return apiRequest<any[]>(`/timetable/class/${classId}`);
  },

  createOrUpdateEntry: async (data: {
    classId: string;
    slotId: string;
    day: string;
    subjectCode: string;
    subjectName: string;
    teacherId?: string;
    teacherName: string;
  }): Promise<{ success: boolean; id: string }> => {
    return apiRequest('/timetable/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteEntry: async (id: string): Promise<{ success: boolean }> => {
    return apiRequest(`/timetable/entries/${id}`, {
      method: 'DELETE',
    });
  },

  // Holidays
  getHolidays: async (): Promise<any[]> => {
    return apiRequest<any[]>('/timetable/holidays');
  },

  createHoliday: async (data: {
    date: string;
    name: string;
    type: 'public' | 'school' | 'exam';
  }): Promise<{ success: boolean; id: string }> => {
    return apiRequest('/timetable/holidays', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteHoliday: async (id: string): Promise<{ success: boolean }> => {
    return apiRequest(`/timetable/holidays/${id}`, {
      method: 'DELETE',
    });
  },

  // Teacher Leaves
  getLeaves: async (): Promise<any[]> => {
    return apiRequest<any[]>('/timetable/leaves');
  },

  createLeave: async (data: {
    teacherId: string;
    teacherName: string;
    startDate: string;
    endDate: string;
    reason?: string;
  }): Promise<{ success: boolean; id: string }> => {
    return apiRequest('/timetable/leaves', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  approveLeave: async (id: string): Promise<{ success: boolean; status: string }> => {
    return apiRequest(`/timetable/leaves/${id}/approve`, {
      method: 'PUT',
    });
  },

  rejectLeave: async (id: string): Promise<{ success: boolean; status: string }> => {
    return apiRequest(`/timetable/leaves/${id}/reject`, {
      method: 'PUT',
    });
  },

  deleteLeave: async (id: string): Promise<{ success: boolean }> => {
    return apiRequest(`/timetable/leaves/${id}`, {
      method: 'DELETE',
    });
  },

  // Subjects
  getSubjects: async (): Promise<any[]> =>
    apiRequest('/timetable/subjects'),
  createSubject: async (data: { code: string; name: string; color?: string }): Promise<any> =>
    apiRequest('/timetable/subjects', { method: 'POST', body: JSON.stringify(data) }),
  deleteSubject: async (id: string): Promise<any> =>
    apiRequest(`/timetable/subjects/${id}`, { method: 'DELETE' }),
};
