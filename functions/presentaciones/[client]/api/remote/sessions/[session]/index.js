import {
  authorize, cleanClient, cleanSessionId, error, loadSession, remoteStore,
  sameOrigin, saveSession
} from '../../../../../_remote.js';

export async function onRequestDelete(context){
  if (!sameOrigin(context.request)) return error('forbidden_origin', 403);
  const store = remoteStore(context.env);
  const loaded = await loadSession(store, cleanClient(context.params.client), cleanSessionId(context.params.session));
  if (loaded.response) return loaded.response;
  const session = loaded.value;
  if (!await authorize(context.request, session, 'stage')) return error('unauthorized', 401);
  session.revoked = true;
  session.revokedAt = Date.now();
  session.pairingSecretHash = '';
  session.stageTokenHash = '';
  session.remoteTokenHash = '';
  session.state = null;
  session.commands = [];
  const failure = await saveSession(store, session);
  return failure || new Response(null, {status:204,headers:{'cache-control':'no-store'}});
}
