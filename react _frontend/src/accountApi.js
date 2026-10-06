export async function accountRequest(path, body) {
  const response = await fetch(`/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail;
    const error = new Error(typeof detail === 'string' ? detail : 'Please check your details and try again.');
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  return data;
}

export async function featureFetch(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'include', cache: 'no-store' });
  if (response.status === 401) {
    window.dispatchEvent(new Event('ration-session-ended'));
    throw new Error('Please sign in again to continue.');
  }
  return response;
}
