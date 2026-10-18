import { useEffect, useState } from 'react';

const KEY = 'ration-reduce-animations';
const EVENT = 'ration-animation-preference-changed';
function readPreference() {
  try { return window.localStorage.getItem(KEY) === 'true'; }
  catch { return false; }
}

// Browser-only display preference, independent of accounts/payment settings.
export default function useAnimationPreference() {
  const [reduced, setReduced] = useState(readPreference);
  useEffect(() => {
    const changed = event => { if (typeof event.detail === 'boolean') setReduced(event.detail); };
    const stored = event => { if (event.key === KEY || event.key === null) setReduced(readPreference()); };
    window.addEventListener(EVENT, changed);
    window.addEventListener('storage', stored);
    return () => { window.removeEventListener(EVENT, changed); window.removeEventListener('storage', stored); };
  }, []);
  function updateReduced(value) {
    const next = Boolean(value);
    setReduced(next);
    try { window.localStorage.setItem(KEY, String(next)); } catch { /* Works in memory if storage is unavailable. */ }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
  return [reduced, updateReduced];
}
