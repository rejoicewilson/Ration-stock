// Capture the browser event at module load, before React mounts or auth finishes.
const standaloneMedia = window.matchMedia('(display-mode: standalone)');
let state = { prompt: null, installed: standaloneMedia.matches || navigator.standalone === true };
const listeners = new Set();
function publish(next) {
  state = { ...state, ...next };
  listeners.forEach(listener => listener());
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  publish({ prompt: event });
});
window.addEventListener('appinstalled', () => publish({ installed: true, prompt: null }));
standaloneMedia.addEventListener?.('change', event => {
  if (event.matches) publish({ installed: true, prompt: null });
});
export const getInstallState = () => state;
export const subscribeInstall = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function takeInstallPrompt() {
  const prompt = state.prompt;
  publish({ prompt: null }); // A captured event can only be used once.
  return prompt;
}
