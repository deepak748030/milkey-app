import { useEffect, useRef } from 'react';
import { getCurrentUser, isAuthLoading, subscribeToAuth } from '@/lib/authStore';
import { registerCurrentDevice } from '@/lib/device';

/**
 * Real session registration — runs once when auth becomes available,
 * and re-registers on every cold start. Silent, no UI blocking.
 */
export function useDeviceSync() {
  const lastUserId = useRef<string | null>(null);
  const registering = useRef(false);

  useEffect(() => {
    const tryRegister = async (userId: string | null) => {
      if (!userId) { lastUserId.current = null; return; }
      if (registering.current) return;
      if (lastUserId.current === userId) return; // already registered this session
      registering.current = true;
      try {
        await registerCurrentDevice();
        lastUserId.current = userId;
      } finally { registering.current = false; }
    };

    // Initial check after storage restores
    if (!isAuthLoading()) {
      const u = getCurrentUser();
      if (u?.id) void tryRegister(u.id);
    }

    const unsub = subscribeToAuth((user, loading) => {
      if (loading) return;
      void tryRegister(user?.id ?? null);
    });
    return unsub;
  }, []);
}
