// API Configuration and Service Layer
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Types
export interface User {
  id: string;
  name: string;
  email?: string;
  username?: string;
  phone?: string;
  role: 'superadmin' | 'admin' | 'teacher';
  schoolId?: string;
  schoolName?: string;
  schoolCode?: string;
  schoolType?: string;
  schoolLocation?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  classId?: string;
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
      (error as any).response = { data: errorData };
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

  // Update own profile
  updateProfile: async (data: {
    name?: string;
    email?: string;
    phone?: string; // For teachers only
  }): Promise<{ success: boolean; user: User }> => {
    return apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Change password
  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> => {
    return apiRequest('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
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

  updateMySchool: async (data: {
    name?: string;
    type?: string;
    location?: string;
    address?: string;
    phone?: string;
    email?: string;
  }): Promise<{ success: boolean }> => {
    return apiRequest('/schools/my-school', {
      method: 'PUT',
      body: JSON.stringify(data),
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

  /** All school classes for dropdowns (e.g. change section) - admin and teacher */
  getForDropdown: async (): Promise<{ id: string; name: string; section: string }[]> => {
    return apiRequest<any[]>('/classes/for-dropdown');
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

  updateClassTeacher: async (classId: string, teacherId: string): Promise<{ success: boolean }> => {
    return apiRequest(`/classes/${classId}/teacher`, {
      method: 'PUT',
      body: JSON.stringify({ teacherId }),
    });
  },
};

// ============ ACADEMIC YEARS API ============
export const academicYearsApi = {
  getAll: async (): Promise<any[]> => {
    return apiRequest<any[]>('/academic-years');
  },

  getActive: async (): Promise<any> => {
    return apiRequest<any>('/academic-years/active');
  },

  create: async (data: {
    name: string;
    startDate: string;
    endDate: string;
  }): Promise<{ success: boolean; yearId: string }> => {
    return apiRequest('/academic-years', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: {
    name?: string;
    startDate?: string;
    endDate?: string;
    status?: 'active' | 'completed' | 'upcoming';
  }): Promise<{ success: boolean }> => {
    return apiRequest(`/academic-years/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    return apiRequest(`/academic-years/${id}`, {
      method: 'DELETE',
    });
  },

  promoteStudents: async (yearId: string): Promise<{
    success: boolean;
    promoted: number;
    skipped: number;
    total: number;
    errors?: Array<{
      studentId: string;
      studentName: string;
      currentClass?: string;
      reason?: string;
      error?: string;
    }>;
  }> => {
    return apiRequest(`/academic-years/${yearId}/promote-students`, {
      method: 'POST',
    });
  },
};

// ============ STUDENTS API ============

export const studentsApi = {
  getAll: async (academicYearId?: string): Promise<any[]> => {
    const params = academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : '';
    return apiRequest<any[]>(`/students${params}`);
  },

  getByClass: async (classId: string, academicYearId?: string): Promise<any[]> => {
    const params = academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : '';
    return apiRequest<any[]>(`/classes/${classId}/students${params}`);
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

  bulkImport: async (data: {
    importType: 'all_classes' | 'particular_class' | 'teacher';
    selectedClassId?: string;
    rows: Array<Record<string, any>>;
  }): Promise<{ created: number; failed: number; errors: Array<{ row: number; message: string }>; createdIds: string[] }> => {
    return apiRequest('/students/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  approve: async (id: string | number): Promise<{ success: boolean; admissionNumber?: string }> => {
    return apiRequest(`/students/${id}/approve`, {
      method: 'POST',
    });
  },

  reject: async (id: string | number): Promise<{ success: boolean }> => {
    return apiRequest(`/students/${id}/reject`, {
      method: 'POST',
    });
  },

  update: async (id: string | number, data: {
    name?: string;
    rollNo?: string;
    address?: string;
    dateOfBirth?: string;
    gender?: string;
    bloodGroup?: string;
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
    parentPhone?: string;
    parentEmail?: string;
    parentName?: string;
    photoUrl?: string;
    extra_fields?: Record<string, any>; // NEW: ID card extra fields
  }): Promise<{ success: boolean }> => {
    return apiRequest(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  updateTcStatus: async (
    studentId: string | number,
    tcStatus: 'none' | 'applied' | 'issued'
  ): Promise<{ success: boolean }> => {
    return apiRequest(`/students/${studentId}/tc-status`, {
      method: 'PATCH',
      body: JSON.stringify({ tcStatus }),
    });
  },
};

// ============ REGISTRATION LINKS API ============

export const registrationLinksApi = {
  create: async (data: {
    name?: string;
    linkType?: 'class' | 'all_classes' | 'teacher' | 'others';
    classId?: string;
    teacherId?: string;
    section?: string;
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

// ============ OTP API ============
export const otpApi = {
  send: async (mobile: string): Promise<{ success: boolean; message: string }> => {
    return apiRequest('/otp/send', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    });
  },

  verify: async (mobile: string, otp: string): Promise<{ success: boolean; message: string; verified: boolean }> => {
    return apiRequest('/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ mobile, otp }),
    });
  },

  resend: async (mobile: string): Promise<{ success: boolean; message: string }> => {
    return apiRequest('/otp/resend', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
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

  uploadIdTemplate: async (file: File): Promise<{ success: boolean; templateUrl: string; fileName: string }> => {
    const formData = new FormData();
    formData.append('template', file);
    
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/upload/id-template`, {
      method: 'POST',
      headers: token ? {
        'Authorization': `Bearer ${token}`
      } : {},
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Failed to upload ID template');
    }
    
    return response.json();
  },

  uploadIdLayout: async (file: File): Promise<{ success: boolean; layoutUrl: string; fileName: string }> => {
    const formData = new FormData();
    formData.append('layout', file);
    
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/upload/id-layout`, {
      method: 'POST',
      headers: token ? {
        'Authorization': `Bearer ${token}`
      } : {},
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Failed to upload ID layout');
    }
    
    return response.json();
  },

  uploadNotificationAttachment: async (file: File): Promise<{
    success: boolean;
    fileUrl: string;
    fileName: string;
    originalName: string;
    fileType: string;
    fileSize: number;
  }> => {
    const formData = new FormData();
    formData.append('attachment', file);
    
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/upload/notification-attachment`, {
      method: 'POST',
      headers: token ? {
        'Authorization': `Bearer ${token}`
      } : {},
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Failed to upload attachment');
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

  // Send attendance reports to all parents
  sendToAll: async (data: {
    month: number; // 1-12
    year: number;
    classId?: string; // Optional
  }): Promise<{
    success: boolean;
    message: string;
    results: {
      total: number;
      successful: number;
      failed: number;
      errors: Array<{ student: string; phone: string; error: string }>;
    };
  }> => {
    return apiRequest('/attendance/send-to-all', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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

  // Get student completions for a homework
  getCompletions: async (homeworkId: string): Promise<{ studentId: string; completed: boolean }[]> => {
    return apiRequest(`/homework/${homeworkId}/completions`);
  },

  // Update student completion
  updateCompletion: async (homeworkId: string, data: {
    studentId: string;
    completed: boolean;
  }): Promise<{ success: boolean }> => {
    return apiRequest(`/homework/${homeworkId}/completions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Bulk update completions
  bulkUpdateCompletions: async (homeworkId: string, completions: Array<{
    studentId: string;
    completed: boolean;
  }>): Promise<{ success: boolean }> => {
    return apiRequest(`/homework/${homeworkId}/completions/bulk`, {
      method: 'POST',
      body: JSON.stringify({ completions }),
    });
  },

  // Send homework to all parents for a specific date
  sendToAllParents: async (date: string): Promise<{
    success: boolean;
    results: {
      total: number;
      successful: number;
      failed: number;
      errors: Array<{ phone: string; error: string }>;
    };
  }> => {
    return apiRequest('/homework/send-to-all', {
      method: 'POST',
      body: JSON.stringify({ date }),
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

// ============ TESTS API ============
export const testsApi = {
  getAll: async (): Promise<any[]> => {
    return apiRequest<any[]>('/tests');
  },

  getById: async (testId: string): Promise<any> => {
    return apiRequest<any>(`/tests/${testId}`);
  },

  create: async (data: {
    name: string;
    testTime: string;
    testDate: string;
    classId: string;
    subjects: Array<{
      subjectId: string;
      maxMarks: number;
      syllabus: string;
    }>;
  }): Promise<{ success: boolean; testId: string }> => {
    return apiRequest('/tests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (testId: string, data: {
    name: string;
    testTime: string;
    testDate: string;
    subjects?: Array<{
      subjectId: string;
      maxMarks: number;
      syllabus: string;
    }>;
  }): Promise<{ success: boolean; message: string }> => {
    return apiRequest(`/tests/${testId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  saveResults: async (testId: string, results: Array<{
    studentId: string;
    subjectId: string;
    marksObtained: number;
  }>): Promise<{ success: boolean }> => {
    return apiRequest(`/tests/${testId}/results`, {
      method: 'POST',
      body: JSON.stringify({ results }),
    });
  },

  getResults: async (testId: string): Promise<any[]> => {
    return apiRequest<any[]>(`/tests/${testId}/results`);
  },

  sendToAllParents: async (testId: string): Promise<{
    success: boolean;
    message: string;
    results: {
      total: number;
      successful: number;
      failed: number;
      errors: Array<{ student: string; phone: string; error: string }>;
    };
  }> => {
    return apiRequest(`/tests/${testId}/send-to-all`, {
      method: 'POST',
    });
  },
};

// ============ FEES API ============
export const feesApi = {
  // Student Fees
  getStudentFees: async (classId?: string, searchTerm?: string): Promise<any[]> => {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    if (searchTerm) params.append('searchTerm', searchTerm);
    const query = params.toString();
    return apiRequest<any[]>(`/fees/students${query ? `?${query}` : ''}`);
  },

  getStudentFeeById: async (studentId: string): Promise<any> => {
    return apiRequest<any>(`/fees/students/${studentId}`);
  },

  createStudentFee: async (data: {
    studentId: string;
    classId: string;
    academicYearId?: string;
    totalFee: number;
    tuitionFee?: number;
    transportFee?: number;
    labFee?: number;
    otherFees?: any;
    frequency?: "yearly" | "quarterly" | "monthly";
    dueDate?: string;
  }): Promise<{ success: boolean; studentFeeId: string; updated?: boolean }> => {
    return apiRequest('/fees/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateStudentFee: async (studentFeeId: string, data: {
    totalFee: number;
    tuitionFee?: number;
    transportFee?: number;
    labFee?: number;
    otherFees?: any;
    frequency?: "yearly" | "quarterly" | "monthly";
    dueDate?: string;
  }): Promise<{ success: boolean }> => {
    return apiRequest(`/fees/students/${studentFeeId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  createFeesForClass: async (data: {
    classId: string;
    academicYearId?: string;
    totalFee: number;
    dueDate?: string;
  }): Promise<{ success: boolean; created: number; skipped: number; total: number }> => {
    return apiRequest('/fees/students/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Fee Categories
  getCategories: async (): Promise<any[]> => {
    return apiRequest<any[]>('/fees/categories');
  },

  createCategory: async (data: {
    name: string;
    amount: number;
    frequency: 'monthly' | 'quarterly' | 'yearly';
    description?: string;
  }): Promise<{ success: boolean; categoryId: string }> => {
    return apiRequest('/fees/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateCategory: async (id: string, data: {
    name?: string;
    amount?: number;
    frequency?: 'monthly' | 'quarterly' | 'yearly';
    description?: string;
    isActive?: boolean;
  }): Promise<{ success: boolean }> => {
    return apiRequest(`/fees/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteCategory: async (id: string): Promise<{ success: boolean }> => {
    return apiRequest(`/fees/categories/${id}`, {
      method: 'DELETE',
    });
  },

  // Fee Structure
  getFeeStructure: async (): Promise<any[]> => {
    return apiRequest<any[]>('/fees/structure');
  },

  updateFeeStructure: async (data: {
    className?: string;
    classId?: string;
    academicYearId?: string;
    totalFee: number;
    tuitionFee?: number;
    transportFee?: number;
    labFee?: number;
    otherFees?: any;
    frequency?: "yearly" | "quarterly" | "monthly";
  }): Promise<{ success: boolean; structureId: string }> => {
    return apiRequest('/fees/structure', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteFeeStructure: async (id: string): Promise<{ success: boolean }> => {
    return apiRequest(`/fees/structure/${id}`, {
      method: 'DELETE',
    });
  },

  // Payments
  recordPayment: async (data: {
    studentFeeId: string;
    amount: number;
    paymentDate: string;
    paymentMethod?: 'cash' | 'cheque' | 'online' | 'bank_transfer';
    component?: string;
    transactionId?: string;
    receiptNumber?: string;
    remarks?: string;
  }): Promise<{ success: boolean; paymentId: string }> => {
    return apiRequest('/fees/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Component Breakdown
  getComponentBreakdown: async (studentId: string): Promise<{
    totalFee: number;
    paidAmount: number;
    pendingAmount: number;
    breakdown: Record<string, { total: number; paid: number; pending: number }>;
  }> => {
    return apiRequest(`/fees/students/${studentId}/breakdown`);
  },

  // Summary
  getSummary: async (): Promise<{
    totalCollected: number;
    totalPending: number;
    fullyPaidCount: number;
    unpaidCount: number;
  }> => {
    return apiRequest('/fees/summary');
  },

  // Reminders
  sendReminder: async (studentId: string): Promise<{ success: boolean; message: string }> => {
    return apiRequest(`/fees/reminders/${studentId}`, {
      method: 'POST',
    });
  },
};

// ============ ID CARD TEMPLATES API ============
export interface IDCardTemplate {
  id: string;
  schoolId: string;
  name: string;
  templateData: {
    elements?: Array<{
      id: string;
      type: 'photo' | 'text' | 'logo' | 'qr' | 'textbox';
      label: string;
      x: number;
      y: number;
      width: number;
      height: number;
      fontSize?: number;
      fontFamily?: string;
      fontWeight?: string;
      fontStyle?: string;
      textAlign?: 'left' | 'center' | 'right';
      color?: string;
      field?: string;
      photoShape?: 'circle' | 'square' | 'rounded' | 'rectangle';
    }>;
    s3_layout_url?: string; // NEW: S3 URL for layout JSON
    field_mappings?: Record<string, string>; // NEW: Field mappings
  };
  layoutJsonUrl?: string; // NEW: Prefer using this for generation
  backgroundImageUrl?: string;
  cardWidth: number;
  cardHeight: number;
  orientation: 'portrait' | 'landscape';
  sheetSize: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export const idCardTemplatesApi = {
  getBySchool: async (schoolId: string): Promise<IDCardTemplate[]> => {
    return apiRequest<IDCardTemplate[]>(`/id-templates/school/${schoolId}`);
  },

  getById: async (id: string): Promise<IDCardTemplate> => {
    return apiRequest<IDCardTemplate>(`/id-templates/${id}`);
  },

  create: async (data: {
    schoolId: string;
    name: string;
    templateData?: IDCardTemplate['templateData'];
    layoutJsonUrl?: string; // NEW
    backgroundImageUrl?: string;
    cardWidth?: number;
    cardHeight?: number;
    orientation?: 'portrait' | 'landscape';
    sheetSize?: string;
    isDefault?: boolean;
  }): Promise<{ id: string; message: string }> => {
    return apiRequest('/id-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: {
    name?: string;
    templateData?: IDCardTemplate['templateData'];
    layoutJsonUrl?: string; // NEW
    backgroundImageUrl?: string;
    cardWidth?: number;
    cardHeight?: number;
    orientation?: 'portrait' | 'landscape';
    sheetSize?: string;
    isDefault?: boolean;
  }): Promise<{ message: string }> => {
    return apiRequest(`/id-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<{ message: string }> => {
    return apiRequest(`/id-templates/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============ ID CARD GENERATION API ============
export interface StudentForIDCard {
  id: string;
  name: string;
  rollNo: string;
  admissionNumber: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  photoUrl: string;
  className: string;
  section: string;
  class: string;
  schoolName: string;
  submittedData?: any;
  fatherName?: string;
  motherName?: string;
  address?: string;
  extra_fields?: Record<string, any>; // NEW
  resolved_fields?: Record<string, any>; // NEW: Fields resolved from mappings
}

export interface IDCardGenerationResponse {
  template_layout: any; // Layout JSON from S3
  template_metadata: {
    id: string;
    name: string;
    card_width: number;
    card_height: number;
    orientation: string;
    sheet_size: string;
    background_image_url?: string;
  };
  students: StudentForIDCard[];
  missing_fields: Array<{
    student_id: string;
    student_name: string;
    fields: string[];
  }>;
}

export const idCardGenerationApi = {
  getStudents: async (schoolId: string, templateId: string): Promise<IDCardGenerationResponse> => {
    return apiRequest<IDCardGenerationResponse>(`/id-cards/students/${schoolId}?templateId=${templateId}`);
  },

  getPreviewData: async (studentId: string, templateId: string): Promise<{
    student: StudentForIDCard;
    template: IDCardTemplate;
  }> => {
    return apiRequest(`/id-cards/preview/${studentId}/${templateId}`);
  },
};

// ============ NOTIFICATIONS API ============
export interface Notification {
  id: string;
  title: string;
  message: string;
  senderName: string;
  senderRole: 'admin' | 'teacher';
  priority: 'normal' | 'urgent';
  read: boolean;
  readAt?: string;
  createdAt: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  time?: string; // For backward compatibility
  sender?: string; // For backward compatibility
}

export interface SentNotification {
  id: string;
  title: string;
  message: string;
  targetType: 'all_classes' | 'selected_classes' | 'all_teachers' | 'all_parents' | 'specific_students';
  targetClasses?: string[];
  priority: 'normal' | 'urgent';
  status: 'draft' | 'sent' | 'failed';
  recipients: number;
  time: string;
  createdAt?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
}

export interface NotificationTemplate {
  id: string;
  title: string;
  message: string;
  targetType: 'all_classes' | 'selected_classes' | 'all_teachers' | 'all_parents' | 'specific_students';
  createdAt: string;
}

export const notificationsApi = {
  getInbox: async (): Promise<Notification[]> => {
    return apiRequest<Notification[]>('/notifications/inbox');
  },

  getSent: async (): Promise<SentNotification[]> => {
    return apiRequest<SentNotification[]>('/notifications/sent');
  },

  getTemplates: async (): Promise<NotificationTemplate[]> => {
    return apiRequest<NotificationTemplate[]>('/notifications/templates');
  },

  send: async (data: {
    title: string;
    message: string;
    targetType: 'all_classes' | 'selected_classes' | 'all_teachers' | 'all_parents' | 'specific_students';
    targetClasses?: string[];
    targetStudents?: string[];
    priority?: 'normal' | 'urgent';
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentType?: string;
  }): Promise<{ success: boolean; message: string; notificationId: string }> => {
    return apiRequest('/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  markAsRead: async (notificationId: string): Promise<{ success: boolean }> => {
    return apiRequest(`/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  },
};
