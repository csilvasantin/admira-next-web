import {
  cleanClient, error, hashSecret, json, onlyKeys, randomSecret, remoteStore,
  sameOrigin, saveSession, sessionTtl
} from '../../../../_remote.js';

export async function onRequestPost(context){
  if (!sameOrigin(context.request)) return error('forbidden_origin', 403);
  const store = remoteStore(context.env);
  if (!store) return error('storage_unavailable', 503);
  let body = {};
  try {
    const text = await context.request.text();
    if (new TextEncoder().encode(text).byteLength > 4096) return error('too_large', 413);
    if (text.trim()) body = JSON.parse(text);
  } catch (_) { return error('bad_request', 400); }
  if (!body || Array.isArray(body) || typeof body !== 'object' || !onlyKeys(body, ['ttlSeconds'])) return error('bad_request', 400);
  const client = cleanClient(context.params.client);
  if (!client) return error('not_found', 404);
  const ttlSeconds = sessionTtl(body.ttlSeconds);
  if (ttlSeconds === null) return error('bad_request', 400);
  const now = Date.now();
  const sessionId = randomSecret(16);
  const pairingSecret = randomSecret(24);
  const stageToken = randomSecret(32);
  const value = {
    schema:1,
    id:sessionId,
    client,
    createdAt:now,
    expiresAt:now + ttlSeconds * 1000,
    revoked:false,
    pairingSecretHash:await hashSecret(pairingSecret),
    stageTokenHash:await hashSecret(stageToken),
    remoteTokenHash:'',
    pairedAt:0,
    pairAttempts:0,
    state:null,
    latestStageSeq:0,
    latestRemoteSeq:0,
    ackCommandSeq:0,
    commands:[],
    rate:{}
  };
  const failure = await saveSession(store, value);
  if (failure) return failure;
  return json({sessionId,pairingSecret,stageToken,expiresAt:value.expiresAt,pollAfterMs:750}, 201);
}
