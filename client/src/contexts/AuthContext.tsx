'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { User } from '@/types';

interface MessageEdit {
  messageId: string;
  content: string;
  editedAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  recentlyDeleted: string[];
  recentlyEdited: MessageEdit[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentlyDeleted, setRecentlyDeleted] = useState<string[]>([]);
  const [recentlyEdited, setRecentlyEdited] = useState<MessageEdit[]>([]);
  const router = useRouter();

  useEffect(() => {
    api.get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      connectSocket(user.id);
    }
    return () => {
      disconnectSocket();
    };
  }, [user]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMessageDeleted = (data: { messageId: string }) => {
      setRecentlyDeleted(prev => [...prev, data.messageId]);
    };

    const handleMessageEdited = (data: { messageId: string; content: string; editedAt: string }) => {
      setRecentlyEdited(prev => [...prev, { messageId: data.messageId, content: data.content, editedAt: data.editedAt }]);
    };

    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_edited', handleMessageEdited);

    return () => {
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_edited', handleMessageEdited);
    };
  }, [user?.id]);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data.user);
    router.push('/discover');
  };

  const register = async (email: string, password: string, displayName: string) => {
    const res = await api.post('/auth/register', { email, password, displayName });
    setUser(res.data.user);
    router.push('/discover');
  };

  const googleLogin = async (credential: string) => {
    const res = await api.post('/auth/google', { credential });
    setUser(res.data.user);
    router.push('/discover');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    disconnectSocket();
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, googleLogin, logout, setUser, recentlyDeleted, recentlyEdited }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
