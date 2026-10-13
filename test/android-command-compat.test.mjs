import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAndroid,runAndroid} from '../suite/demo-android.mjs';
test('Android retains device and playlist selection and launches the active project contract',async()=>{
  assert.equal(parseAndroid('/demo android Fold8 #starbucks').device,'fold');
  assert.equal(parseAndroid('/demo android watch "Alsea"').selector.name,'Alsea');
  assert.throws(()=>parseAndroid('/demo android watch iphone'),/Elige/);
  let assigned;
  const root={location:{href:'https://admira.app/retailer?project=starbucks',assign:url=>assigned=url},document:{querySelector:()=>null}};
  await runAndroid('/demo android watch #starbucks',root);
  const url=new URL(assigned);assert.equal(url.protocol,'admira-android-demo:');
  const data=JSON.parse(Buffer.from(url.searchParams.get('request'),'base64url').toString());
  assert.equal(data.project,'starbucks');assert.equal(data.origin,'https://admira.app');assert.equal(data.device,'watch');
  assert.deepEqual(data.selector,{kind:'tags',tags:['starbucks']});
  assigned=null;root.location.href='https://admira.app/retailer';
  await assert.rejects(()=>runAndroid('/demo android',root),/Selecciona primero/);assert.equal(assigned,null);
});
