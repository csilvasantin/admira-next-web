import {normalizePresite, presiteKey, renderPresite} from '../../presites/_presite.js';
import {normalizePresiteOpening, presentationDeckUrl} from '../_presite-opening.js';

function redirect(destination, reason) {
  return new Response(null, {
    status: 302,
    headers: {
      location: destination,
      'cache-control': 'no-store',
      'x-presite-status': reason
    }
  });
}

export async function onRequestGet(context) {
  const client = String(context.params.client || '').trim().toLowerCase();
  const deckUrl = presentationDeckUrl(client);
  if (!deckUrl || !context.env.PRESENTATION_IDEAS) return context.next();
  const presentation = await context.env.PRESENTATION_IDEAS.get(`presentation:${client}`, {type: 'json'});
  if (!presentation) return context.next();

  let opening;
  try {
    opening = normalizePresiteOpening(presentation.presite);
  } catch (_) {
    return redirect(deckUrl, 'invalid');
  }
  if (!opening) return redirect(deckUrl, 'disabled');

  const stored = await context.env.PRESENTATION_IDEAS.get(presiteKey(opening.slug), {type: 'json'});
  if (!stored) return redirect(deckUrl, 'missing');
  const site = normalizePresite({
    ...stored,
    destination: {type: 'presentation', url: deckUrl}
  }, stored);
  return new Response(renderPresite(site), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; media-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
    }
  });
}
