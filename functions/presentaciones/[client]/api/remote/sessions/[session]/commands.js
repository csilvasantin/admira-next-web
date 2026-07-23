import {
  appendCommand, authorize, cleanClient, cleanSessionId, error, json, loadSession,
  rateLimited, readJson, remoteStore, sameOrigin, saveSession, validateCommand
} from '../../../../../_remote.js';

export async function onRequestPost(context){
  if (!sameOrigin(context.request)) return error('forbidden_origin', 403);
  const store = remoteStore(context.env);
  const loaded = await loadSession(store, cleanClient(context.params.client), cleanSessionId(context.params.session));
  if (loaded.response) return loaded.response;
  const session = loaded.value;
  if (!await authorize(context.request, session, 'remote')) return error('unauthorized', 401);
  const parsed = await readJson(context.request);
  if (parsed.response) return parsed.response;
  const command = validateCommand(parsed.value);
  if (!command) return error('bad_request', 400);
  if (command.seq < session.latestRemoteSeq) return error('stale_seq', 409, {acceptedSeq:session.latestRemoteSeq});
  if (command.seq === session.latestRemoteSeq) {
    return json({ok:true,acceptedSeq:session.latestRemoteSeq,ackCommandSeq:session.ackCommandSeq || 0}, 202);
  }
  if (rateLimited(session, 'remote-write')) return error('rate_limited', 429, {retryAfterMs:100});
  session.latestRemoteSeq = command.seq;
  appendCommand(session, command);
  const failure = await saveSession(store, session);
  if (failure) return failure;
  return json({ok:true,acceptedSeq:session.latestRemoteSeq,ackCommandSeq:session.ackCommandSeq || 0}, 202);
}

export async function onRequestGet(context){
  if (!sameOrigin(context.request)) return error('forbidden_origin', 403);
  const loaded = await loadSession(remoteStore(context.env), cleanClient(context.params.client), cleanSessionId(context.params.session));
  if (loaded.response) return loaded.response;
  const session = loaded.value;
  if (!await authorize(context.request, session, 'stage')) return error('unauthorized', 401);
  const after = Number(new URL(context.request.url).searchParams.get('after') || 0);
  if (!Number.isSafeInteger(after) || after < 0) return error('bad_request', 400);
  const commands = (Array.isArray(session.commands) ? session.commands : []).filter(command => command.seq > after).slice(0, 32);
  return json({commands,latestSeq:session.latestRemoteSeq || 0,ackCommandSeq:session.ackCommandSeq || 0});
}
