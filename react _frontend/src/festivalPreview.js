// Production follows the manual selection only, never a URL parameter or date.
export function festivalForHome(search, development, activeFestival = null) {
  const supported = ['christmas', 'navratri'];
  if (development) {
    const preview = new URLSearchParams(search).get('festival-preview');
    if (preview === 'none') return null;
    if (supported.includes(preview)) return preview;
  }
  return supported.includes(activeFestival) ? activeFestival : null;
}
