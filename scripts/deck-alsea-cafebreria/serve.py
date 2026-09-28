import http.server, os, re, sys
HERE=os.path.dirname(os.path.abspath(__file__)); REPO='/Users/csilvasantin/Claude/admira-next-web'
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_GET(self):
        p=self.path.split('?')[0]
        m=re.match(r'^/presentaciones/([a-z0-9-]+)/(presentacion|media/(.+)|brand/logo)$',p)
        if m and m.group(2)=='presentacion': f=os.path.join(HERE,'out','sala.html'); ct='text/html; charset=utf-8'
        elif m and m.group(3): f=os.path.join(HERE,'live',m.group(3)); ct='image/png'
        elif m: f=os.path.join(HERE,'live','logo.svg'); ct='image/svg+xml'
        elif p.startswith('/assets/'): f=REPO+p; ct='text/css' if p.endswith('.css') else 'application/javascript' if p.endswith('.js') else 'application/octet-stream'
        else: f=None
        if not f or not os.path.exists(f): self.send_response(404); self.send_header('content-type','application/json'); self.end_headers(); self.wfile.write(b'{}'); return
        b=open(f,'rb').read(); self.send_response(200); self.send_header('content-type',ct); self.send_header('content-length',str(len(b))); self.end_headers(); self.wfile.write(b)
http.server.ThreadingHTTPServer(('127.0.0.1',8791),H).serve_forever()
