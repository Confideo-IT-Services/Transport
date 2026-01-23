import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authApi, getToken, setToken, removeToken, User } from "@/lib/api";

export type UserRole = "superadmin" | "admin" | "teacher";

export type { User };

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: { 
    email?: string; 
    username?: string; 
    password: string; 
    role: UserRole 
  }) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (token) {
        try {
          // Check if it's a demo token (starts with "demo-token-")
          if (token.startsWith('demo-token-')) {
            // For demo tokens, just restore from localStorage
            const savedUser = localStorage.getItem("allpulse_user");
            if (savedUser) {
              setUser(JSON.parse(savedUser));
            } else {
              // No saved user, clear demo token
              removeToken();
            }
          } else {
            // For real tokens, verify with backend
            const verifiedUser = await authApi.verifyToken();
            setUser(verifiedUser);
            // Update localStorage with fresh user data from backend
            localStorage.setItem("allpulse_user", JSON.stringify(verifiedUser));
          }
        } catch (error) {
          // Token invalid or expired, clean up
          console.error('Token verification failed:', error);
          removeToken();
          localStorage.removeItem("allpulse_user");
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async ({ email, username, password, role }: { 
    email?: string; 
    username?: string; 
    password: string; 
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
        default:
          throw new Error('Invalid role');
      }

      setToken(response.token);
      setUser(response.user);
      localStorage.setItem("allpulse_user", JSON.stringify(response.user));
    } catch (error) {
      // For demo mode, only use mock data for specific demo credentials
      console.log('API not available, checking for demo credentials');
      
      // Define demo credentials that match the UI demo buttons
      const DEMO_CREDENTIALS = {
        superadmin: { email: "superadmin@allpulse.com", password: "demo123" },
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
        "superadmin@allpulse.com": {
          id: "1",
          name: "Platform Admin",
          email: "superadmin@allpulse.com",
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
      };

      // Get the correct demo user
      let foundUser: User | undefined;
      if (role === 'superadmin') {
        foundUser = mockUsers["superadmin@allpulse.com"];
      } else if (role === 'admin') {
        foundUser = mockUsers["admin@school.edu"];
      } else if (role === 'teacher') {
        foundUser = mockUsers["teacher"];
      }

      if (foundUser) {
        const mockToken = `demo-token-${Date.now()}`;
        setToken(mockToken);
        setUser(foundUser);
        localStorage.setItem("allpulse_user", JSON.stringify(foundUser));
      } else {
        throw new Error('Invalid credentials');
      }
    }
  };

  const logout = () => {
    setUser(null);
    removeToken();
    localStorage.removeItem("allpulse_user");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAuthenticated: !!user, setUser }}>
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
