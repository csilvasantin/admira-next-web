import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { aEsquema, validar } from './admira-demo.mjs';
import { APP, RECORRIDOS } from './recorridos-nativos.mjs';

const dir = new URL('./v2/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const site of ['biz', 'store', 'studio']) {
  const raw = JSON.parse(readFileSync(new URL('./' + site + '.subdemos.json', import.meta.url), 'utf8'));
  const demo = aEsquema(raw, RECORRIDOS[site]);
  writeFileSync(new URL('./v2/' + site + '.json', import.meta.url), JSON.stringify(demo, null, 2) + '\n');
}
writeFileSync(new URL('./v2/app.json', import.meta.url), JSON.stringify(validar(APP), null, 2) + '\n');
console.log('v2 biz store studio app');
