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
      await api.get('/apps');
      setState({ isAuthenticated: true, isLoading: false, setupRequired: false });
    } catch {
      setState((s) => ({ ...s, isAuthenticated: false, isLoading: false }));
    }
  }

  const login = useCallback(async (username: string, password: string) => {
    await api.post('/auth/login', { username, password });
    setState((s) => ({ ...s, isAuthenticated: true }));
  }, []);

  const setup = useCallback(async (username: string, password: string) => {
    await api.post('/auth/setup', { username, password });
    setState({ isAuthenticated: true, isLoading: false, setupRequired: false });
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setState((s) => ({ ...s, isAuthenticated: false }));
  }, []);

  return { ...state, login, setup, logout };
}
