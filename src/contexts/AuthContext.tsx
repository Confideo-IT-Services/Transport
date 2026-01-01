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
          // Try to verify the token
          const savedUser = localStorage.getItem("allpulse_user");
          if (savedUser) {
            setUser(JSON.parse(savedUser));
          }
        } catch (error) {
          // Token invalid, clean up
          removeToken();
          localStorage.removeItem("allpulse_user");
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
      // For demo mode, use mock data when API is not available
      console.log('API not available, using demo mode');
      
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

      // Demo login logic
      let foundUser: User | undefined;
      
      if (role === 'superadmin' && email) {
        foundUser = mockUsers["superadmin@allpulse.com"];
      } else if (role === 'admin' && email) {
        foundUser = mockUsers["admin@school.edu"];
      } else if (role === 'teacher' && username) {
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
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAuthenticated: !!user }}>
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
