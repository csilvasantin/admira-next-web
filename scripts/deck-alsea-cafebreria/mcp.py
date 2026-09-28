#!/usr/bin/env python3
"""Cliente mínimo del MCP del Generador (JSON-RPC). Nunca imprime el token ni contraseñas:
cualquier campo 'password' / 'Pass:' se redacta y se guarda en secret-passwords.json (0600)."""
import json, os, re, subprocess, sys, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
_TOK = None
def token():
    global _TOK
    if _TOK is None:
        _TOK = subprocess.run(['bash', os.path.expanduser('~/Claude/admira-vault/vault-get.sh'), 'ADMIRANEXT_MCP_TOKEN_CARLOS'], capture_output=True, text=True).stdout.strip()
    return _TOK
def _stash(slug, pw):
    path = os.path.join(HERE, 'secret-passwords.json')
    data = json.load(open(path)) if os.path.exists(path) else {}
    data[slug] = pw
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f: json.dump(data, f)
def redact(obj, slug_hint=''):
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k.lower() == 'password' and isinstance(v, str) and v:
                _stash(obj.get('slug') or slug_hint, v); out[k] = '«redactada»'
            else: out[k] = redact(v, obj.get('slug') or slug_hint)
        return out
    if isinstance(obj, list): return [redact(x, slug_hint) for x in obj]
    if isinstance(obj, str):
        m = re.search(r'Pass: (\S+)', obj)
        if m and m.group(1) not in ('(conservada)',):
            _stash(slug_hint or 'unknown', m.group(1)); obj = obj.replace(m.group(1), '«redactada»')
        # texto JSON anidado
        if obj.startswith('{') and '"password"' in obj:
            try: return json.dumps(redact(json.loads(obj), slug_hint), ensure_ascii=False)
            except Exception: pass
    return obj
def call(name, args=None):
    body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call', 'params': {'name': name, 'arguments': args or {}}}).encode()
    req = urllib.request.Request('https://www.admiranext.com/mcp', data=body, method='POST', headers={
        'Authorization': 'Bearer ' + token(), 'content-type': 'application/json', 'accept': 'application/json, text/event-stream', 'user-agent': 'Mozilla/5.0 subNeo'})
    raw = urllib.request.urlopen(req, timeout=180).read().decode()
    if raw.startswith('event:') or '\ndata:' in raw:
        raw = '\n'.join(l[5:].strip() for l in raw.splitlines() if l.startswith('data:'))
    res = json.loads(raw)
    return redact(res, (args or {}).get('slug') or (args or {}).get('client') or '')
def api(method, path, body=None, headers=None):
    h = {'Authorization': 'Bearer ' + token(), 'user-agent': 'Mozilla/5.0 subNeo', 'accept': 'application/json'}
    h.update(headers or {})
    data = None
    if body is not None:
        if isinstance(body, (bytes, bytearray)): data = body
        else: data = json.dumps(body).encode(); h['content-type'] = 'application/json'
    req = urllib.request.Request('https://www.admiranext.com' + path, data=data, method=method, headers=h)
    try:
        r = urllib.request.urlopen(req, timeout=120); return r.status, r.read()
    except urllib.error.HTTPError as e: return e.code, e.read()
def text_of(res):
    try: return '\n'.join(c.get('text', '') for c in res['result']['content'])
    except Exception: return json.dumps(res, ensure_ascii=False)
if __name__ == '__main__':
    name = sys.argv[1]; args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    print(text_of(call(name, args)))
