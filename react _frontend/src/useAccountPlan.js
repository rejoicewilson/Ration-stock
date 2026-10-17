import { useEffect, useRef, useState } from 'react';
import { accountRequest } from './accountApi';

export default function useAccountPlan(accountId) {
  const [result, setResult] = useState(null);
  const refreshRef = useRef(null);

  useEffect(() => {
    if (!accountId) return undefined;
    let cancelled = false;
    let sequence = 0;
    let expiryTimer;
    async function refresh({ clear = false } = {}) {
      const current = ++sequence;
      setResult(previous => ({ accountId, status: clear ? null : previous?.accountId === accountId ? previous.status : null,
        loading: true, error: false }));
      try {
        const status = await accountRequest('subscription/status');
        if (!['free', 'paid', 'expired', 'inactive'].includes(status.plan)
            || typeof status.access_allowed !== 'boolean') throw new Error('Plan unavailable');
        if (cancelled || current !== sequence) return;
        setResult({ accountId, status, loading: false, error: false });
        window.clearTimeout(expiryTimer);
        // Access lasts while either the free period or the paid plan is valid.
        const expiry = Math.max(Date.parse(status.free_until) || 0, Date.parse(status.paid_until) || 0);
        const remaining = expiry - Date.now();
        if (status.access_allowed && remaining > 0) {
          expiryTimer = window.setTimeout(() => refresh({ clear: true }), Math.min(remaining + 50, 2147483647));
        }
      } catch (error) {
        if (cancelled || current !== sequence) return;
        setResult({ accountId, status: null, loading: false, error: true });
        if (error.status === 401) window.dispatchEvent(new Event('ration-session-ended'));
      }
    }
    const refreshVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const required = () => refresh({ clear: true });
    refreshRef.current = refresh;
    refresh();
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('ration-subscription-required', required);
    const timer = window.setInterval(refreshVisible, 60000);
    return () => {
      cancelled = true;
      refreshRef.current = null;
      window.clearInterval(timer);
      window.clearTimeout(expiryTimer);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      window.removeEventListener('ration-subscription-required', required);
    };
  }, [accountId]);

  const current = result?.accountId === accountId ? result : null;
  return {
    status: current?.status || null,
    loading: current?.loading ?? Boolean(accountId),
    error: current?.error || false,
    refresh: () => refreshRef.current?.(),
  };
}
