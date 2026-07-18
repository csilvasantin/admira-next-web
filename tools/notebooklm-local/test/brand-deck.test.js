import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';
import {brandPdf,brandPowerPoint} from '../brand-deck.js';
import {fallbackVisualStyle} from '../visual-brief.js';

const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../../..');
const LOGO=path.join(ROOT,'presentaciones/LaCaixa/assets/caixabank-logo.jpg');

test('the fallback visual contract keeps the client logo mandatory',()=>{
  const brief=fallbackVisualStyle({displayName:'PortAventura World',inspirationUrl:'https://zero.university'});
  assert.match(brief,/Zero University/i);assert.match(brief,/official PortAventura World logo is mandatory on every slide/i);
});

test('PDF branding overlays every page without changing the page count',async()=>{
  const source=path.join(ROOT,'presentaciones/LaCaixa/admira-caixabank-espacio-inteligente.pdf'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'admira-pdf-')),copy=path.join(dir,'deck.pdf');
  await fs.copyFile(source,copy);const before=await PDFDocument.load(await fs.readFile(copy)),output=await brandPdf(copy,LOGO),after=await PDFDocument.load(await fs.readFile(output));
  assert.equal(after.getPageCount(),before.getPageCount());assert.ok((await fs.stat(output)).size>0);
});

test('PowerPoint branding adds an official client logo to every slide',async()=>{
  const source=path.join(ROOT,'presentaciones/LaCaixa/admira-caixabank-espacio-inteligente.pptx'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'admira-pptx-')),copy=path.join(dir,'deck.pptx');
  await fs.copyFile(source,copy);const output=await brandPowerPoint(copy,LOGO),archive=await JSZip.loadAsync(await fs.readFile(output));
  const slides=Object.keys(archive.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name));assert.ok(slides.length>0);
  for(const slide of slides)assert.match(await archive.file(slide).async('string'),/Official client logo/);
  assert.ok(archive.file('ppt/media/admiranext-client-logo.png'));
});
