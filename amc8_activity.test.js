const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(`${__dirname}/amc8_practice.html`, 'utf8');
const script = marker => html.slice(html.indexOf('<script>'+marker)+8, html.indexOf('</script>',html.indexOf('<script>'+marker)));
const context = {module:{exports:{}},Date};
vm.runInNewContext(script('/* Pure practice logic'),context);
const P = context.module.exports;

test('seven Vancouver dates are independent of device timezone and cross DST',()=>{
  const days=P.activityDays([],new Date('2026-11-03T07:00:00Z'));
  assert.deepEqual(Array.from(days,d=>d.key),['2026-11-02','2026-11-01','2026-10-31','2026-10-30','2026-10-29','2026-10-28','2026-10-27']);
  assert.ok(days.every(d=>d.total===0));
});
test('counts all checks including retries, midnight boundaries and missing time',()=>{
  const attempts=[
    {at:'2026-10-05T06:59:59Z',correct:false,seconds:40},
    {at:'2026-10-05T07:00:00Z',correct:true,review:true,seconds:20},
    {at:'2026-10-05T08:00:00Z',correct:false},
    {at:'invalid',correct:true},
    {at:'2026-10-06T08:00:00Z',correct:true},
    {at:'2026-09-01T08:00:00Z',correct:true}
  ];
  const days=P.activityDays(attempts,new Date('2026-10-05T12:00:00Z'));
  assert.equal(days[0].total,2);assert.equal(days[0].correct,1);
  assert.equal(days[0].retries,1);assert.equal(days[0].seconds,20);assert.equal(days[0].missingTime,1);
  assert.equal(days[1].total,1);
  assert.equal(P.activityDays(Array(12).fill(attempts[1]),new Date('2026-10-05T12:00:00Z'))[0].total,12);
});
function fixture(key='key'){
  let callback, errorCallback, unsubscribed=0;
  const reads=[],statuses=[],data=[],apps=[];
  const database={collection:name=>{assert.equal(name,'amc8PracticeStudents');return {doc:id=>{
    reads.push(id);return {onSnapshot:(options,next,error)=>{assert.equal(options.includeMetadataChanges,true);callback=next;errorCallback=error;return ()=>unsubscribed++;},set:()=>assert.fail('Monitor must never write')};
  }};}};
  const window={};
  const sandbox={window,URLSearchParams,location:{search:''},localStorage:{getItem:k=>k==='firebaseApiKey'?key:null,setItem:()=>assert.fail('Monitor must not change local history'),removeItem:()=>assert.fail('Monitor must not remove local history')},firebase:{firestore:()=>database,initializeApp:(config,name)=>{apps.push(name);return {firestore:()=>database};}}};
  window.firebase=sandbox.firebase;
  vm.runInNewContext(script('/* Per-student persistence'),sandbox);
  return {store:window.StudentStore,reads,statuses,data,apps,emit:s=>callback(s),error:e=>errorCallback(e),unsubscribed:()=>unsubscribed,handlers:{onStatus:(s)=>statuses.push(s),onData:d=>data.push(d)}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('observer reads Bruce without signing in or writing and handles cache and errors',async()=>{
  const f=fixture();const stop=f.store.watchActivity(' Bruce ',f.handlers);await tick();
  assert.deepEqual(f.reads,['bruce']);assert.equal(f.store.current(),'');assert.ok(f.apps[0].startsWith('amc8ActivityMonitor-'));
  f.emit({exists:true,data:()=>({state:'history'}),metadata:{fromCache:true}});
  assert.equal(f.statuses.at(-1),'cached');assert.equal(f.data[0].state,'history');
  f.emit({exists:false,metadata:{fromCache:false}});assert.equal(f.data.at(-1),null);assert.equal(f.statuses.at(-1),'synced');
  f.error({code:'permission-denied'});assert.equal(f.statuses.at(-1),'error');stop();assert.equal(f.unsubscribed(),1);
  const count=f.data.length;f.emit({exists:false,metadata:{}});assert.equal(f.data.length,count);
});
test('missing key and cancellation before SDK completion cause no reads',async()=>{
  const missing=fixture('');missing.store.watchActivity('Bruce',missing.handlers);assert.deepEqual(missing.statuses,['missing-key']);assert.deepEqual(missing.reads,[]);
  const f=fixture();f.store.watchActivity('Bruce',f.handlers)();await tick();assert.deepEqual(f.reads,[]);
});
test('inline scripts compile and daily bar caps visually without losing the count',()=>{
  for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
  assert.ok(html.includes('bar.value=Math.min(day.total,activityGoal)'));
  assert.ok(html.includes('${day.total} / ${activityGoal} answers'));
});
