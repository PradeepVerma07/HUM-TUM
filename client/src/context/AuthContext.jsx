import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await axios.get('/api/auth/me');
      if (res.data?.user) {
        setUser(res.data.user);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (usernameOrEmail, password) => {
    const res = await axios.post('/api/auth/login', { usernameOrEmail, password });
    if (res.data?.user) {
      setUser(res.data.user);
      return res.data.user;
    }
  };

  const register = async (username, displayName, email, password) => {
    const res = await axios.post('/api/auth/register', { username, displayName, email, password });
    if (res.data?.user) {
      setUser(res.data.user);
      return res.data.user;
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch {}
    setUser(null);
  };

  const updateProfile = async (displayName, bio, avatarUrl) => {
    const res = await axios.patch('/api/users/profile', { displayName, bio, avatarUrl });
    if (res.data?.user) {
      setUser(res.data.user);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
