import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIOS,projectContext,runIOS} from '../suite/demo-ios.mjs';
test('native command variants and tags',()=>{
 assert.equal(parseIOS('/demo ios').device,'both');
 assert.equal(parseIOS('/demo ios iphone').device,'iphone');
 assert.deepEqual(parseIOS('/demo ios watch #música').selector,{kind:'tags',tags:['música']});
 assert.equal(parseIOS('/demo ios "Mi playlist"').selector.name,'Mi playlist');
 assert.throws(()=>parseIOS('/demo ios watch iphone'));
});
test('requires the active project and supports a site context provider',()=>{
 assert.throws(()=>projectContext({location:{href:'https://admira.biz/'},document:{querySelector:()=>null}}));
 assert.equal(projectContext({location:{href:'https://admira.studio/?proyecto=demo'},document:{querySelector:()=>null}}).project,'demo');
 assert.equal(projectContext({location:{href:'https://admira.app/'},document:{querySelector:()=>null},AdmiraIOSDemoContext:()=>({project:'project-from-selector'})}).project,'project-from-selector');
});
test('five suite origins send only declarative data to the same launcher',async()=>{
 for(const host of ['admira.studio','admira.store','admira.tv','admira.app','admira.biz']){
  let launched;
  await runIOS('/demo ios watch #musica',{location:{href:`https://${host}/?project=p`,assign:u=>launched=u},document:{querySelector:()=>null}});
  const url=new URL(launched);const data=JSON.parse(Buffer.from(url.searchParams.get('request'),'base64url'));
  assert.equal(data.origin,`https://${host}`);assert.equal(data.device,'watch');assert.equal(data.project,'p');assert.equal(url.protocol,'admira-ios-demo:');
 }
});
