import {
  authorize, cleanClient, cleanSessionId, error, json, loadSession, pruneCommands,
  publicState, rateLimited, readJson, remoteStore, sameOrigin, saveSession, validateState
} from '../../../../../_remote.js';

export async function onRequestPut(context){
  if (!sameOrigin(context.request)) return error('forbidden_origin', 403);
  const store = remoteStore(context.env);
  const loaded = await loadSession(store, cleanClient(context.params.client), cleanSessionId(context.params.session));
  if (loaded.response) return loaded.response;
  const session = loaded.value;
  if (!await authorize(context.request, session, 'stage')) return error('unauthorized', 401);
  const parsed = await readJson(context.request);
  if (parsed.response) return parsed.response;
  const state = validateState(parsed.value);
  if (!state) return error('bad_request', 400);
  if (state.seq < session.latestStageSeq) return error('stale_seq', 409, {acceptedSeq:session.latestStageSeq});
  if (state.ackCommandSeq > session.latestRemoteSeq) return error('bad_request', 400);
  if (state.seq === session.latestStageSeq && state.ackCommandSeq <= (session.ackCommandSeq || 0)) {
    return json({ok:true,acceptedSeq:session.latestStageSeq,ackCommandSeq:session.ackCommandSeq || 0});
  }
  if (rateLimited(session, 'stage-write')) return error('rate_limited', 429, {retryAfterMs:100});
  if (state.seq > session.latestStageSeq) {
    session.latestStageSeq = state.seq;
    session.state = state;
  }
  session.ackCommandSeq = Math.max(session.ackCommandSeq || 0, state.ackCommandSeq);
  if (session.state) session.state.ackCommandSeq = session.ackCommandSeq;
  pruneCommands(session, session.ackCommandSeq);
  const failure = await saveSession(store, session);
  if (failure) return failure;
  return json({ok:true,acceptedSeq:session.latestStageSeq,ackCommandSeq:session.ackCommandSeq});
}

export async function onRequestGet(context){
  if (!sameOrigin(context.request)) return error('forbidden_origin', 403);
  const loaded = await loadSession(remoteStore(context.env), cleanClient(context.params.client), cleanSessionId(context.params.session));
  if (loaded.response) return loaded.response;
  if (!await authorize(context.request, loaded.value, 'remote')) return error('unauthorized', 401);
  return json({state:publicState(loaded.value.state),expiresAt:loaded.value.expiresAt,revoked:false});
}
