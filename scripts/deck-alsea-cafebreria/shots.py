import json, os, subprocess, sys, time, base64, urllib.request, websocket
HERE=os.path.dirname(os.path.abspath(__file__)); PORT=9333
CH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
prof=os.path.join(HERE,'chrome-prof')
p=subprocess.Popen([CH,'--headless=new',f'--remote-debugging-port={PORT}',f'--user-data-dir={prof}','--window-size=1440,900','--hide-scrollbars','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
for _ in range(50):
    try: tabs=json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json')); break
    except Exception: time.sleep(0.2)
n=0
def call(m,params=None):
    global n
    for attempt in range(3):
        try:
            t=next(t for t in json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json')) if t['type']=='page')
            ws=websocket.create_connection(t['webSocketDebuggerUrl'],suppress_origin=True,timeout=60)
            n+=1; ws.send(json.dumps({'id':n,'method':m,'params':params or {}}))
            while True:
                r=json.loads(ws.recv())
                if r.get('id')==n: ws.close(); return r.get('result',{})
        except Exception as e:
            print('retry',m,e); time.sleep(1)
    return {}
def js(e): return call('Runtime.evaluate',{'expression':e,'awaitPromise':True,'returnByValue':True}).get('result',{}).get('value')
for lang in ('es','en'):
    call('Page.navigate',{'url':f'http://127.0.0.1:8791/presentaciones/alsea-cafebreria-circuito/presentacion?lang={lang}'}); time.sleep(4)
    keys=js("[...document.querySelectorAll('section.slide')].map(s=>s.dataset.slideKey||s.dataset.blockId)")
    print(lang,len(keys),keys)
    txt=js("document.body.innerText")
    import re; print(lang,'residual:',re.findall(r'(?i)xtanco|estanco|\bjti\b|tobacco|starbucks|domino',txt))
    for i,k in enumerate(keys):
        js(f"(()=>{{document.documentElement.style.scrollBehavior='auto';const s=document.querySelectorAll('section.slide')[{i}];s.querySelectorAll('img[loading=lazy]').forEach(im=>im.loading='eager');window.scrollTo(0,s.offsetTop);return 1}})()"); time.sleep(0.9)
        img=call('Page.captureScreenshot',{'format':'png'})['data']
        open(os.path.join(HERE,'shots',f'{lang}-{i+1:02d}-{k}.png'),'wb').write(base64.b64decode(img))
    loaded=js("[...document.querySelectorAll('img[data-slide-media-element]')].map(i=>i.complete&&i.naturalWidth)")
    print(lang,'img naturalWidth',loaded)
p.terminate()
