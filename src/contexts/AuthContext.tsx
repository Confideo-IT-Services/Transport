import { createContext, useContext, useState, ReactNode } from "react";

export type UserRole = "admin" | "teacher";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  schoolName?: string;
  className?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demo
const mockUsers: Record<string, User> = {
  "admin@school.edu": {
    id: "1",
    name: "Raj Kumar",
    email: "admin@school.edu",
    role: "admin",
    schoolName: "Delhi Public School",
  },
  "teacher@school.edu": {
    id: "2",
    name: "Priya Sharma",
    email: "teacher@school.edu",
    role: "teacher",
    schoolName: "Delhi Public School",
    className: "Class 5A",
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("allpulse_user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (email: string, _password: string) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    const foundUser = mockUsers[email.toLowerCase()] || mockUsers["admin@school.edu"];
    setUser(foundUser);
    localStorage.setItem("allpulse_user", JSON.stringify(foundUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("allpulse_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
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
