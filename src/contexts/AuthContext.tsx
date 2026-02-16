import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { authApi, getToken, setToken, removeToken, User } from "@/lib/api";

export type UserRole = "superadmin" | "admin" | "teacher" | "parent";

export type { User };

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: { 
    email?: string; 
    username?: string; 
    password?: string;
    phone?: string;
    otp?: string;
    role: UserRole 
  }) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setNavigate: (navigateFn: (path: string) => void) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigateRef = useRef<((path: string) => void) | null>(null);

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (token) {
        try {
          // Check if it's a demo token (starts with "demo-token-")
          if (token.startsWith('demo-token-')) {
            // For demo tokens, just restore from localStorage
            const savedUser = localStorage.getItem("conventpulse_user");
            if (savedUser) {
              setUser(JSON.parse(savedUser));
            } else {
              // No saved user, clear demo token
              removeToken();
            }
          } else {
            // For real tokens, verify with backend
            try {
              const verifiedUser = await authApi.verifyToken();
              setUser(verifiedUser);
              // Update localStorage with fresh user data from backend
              localStorage.setItem("conventpulse_user", JSON.stringify(verifiedUser));
            } catch (verifyError) {
              // If verification fails, check if we have a saved user (for superadmin, might be OK)
              const savedUser = localStorage.getItem("conventpulse_user");
              if (savedUser) {
                const user = JSON.parse(savedUser);
                // For superadmin, if verify fails but we have saved user, keep it temporarily
                // This handles cases where backend might be temporarily unavailable
                if (user.role === 'superadmin') {
                  console.warn('Token verification failed, but keeping superadmin session from localStorage');
                  setUser(user);
                } else {
                  // For other roles, require verification
                  throw verifyError;
                }
              } else {
                throw verifyError;
              }
            }
          }
        } catch (error) {
          // Token invalid or expired, clean up completely
          console.error('Token verification failed:', error);
          removeToken();
          localStorage.removeItem("conventpulse_user");
          setUser(null);
        }
      } else {
        // No token, ensure user is cleared
        setUser(null);
        localStorage.removeItem("conventpulse_user");
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Listen for auth:logout event from API helper
  useEffect(() => {
    const handleAuthLogout = () => {
      setUser(null);
      removeToken();
      localStorage.removeItem("conventpulse_user");
      
      // Navigate to appropriate login page
      if (navigateRef.current) {
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/parent')) {
          navigateRef.current('/parent/login');
        } else if (currentPath.startsWith('/superadmin')) {
          navigateRef.current('/superadmin/login');
        } else {
          navigateRef.current('/login');
        }
      }
    };

    window.addEventListener('auth:logout', handleAuthLogout);
    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, []);

  const login = async ({ email, username, password, phone, otp, role }: { 
    email?: string; 
    username?: string; 
    password?: string;
    phone?: string;
    otp?: string;
    role: UserRole 
  }) => {
    let response;

    try {
      switch (role) {
        case 'superadmin':
          if (!email) throw new Error('Email is required');
          response = await authApi.superadminLogin(email, password);
          break;
        case 'admin':
          if (!email) throw new Error('Email is required');
          response = await authApi.adminLogin(email, password);
          break;
        case 'teacher':
          if (!username) throw new Error('Username is required');
          response = await authApi.teacherLogin(username, password);
          break;
        case 'parent':
          if (!phone) throw new Error('Phone number is required');
          response = await authApi.parentLogin(phone);
          break;
        default:
          throw new Error('Invalid role');
      }

      setToken(response.token);
      setUser(response.user);
      localStorage.setItem("conventpulse_user", JSON.stringify(response.user));
    } catch (error) {
      // For demo mode, only use mock data for specific demo credentials
      console.log('API not available, checking for demo credentials');
      
      // Define demo credentials that match the UI demo buttons
      const DEMO_CREDENTIALS = {
        superadmin: { email: "superadmin@conventpulse.com", password: "demo123" },
        admin: { email: "admin@school.edu", password: "demo123" },
        teacher: { username: "teacher", password: "demo123" },
      };

      // Check if credentials match demo accounts
      let isDemoAccount = false;
      if (role === 'superadmin' && email === DEMO_CREDENTIALS.superadmin.email && password === DEMO_CREDENTIALS.superadmin.password) {
        isDemoAccount = true;
      } else if (role === 'admin' && email === DEMO_CREDENTIALS.admin.email && password === DEMO_CREDENTIALS.admin.password) {
        isDemoAccount = true;
      } else if (role === 'teacher' && username === DEMO_CREDENTIALS.teacher.username && password === DEMO_CREDENTIALS.teacher.password) {
        isDemoAccount = true;
      } else if (role === 'parent' && phone && phone.replace(/\D/g, '') === '9876543210') {
        // Demo parent account
        isDemoAccount = true;
      }

      if (!isDemoAccount) {
        // Not a demo account, re-throw the original error with better message
        const errorMessage = error instanceof Error ? error.message : 'Login failed';
        if (errorMessage.includes('connect to server') || errorMessage.includes('fetch')) {
          throw new Error('Unable to connect to server. Please check if the backend is running and the database is connected.');
        }
        throw error;
      }

      // Only use demo mode for matching demo credentials
      const mockUsers: Record<string, User> = {
        "superadmin@conventpulse.com": {
          id: "1",
          name: "Platform Admin",
          email: "superadmin@conventpulse.com",
          role: "superadmin",
        },
        "admin@school.edu": {
          id: "2",
          name: "Raj Kumar",
          email: "admin@school.edu",
          role: "admin",
          schoolId: "school-1",
          schoolName: "Delhi Public School",
        },
        "teacher": {
          id: "3",
          name: "Priya Sharma",
          username: "teacher",
          role: "teacher",
          schoolId: "school-1",
          schoolName: "Delhi Public School",
        },
        "parent": {
          id: "4",
          name: "Parent User",
          phone: "9876543210",
          role: "parent",
          schoolId: "school-1",
          schoolName: "Delhi Public School",
        },
      };

      // Get the correct demo user
      let foundUser: User | undefined;
      if (role === 'superadmin') {
        foundUser = mockUsers["superadmin@conventpulse.com"];
      } else if (role === 'admin') {
        foundUser = mockUsers["admin@school.edu"];
      } else if (role === 'teacher') {
        foundUser = mockUsers["teacher"];
      } else if (role === 'parent') {
        foundUser = mockUsers["parent"];
      }

      if (foundUser) {
        const mockToken = `demo-token-${Date.now()}`;
        setToken(mockToken);
        setUser(foundUser);
        localStorage.setItem("conventpulse_user", JSON.stringify(foundUser));
      } else {
        throw new Error('Invalid credentials');
      }
    }
  };

  const logout = () => {
    // Clear state first
    setUser(null);
    removeToken();
    localStorage.removeItem("conventpulse_user");
    
    // Navigate to appropriate login page based on current route
    if (navigateRef.current) {
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/parent')) {
        navigateRef.current('/parent/login');
      } else if (currentPath.startsWith('/superadmin')) {
        navigateRef.current('/superadmin/login');
      } else {
        navigateRef.current('/login');
      }
    }
  };

  const setNavigate = (navigateFn: (path: string) => void) => {
    navigateRef.current = navigateFn;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      login, 
      logout, 
      isAuthenticated: !!user, 
      setUser,
      setNavigate
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
