(function (G, d) {
  'use strict';

  // Robot limpiador (Roborock con cámara y brazo) en lugar de Luka.
  // Un "driver" mueve el robot; hoy el simulado, mañana el puente del Roborock real.
  // Contrato de driver: goTo(point,{from}) · stop() · onPose(fn(pose)) · onArrive(fn(pose)) · cameraURL() opcional.
  var SPEED=0.3, TICK=250, ARRIVE_M=0.3;

  function metres(a, b) {
    var rad=Math.PI/180, x=(b.lat-a.lat)*rad, y=(b.lng-a.lng)*rad;
    var h=Math.sin(x/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(y/2)**2;
    return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
  }
  // Rumbo en grados (0 = norte, 90 = este).
  function heading(a, b) {
    var rad=Math.PI/180, y=Math.sin((b.lng-a.lng)*rad)*Math.cos(b.lat*rad);
    var x=Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos((b.lng-a.lng)*rad);
    return (Math.atan2(y,x)/rad+360)%360;
  }

  // Calibración mapa ↔ plano del robot (mm) con dos puntos de referencia:
  // semejanza (giro + escala + traslación) y espejo opcional, porque el eje Y del plano
  // Roborock puede ir al revés que el norte.
  function calibrate(pairs, mirror) {
    if (!Array.isArray(pairs)||pairs.length<2) throw new Error('calibracion_incompleta');
    var o=pairs[0].geo, k=Math.cos(o.lat*Math.PI/180)*111320, s=mirror?-1:1;
    function local(p) {return [(p.lng-o.lng)*k,s*(p.lat-o.lat)*110540];}
    var g0=local(pairs[0].geo), g1=local(pairs[1].geo), r0=pairs[0].robot, r1=pairs[1].robot;
    var gx=g1[0]-g0[0], gy=g1[1]-g0[1], rx=r1.x-r0.x, ry=r1.y-r0.y, n=gx*gx+gy*gy;
    if (!n) throw new Error('calibracion_degenerada');
    // a = (r1-r0)/(g1-g0) en complejos.
    var ar=(rx*gx+ry*gy)/n, ai=(ry*gx-rx*gy)/n, br=r0.x-(ar*g0[0]-ai*g0[1]), bi=r0.y-(ar*g0[1]+ai*g0[0]), m=ar*ar+ai*ai;
    return {
      toRobot:function (p) {var g=local(p);return {x:ar*g[0]-ai*g[1]+br,y:ar*g[1]+ai*g[0]+bi};},
      toMap:function (r) {var x=r.x-br, y=r.y-bi, gx2=(ar*x+ai*y)/m, gy2=(ar*y-ai*x)/m;return {lat:o.lat+s*gy2/110540,lng:o.lng+gx2/k};}
    };
  }

  // Robot simulado: avanza en línea recta (el real planifica su propia ruta) a 0,3 m/s × multiplicador.
  function createSimDriver(options) {
    var o=options||{}, setT=o.setTimeout||G.setTimeout.bind(G), clearT=o.clearTimeout||G.clearTimeout.bind(G);
    var poseFn=null, arriveFn=null, timer=null, drive=null;
    function speed() {return SPEED*(o.multiplier?o.multiplier():1);}
    function step() {
      timer=setT(function () {
        timer=null;if (!drive) return;
        drive.done=Math.min(drive.dist,drive.done+speed()*TICK/1000);
        var k=drive.dist?drive.done/drive.dist:1, a=drive.from, b=drive.to;
        var pose={lat:a.lat+(b.lat-a.lat)*k,lng:a.lng+(b.lng-a.lng)*k,heading:drive.heading,remaining:drive.dist-drive.done};
        if (poseFn) poseFn(pose);
        if (drive.dist-drive.done<=0) {drive=null;if (arriveFn) arriveFn(pose);return;}
        step();
      },TICK);
    }
    return {
      kind:'simulado',
      goTo:function (point,opts) {
        var from=opts&&opts.from;stopDrive();
        if (!from) {var p={lat:point.lat,lng:point.lng,heading:0,remaining:0};if (poseFn) poseFn(p);if (arriveFn) arriveFn(p);return;}
        drive={from:{lat:from.lat,lng:from.lng},to:{lat:point.lat,lng:point.lng},done:0,dist:metres(from,point),heading:heading(from,point)};
        step();
      },
      stop:stopDrive,
      onPose:function (fn) {poseFn=fn;},
      onArrive:function (fn) {arriveFn=fn;},
      cameraURL:function () {return null;}
    };
    function stopDrive() {if (timer) clearT(timer);timer=null;drive=null;}
  }

  // Roborock real a través de un puente en la red local (python-roborock / Home Assistant).
  // Contrato HTTP del puente (ver README): POST {base}/goto {x,y} · POST {base}/stop ·
  // GET {base}/pose → {x,y,heading?,state} · GET {base}/camera.mjpg (opcional).
  function createRoborockDriver(options) {
    var o=options||{}, base=String(o.base||'').replace(/\/$/,''), cal=o.calibration, fetcher=o.fetch||G.fetch.bind(G);
    var setI=o.setInterval||G.setInterval.bind(G), clearI=o.clearInterval||G.clearInterval.bind(G);
    if (!/^https?:\/\//.test(base)) throw new Error('puente_invalido');
    if (!cal||!cal.toRobot) throw new Error('calibracion_incompleta');
    var poseFn=null, arriveFn=null, poll=null, target=null;
    function post(path,body) {return fetcher(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});}
    function readPose() {
      return fetcher(base+'/pose').then(function (r) {return r.json();}).then(function (raw) {
        if (!raw||!Number.isFinite(raw.x)||!Number.isFinite(raw.y)) return;
        var p=cal.toMap(raw), pose={lat:p.lat,lng:p.lng,heading:Number.isFinite(raw.heading)?raw.heading:0,remaining:target?metres(p,target):0,state:raw.state};
        if (poseFn) poseFn(pose);
        if (target&&pose.remaining<=Math.max(ARRIVE_M,o.arriveMetres||0.5)) {target=null;clearI(poll);poll=null;if (arriveFn) arriveFn(pose);}
      }).catch(function () {});
    }
    return {
      kind:'roborock',
      goTo:function (point) {
        var r=cal.toRobot(point);target={lat:point.lat,lng:point.lng};
        if (!poll) poll=setI(readPose,o.pollMs||1000);
        return post('/goto',{x:Math.round(r.x),y:Math.round(r.y)});
      },
      stop:function () {target=null;if (poll) clearI(poll);poll=null;return post('/stop');},
      onPose:function (fn) {poseFn=fn;},
      onArrive:function (fn) {arriveFn=fn;},
      cameraURL:function () {return o.camera===false?null:base+'/camera.mjpg';},
      readPose:readPose
    };
  }

  // Robot real: guarda en localStorage 'admiranext:mapa:robot' {base,pairs:[{geo,robot},{geo,robot}],mirror}.
  // Sin configuración válida, el robot es el simulado.
  function driverFromConfig(storage) {
    try {
      var raw=(storage||G.localStorage).getItem('admiranext:mapa:robot');if (!raw) return null;
      var c=JSON.parse(raw);
      return createRoborockDriver({base:c.base,calibration:calibrate(c.pairs,!!c.mirror),camera:c.camera});
    } catch (e) {return null;}
  }

  // Controlador: recibe destinos del mapa o de la barra de Xperiencias y pinta la cámara.
  function create(options) {
    var sim=options.sim, host=options.host, T=options.T||function (es) {return es;};
    var driver=options.driver||createSimDriver({multiplier:function () {return sim.state().speedMult||1;}});
    var status='idle', destination=null, pose=null, armUp=0, raf=null, canvas=null, img=null;
    driver.onPose(function (p) {pose=p;sim.place({lat:p.lat,lng:p.lng});render();});
    driver.onArrive(function (p) {pose=p;status='arrived';armUp=1;sim.place({lat:p.lat,lng:p.lng});render();});
    function goTo(point,name) {
      var s=sim.state();
      destination={lat:point.lat,lng:point.lng,name:name||''};status='driving';
      driver.goTo(destination,{from:s.position});render();
    }
    function cancel() {if (status==='driving') {driver.stop();status='stopped';render();}}
    function info() {
      var s=sim.state(), w=s.walk;
      var driving=status==='driving'||!!w, target=w?{name:w.to.name,remaining:w.remaining}:destination?{name:destination.name,remaining:pose?pose.remaining:0}:null;
      return {status:w?'driving':status,driving:driving,target:target,zone:s.zone,heading:pose?pose.heading:0,driver:driver.kind};
    }
    function caption() {
      var i=info(), name=i.target&&i.target.name||T('punto marcado','marked point');
      if (i.status==='driving') return '🤖 '+T('Rumbo a ','Heading to ')+name+' · '+Math.max(0,Math.round(i.target.remaining||0))+' m';
      if (i.status==='arrived') return '✓ '+T('Llegada','Arrived')+' · '+(i.zone&&i.zone.name||T('fuera de las zonas','outside the zones'))+(i.zone?' · '+i.zone.label:'');
      if (i.status==='stopped') return T('Robot detenido','Robot stopped');
      return T('Marca un destino en el mapa o elige una Xperiencia','Mark a destination on the map or pick an Xperiencia');
    }
    function draw() {
      raf=null;if (!canvas||!canvas.getContext) return;
      var c=canvas.getContext('2d');if (!c) return;
      var W=canvas.width, H=canvas.height, i=info(), t=Date.now()/1000, hz=H*0.42;
      c.fillStyle='#1b2230';c.fillRect(0,0,W,hz);
      c.fillStyle='#2a2f38';c.fillRect(0,hz,W,H-hz);
      // Suelo en perspectiva: las líneas avanzan mientras el robot se mueve.
      c.strokeStyle='rgba(99,230,213,.35)';c.lineWidth=1;
      var off=i.driving?(t*1.6)%1:0;
      for (var r=0;r<10;r++) {var z=(r+off)/10, y=hz+(H-hz)*z*z;c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
      for (var v=-6;v<=6;v++) {c.beginPath();c.moveTo(W/2+v*W*0.02,hz);c.lineTo(W/2+v*W*0.25,H);c.stroke();}
      // Pantalla de la Xperiencia destino: crece al acercarse.
      var rem=i.target?Math.max(0,i.target.remaining||0):0, near=i.status==='arrived'?1:i.target?Math.max(0.08,1-Math.min(1,rem/60)):0;
      if (near) {
        var sw=W*0.55*near, sh=sw*9/16, sx=W/2-sw/2, sy=hz-sh*0.75;
        c.fillStyle='#0c0f14';c.fillRect(sx-4,sy-4,sw+8,sh+8);
        c.fillStyle=i.status==='arrived'?'#bc85ec':'#3b4252';c.fillRect(sx,sy,sw,sh);
        c.fillStyle='#fff';c.font=Math.max(10,Math.round(sw/14))+'px system-ui,sans-serif';c.textAlign='center';
        c.fillText(i.status==='arrived'&&i.zone?i.zone.label:(i.target&&i.target.name||''),W/2,sy+sh/2+4);
      }
      // Brazo articulado: dos segmentos, se levanta al llegar.
      if (i.status==='arrived') armUp=Math.max(0,armUp-0.01);
      var lift=i.status==='arrived'?0.5+0.5*Math.sin(t*3)*armUp:0, bx=W*0.82, by=H;
      var ex=bx-W*0.08, ey=H-H*(0.25+0.2*lift), hx=ex-W*0.06, hy=ey-H*(0.08+0.25*lift);
      c.strokeStyle='#d8dee9';c.lineCap='round';c.lineWidth=Math.max(6,W*0.025);
      c.beginPath();c.moveTo(bx,by);c.lineTo(ex,ey);c.lineTo(hx,hy);c.stroke();
      c.fillStyle='#63e6d5';c.beginPath();c.arc(hx,hy,Math.max(4,W*0.015),0,Math.PI*2);c.fill();
      // HUD.
      c.textAlign='left';c.fillStyle='rgba(0,0,0,.55)';c.fillRect(0,0,W,22);
      c.fillStyle='#ff5c5c';c.beginPath();c.arc(12,11,4,0,Math.PI*2);c.fill();
      c.fillStyle='#fff';c.font='12px ui-monospace,monospace';
      c.fillText('CAM · '+(i.driver==='roborock'?'Roborock':T('simulada','simulated'))+' · '+Math.round(i.heading)+'°',22,15);
      if (i.driving||i.status==='arrived') raf=G.requestAnimationFrame?G.requestAnimationFrame(draw):null;
    }
    function render() {
      if (!host) return;
      var on=!!sim.state().robot;
      host.hidden=!on;
      var label=d.getElementById('robot-camara-estado');
      if (label) label.textContent=on?caption():'';
      if (!on) return;
      var url=driver.cameraURL&&driver.cameraURL();
      if (url&&!img) {img=d.createElement('img');img.alt=T('Cámara del robot','Robot camera');img.src=url;host.appendChild(img);}
      if (!url&&!canvas) {canvas=d.createElement('canvas');canvas.width=320;canvas.height=180;canvas.setAttribute('aria-label',T('Cámara del robot (simulada)','Robot camera (simulated)'));host.insertBefore?host.insertBefore(canvas,host.firstChild):host.appendChild(canvas);}
      if (canvas&&!raf) draw();
    }
    return {goTo:goTo,cancel:cancel,render:render,info:info,caption:caption};
  }

  G.AdmiraMapaRobot={create:create,createSimDriver:createSimDriver,createRoborockDriver:createRoborockDriver,driverFromConfig:driverFromConfig,calibrate:calibrate,heading:heading,metres:metres,SPEED:SPEED};
})(window,document);
