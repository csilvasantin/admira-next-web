import {
  cleanClient, cleanSessionId, constantTimeEqual, error, hashSecret, json,
  loadSession, onlyKeys, randomSecret, readJson, remoteStore, sameOrigin, saveSession
} from '../../../../../_remote.js';

export async function onRequestPost(context){
  if (!sameOrigin(context.request)) return error('forbidden_origin', 403);
  const parsed = await readJson(context.request);
  if (parsed.response) return parsed.response;
  if (!onlyKeys(parsed.value, ['pairingSecret']) || !/^[A-Za-z0-9_-]{20,128}$/.test(String(parsed.value.pairingSecret || ''))) return error('bad_request', 400);
  const store = remoteStore(context.env);
  const loaded = await loadSession(store, cleanClient(context.params.client), cleanSessionId(context.params.session));
  if (loaded.response) return loaded.response;
  const session = loaded.value;
  if (session.remoteTokenHash || !session.pairingSecretHash) return error('already_paired', 409);
  session.pairAttempts = Number(session.pairAttempts || 0) + 1;
  if (session.pairAttempts > 8) {
    const failure = await saveSession(store, session);
    return failure || error('rate_limited', 429);
  }
  const suppliedHash = await hashSecret(parsed.value.pairingSecret);
  if (!constantTimeEqual(suppliedHash, session.pairingSecretHash)) {
    const failure = await saveSession(store, session);
    return failure || error('unauthorized', 401);
  }
  const remoteToken = randomSecret(32);
  session.remoteTokenHash = await hashSecret(remoteToken);
  session.pairingSecretHash = '';
  session.pairedAt = Date.now();
  const failure = await saveSession(store, session);
  if (failure) return failure;
  return json({sessionId:session.id,remoteToken,expiresAt:session.expiresAt,pollAfterMs:750});
}
