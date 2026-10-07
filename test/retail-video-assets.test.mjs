import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {VIDEOS_RETAIL} from '../subdemos/retail-videos.mjs';
const manifest=JSON.parse(readFileSync(new URL('../assets/demos/suite-v1/manifest.json',import.meta.url)));
test('fifteen distinct public prepared reels match their shipped hashes, posters and reusable metadata',()=>{
 assert.equal(manifest.version,1);assert.equal(manifest.clips.length,15);assert.equal(Object.keys(VIDEOS_RETAIL).length,15);const hashes=new Set();
 for(const clip of manifest.clips){const key=clip.key.replace('-','/'),definition=VIDEOS_RETAIL[key];assert.ok(definition,'unknown clip '+clip.key);const bytes=readFileSync(new URL('../assets/demos/suite-v1/'+clip.key+'.mp4',import.meta.url)),poster=readFileSync(new URL('../assets/demos/suite-v1/'+clip.key+'.jpg',import.meta.url));assert.equal(bytes.length,clip.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),clip.sha256);hashes.add(clip.sha256);assert.equal(definition.duracion,clip.duracion);assert.equal(definition.url,clip.url);assert.equal(definition.audio,true);assert.equal(definition.fuente,'ensayo-local');assert.equal(definition.idioma,'es');assert.match(definition.poster,/^https:\/\/www\.admiranext\.com\/assets\/demos\/suite-v1\/[a-z-]+\.jpg$/);assert.ok(clip.duracion>0&&clip.duracion<=300);assert.ok(clip.streams.some(s=>s.codec_type==='video'&&s.codec_name==='h264'&&s.width===1280&&s.height===720));assert.ok(clip.streams.some(s=>s.codec_type==='audio'&&s.codec_name==='aac'));assert.deepEqual([...poster.subarray(0,3)],[255,216,255]);}
 assert.equal(hashes.size,15,'every function has its own distinct reel');
});
