import { useEffect, useState, useCallback } from 'react';

export function useOnlineStatus(pollMs = 30000) {
  const [isOnline, setIsOnline] = useState(true);
  const check = useCallback(async () => {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 3000);
      const r = await fetch('https://www.google.com/generate_204', { method: 'HEAD', signal: c.signal } as any);
      clearTimeout(t);
      setIsOnline(r.ok || (r as any).type === 'opaque');
    } catch { setIsOnline(false); }
  }, []);
  useEffect(() => { check(); const id = setInterval(check, pollMs); return () => clearInterval(id); }, [check, pollMs]);
  return { isOnline, check };
}
