#!/usr/bin/env python3
"""Call the existing AdmiraNeXT presentation MCP without a human browser session.
Credentials are resolved from the fleet vault on each call, never stored here.
The full response is written only to a private local file; stdout is a summary.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request


def call_tool(name, arguments):
    getter = Path(os.environ.get('ADMIRA_VAULT_GETTER', str(Path.home() / 'Claude/admira-vault/vault-get.sh')))
    secret_name = os.environ.get('ADMIRA_PRESENTATIONS_SECRET', 'ADMIRANEXT_MCP_TOKEN_CARLOS')
    result = subprocess.run(['bash', str(getter), secret_name], capture_output=True, text=True, timeout=20)
    token = result.stdout.strip() if result.returncode == 0 else ''
    if not token or not token.startswith('anmcp_'):
        raise RuntimeError('Presentation MCP credential is unavailable in the fleet vault')
    request = urllib.request.Request('https://www.admiranext.com/mcp',
        data=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':name,'arguments':arguments}}).encode(),
        headers={'Content-Type':'application/json','Accept':'application/json',
                 'Authorization':'Bearer '+token,'User-Agent':'Mozilla/5.0 ADmiraNeXT-Presentations-Agent/1.0'})
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            data = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError('Presentation MCP HTTP '+str(error.code)) from None
    if data.get('error'):
        raise RuntimeError(str(data['error'].get('message','MCP error')).replace(token,'[redacted]'))
    result = data.get('result', {})
    if result.get('isError'):
        message = next((x.get('text','') for x in result.get('content',[]) if x.get('type')=='text'), 'MCP tool failed')
        raise RuntimeError(message.replace(token,'[redacted]'))
    for item in result.get('content',[]):
        if item.get('type') == 'text':
            try:
                return json.loads(item['text'])
            except (TypeError, json.JSONDecodeError):
                return {'text':item['text']}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tool')
    parser.add_argument('--params-file', type=Path)
    parser.add_argument('--out', required=True, type=Path, help='Private response file (mode 0600)')
    args = parser.parse_args()
    arguments = json.loads(args.params_file.read_text()) if args.params_file else {}
    result = call_tool(args.tool, arguments)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(args.out, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600)
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    print(json.dumps({'ok':True,'tool':args.tool,'response':str(args.out),'keys':list(result) if isinstance(result,dict) else []}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Error: '+str(error), file=sys.stderr)
        sys.exit(1)
