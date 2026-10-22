/*
 * Carlos, 22-10-2026: al dar acceso (y en el resto de acciones de /usuarios)
 * tiene que verse qué ha pasado. El aviso aguanta 6 s, el botón espera con
 * una ruleta, y la fila tocada se señala. Un correo vacío o inválido se dice
 * junto al campo. El token MCP en claro no viaja al aviso.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../usuarios.html', import.meta.url), 'utf8');

test('el aviso es verde o rojo, aguanta 6 s y se puede cerrar', () => {
  assert.match(source, /function notice\(t,bad=false\)/);
  assert.match(source, /el\.className='toast '\+\(bad\?'bad':'ok'\)/);
  assert.match(source, /setTimeout\(\(\)=>\{if\(el\.isConnected\)el\.remove\(\)\},6000\)/);
  assert.match(source, /x\.textContent='Cerrar'/);
  assert.match(source, /aria-label','Cerrar aviso'/);
  assert.match(source, /class="toasts"/);
  assert.match(source, /z-index:2147483600/);
  assert.match(source, /document\.body\.appendChild\(box\)/);
});

test('un correo vacío o inválido se dice junto al campo y no llama al API', () => {
  assert.match(source, /<form id="add" class="add" novalidate>/);
  assert.match(source, /<form id="tercero" class="add" novalidate>/);
  assert.match(source, /function correoDe\(v\)/);
  assert.match(source, /function errorCorreo\(form,input\)/);
  assert.match(source, /className='field-error'/);
  assert.match(source, /Escribe un correo para dar acceso\./);
  assert.match(source, /El correo no es válido\./);
  assert.match(source, /if\(!errorCorreo\(form,form\.email\)\)return;body\.project_keys/);
  assert.match(source, /if\(!errorCorreo\(form,form\.email\)\)return;const apps/);
});

test('alta, edición, suspensión y tokens desactivan el botón y marcan la fila', () => {
  assert.match(source, /function ocupado\(btn,on\)/);
  assert.match(source, /className='spin'/);
  assert.match(source, /ocupado\(btn,true\)/);
  assert.match(source, /pedirFoco\(d\.email\|\|body\.email\)/, 'el alta señala a la persona nueva');
  assert.match(source, /pedirFoco\(d\.email\)/, 'el acceso a tercero señala su fila');
  assert.match(source, /pedirFoco\(email\)/, 'cambiar el rol señala la fila');
  assert.match(source, /'Suspendido: '\+u\.email/);
  assert.match(source, /pedirFoco\(u\.email\)/);
  assert.match(source, /pedirFoco\(email,d\.id\|\|'new'\)/);
  assert.match(source, /pedirFoco\(u\.email,'tokens'\)/);
  assert.match(source, /scrollIntoView\(\{behavior:'smooth',block:'center'\}\)/);
  assert.match(source, /row-flash/);
  assert.match(source, /aplicarFoco\(\)/);
});

test('el token nuevo se enseña una vez, con copia, y el aviso no lo repite', () => {
  assert.match(source, /class="token-new"/);
  assert.match(source, /data-act="copy-token"/);
  assert.match(source, /No se vuelve a mostrar/);
  assert.match(source, /No queda en el registro ni en la auditoría/);
  assert.match(source, /function sinSecreto/);
});
