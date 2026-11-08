import { featureFetch } from './accountApi';

const READ_PATHS = new Set(['customers', 'customer']);
const abortError = () => new DOMException('Notebook read cancelled', 'AbortError');
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const abort = () => { window.clearTimeout(timer); reject(abortError()); };
    const timer = window.setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function ledgerRequest(path, body, { signal, onRetry } = {}) {
  const read = READ_PATHS.has(path);
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw abortError();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    // Bound read time only. Writes are never cancelled/replayed automatically.
    const timer = read ? window.setTimeout(abort, 18000) : null;
    try {
      const response = await featureFetch('/ledger/' + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: read ? controller.signal : undefined,
      });
      const data = await response.json();
      if (!response.ok) {
        const error = new Error(typeof data.detail === 'string' ? data.detail : 'Please check the notebook entry.');
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (signal?.aborted) throw abortError();
      const transient = controller.signal.aborted || Boolean(error.publicFeatureError) || error.status >= 500;
      if (!read || !transient || attempt >= 2) throw error;
      onRetry?.(attempt + 1);
    } finally {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
    await delay(attempt === 0 ? 1000 : 2500, signal);
  }
}
