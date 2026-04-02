import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  setupRequired: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    setupRequired: false,
  });

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const { data } = await api.get('/auth/status');

      if (!data.setupComplete) {
        setState({ isAuthenticated: false, isLoading: false, setupRequired: true });
        return;
      }

      // Try accessing a protected endpoint to verify cookie is valid
      try {
        await api.get('/apps');
        setState({ isAuthenticated: true, isLoading: false, setupRequired: false });
      } catch {
        // Cookie invalid or missing — show login
        setState({ isAuthenticated: false, isLoading: false, setupRequired: false });
      }
    } catch {
      setState({ isAuthenticated: false, isLoading: false, setupRequired: false });
    }
  }

  const login = useCallback(async (username: string, password: string) => {
    await api.post('/auth/login', { username, password });
    setState({ isAuthenticated: true, isLoading: false, setupRequired: false });
  }, []);

  const setup = useCallback(async (data: { name: string; username: string; email: string; password: string }) => {
    await api.post('/auth/setup', data);
    setState({ isAuthenticated: true, isLoading: false, setupRequired: false });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    setState({ isAuthenticated: false, isLoading: false, setupRequired: false });
  }, []);

  return { ...state, login, setup, logout };
}
