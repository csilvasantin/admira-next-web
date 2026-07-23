const PRESITE_SLUG = /^[a-z0-9][a-z0-9-]{1,63}$/;

function cleanSlug(value) {
  const slug = String(value == null ? '' : value).trim().toLowerCase();
  return PRESITE_SLUG.test(slug) ? slug : '';
}

export function normalizePresiteOpening(value, existing = null) {
  const source = value === undefined ? existing : value;
  if (source == null || source === false || source?.enabled === false) return null;
  const slug = cleanSlug(typeof source === 'string' ? source : source?.slug);
  if (!slug) throw new TypeError('Selecciona un Presite válido o desactiva la apertura.');
  return {schemaVersion: 1, enabled: true, slug};
}

export function presiteOpeningInput(raw = {}, existing = null) {
  if (Object.prototype.hasOwnProperty.call(raw, 'presite')) {
    return normalizePresiteOpening(raw.presite, existing);
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'presiteSlug')) {
    return normalizePresiteOpening(raw.presiteSlug || null, existing);
  }
  return normalizePresiteOpening(undefined, existing);
}

export function presentationDeckUrl(client) {
  const slug = cleanSlug(client);
  return slug ? `/presentaciones/${slug}/presentacion` : '';
}

export function presentationLaunchUrl(client) {
  const slug = cleanSlug(client);
  return slug ? `/presentaciones/${slug}/open` : '';
}

export function publicPresiteOpening(opening, client) {
  let normalized;
  try {
    normalized = normalizePresiteOpening(opening);
  } catch (_) {
    return null;
  }
  if (!normalized) return null;
  return {
    slug: normalized.slug,
    launchUrl: presentationLaunchUrl(client),
    deckUrl: presentationDeckUrl(client),
    skipIntro: true,
    transition: 'seamless'
  };
}
