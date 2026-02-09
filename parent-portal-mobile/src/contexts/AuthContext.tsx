import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { authApi, getToken, removeToken, setToken, User } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (phone: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await getToken();
      if (token) {
        try {
          if (token.startsWith('demo-token-')) {
            const savedUser = await AsyncStorage.getItem('conventpulse_user');
            if (savedUser) {
              setUser(JSON.parse(savedUser));
            } else {
              await removeToken();
            }
          } else {
            const verifiedUser = await authApi.verifyToken();
            setUser(verifiedUser);
            await AsyncStorage.setItem('conventpulse_user', JSON.stringify(verifiedUser));
          }
        } catch (error) {
          console.error('Token verification failed:', error);
          await removeToken();
          await AsyncStorage.removeItem('conventpulse_user');
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (phone: string) => {
    const response = await authApi.parentLogin(phone);
    await setToken(response.token);
    await AsyncStorage.setItem('conventpulse_user', JSON.stringify(response.user));
    setUser(response.user);
  };

  const logout = async () => {
    await removeToken();
    await AsyncStorage.removeItem('conventpulse_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}



