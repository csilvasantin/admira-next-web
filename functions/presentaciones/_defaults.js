export const DEFAULT_PRESENTATION_PASSWORD = 'AdmiraNeXT;)';

export function ensureHttpsUrl(value, max = 500){
  const cleaned = String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim();
  if (!cleaned) return '';
  if (/^https:\/\//i.test(cleaned)) return cleaned.slice(0, max);
  if (/^http:\/\//i.test(cleaned)) return `https://${cleaned.slice(7)}`.slice(0, max);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)) return cleaned.slice(0, max);
  return `https://${cleaned.replace(/^\/+/, '')}`.slice(0, max);
}
