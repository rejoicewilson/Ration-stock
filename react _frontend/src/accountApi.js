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
  let response;
  try {
    response = await fetch(url, { ...options, credentials: 'include', cache: 'no-store' });
  } catch {
    throw featureFailure('network');
  }
  if (response.status === 401) {
    window.dispatchEvent(new Event('ration-session-ended'));
    throw new Error('Please sign in again to continue.');
  }
  if (response.status === 402) {
    window.dispatchEvent(new Event('ration-subscription-required'));
    throw new Error('Your plan has expired. Renew to continue.');
  }
  if (response.status >= 500) {
    const data = await response.clone().json().catch(() => ({}));
    const detail = data.detail;
    // Support both the new public error codes and older deployments. Never
    // render the upstream exception, response HTML, or infrastructure details.
    const legacyEpos = typeof detail === 'string'
      && /(?:upstream epos .*request failed|epos .*taking too long)/i.test(detail);
    const kind = detail?.code === 'EPOS_UNAVAILABLE' || legacyEpos ? 'epos' : 'service';
    throw featureFailure(kind);
  }
  return response;
}

function featureFailure(kind) {
  const error = new Error('Feature data is temporarily unavailable.');
  error.publicFeatureError = { kind };
  return error;
}

export function featureErrorMessage(error, fallback = 'Unable to load these details. Please try again.') {
  if (error?.publicFeatureError) return error.publicFeatureError;
  const inputMessages = [
    'Please select the current month or a previous month.',
    'Please enter a correct ration card number.',
  ];
  if (inputMessages.includes(error?.message)) return error.message;
  // Account events still control sign-in and renewal; do not call them ePoS errors.
  if (/^(Please sign in again|Your plan has expired)/.test(error?.message || '')) return error.message;
  return fallback;
}
