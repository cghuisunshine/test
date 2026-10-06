const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(`${__dirname}/amc8_practice.html`, 'utf8');
const script = marker => html.slice(html.indexOf('<script>'+marker)+8, html.indexOf('</script>',html.indexOf('<script>'+marker)));
const context = {module:{exports:{}},Date};
const activitySource=fs.readFileSync(`${__dirname}/amc8_activity.js`,'utf8');
vm.runInNewContext(activitySource,context);
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
  vm.runInNewContext(activitySource,sandbox);
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

test('weekday exclusions hide Wednesday and Saturday without extending the seven-day window',()=>{
  const now=new Date('2026-10-05T12:00:00Z');
  const attempts=[{at:'2026-10-03T19:00:00Z',correct:true},{at:'2026-10-04T19:00:00Z',correct:true}];
  const days=P.activityDays(attempts,now,[3,6]);
  assert.deepEqual(Array.from(days,d=>d.key),['2026-10-05','2026-10-04','2026-10-02','2026-10-01','2026-09-29']);
  assert.equal(days[1].total,1);
  assert.equal(P.activityDays(attempts,now).length,7);
  assert.equal(P.activityDays(attempts,now,[0,1,2,3,4,5,6]).length,0);
  assert.equal(attempts.length,2);
});
test('weekday filtering uses Vancouver dates at midnight and across daylight saving',()=>{
  const days=P.activityDays([{at:'2026-11-02T07:30:00Z',correct:true}],new Date('2026-11-02T12:00:00Z'),[0]);
  assert.ok(!days.some(d=>d.key==='2026-11-01'));
  assert.equal(days[0].key,'2026-11-02');assert.equal(days[0].total,0);
});

test('monitoring links preserve student, goal, explicit filter and connection key',()=>{
  const M=require('./amc8_activity.js');
  const url=new URL(M.shareURL('https://example.com/test/amc8_practice.html?follow=old#old',{student:'Bruce Lee',goal:15,excluded:[3,6],key:'example-key'}));
  assert.equal(url.pathname,'/test/amc8_monitor.html');assert.equal(url.searchParams.get('student'),'Bruce Lee');
  assert.equal(url.searchParams.get('goal'),'15');assert.equal(url.searchParams.get('exclude'),'3,6');
  assert.equal(url.searchParams.has('apiKey'),false);assert.equal(url.searchParams.has('follow'),false);
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('apiKey'),'example-key');
  const empty=new URL(M.shareURL(url.href,{excluded:[]}));assert.equal(empty.searchParams.get('exclude'),'');assert.equal(empty.hash,'');
});
test('monitor payload validation accepts both saved formats and rejects malformed history',()=>{
  const M=require('./amc8_activity.js'),state={version:1,attempts:[{at:'2026-10-05T12:00:00Z',correct:true,review:false}]};
  assert.deepEqual(M.readPayload({state:JSON.stringify(state)}),state);assert.equal(M.readPayload({state}),state);
  assert.equal(M.readPayload({state:'invalid'}),null);assert.equal(M.readPayload({state:{version:1,attempts:[null]}}),null);
});
test('standalone page starts reading directly and shared filters override viewer preferences',()=>{
  const M=require('./amc8_activity.js');
  const page=fs.readFileSync(`${__dirname}/amc8_monitor.html`,'utf8');
  const inline=Array.from(page.matchAll(/<script>([\s\S]*?)<\/script>/g),m=>m[1]);
  const elements=new Map(),writes=[],reads=[],addresses=[];
  function element(){return {value:'',checked:false,hidden:false,textContent:'',children:[],style:{},events:{},addEventListener(type,handler){this.events[type]=handler;},reportValidity:()=>true,checkValidity:()=>true,replaceChildren(...children){this.children=children;},append(...children){this.children.push(...children);},setAttribute(){},focus(){},select(){}};}
  const boxes=[1,2,3,4,5,6,0].map(n=>({...element(),value:String(n)}));
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  get('monitor-filter').querySelectorAll=()=>boxes;
  const watcher={...M,cycleDays:attempts=>M.cycleDays(attempts,new Date('2026-10-05T12:00:00Z'),[3,6]),watch:(name,key,handlers)=>{reads.push({name,key,handlers});handlers.onStatus('connecting');return ()=>{};}};
  const sandbox={history:{replaceState:(state,title,url)=>addresses.push(url)},window:{ActivityMonitor:watcher},URL,URLSearchParams,Date,location:{href:'https://example.com/test/amc8_monitor.html?student=Bruce&goal=12&period=week&exclude=3,6#apiKey=demo',search:'?student=Bruce&goal=12&period=week&exclude=3,6',hash:'#apiKey=demo'},localStorage:{getItem:key=>key==='amc8ActivityExcludedWeekdays'?'[0]':null,setItem:(key,value)=>writes.push(key)},document:{getElementById:get,createElement:element},setInterval(){},addEventListener(){}};
  for(const code of inline)vm.runInNewContext(code,sandbox);
  assert.equal(reads.length,1);assert.equal(reads[0].name,'Bruce');assert.equal(reads[0].key,'demo');
  assert.deepEqual(boxes.filter(b=>b.checked).map(b=>Number(b.value)),[3,6]);
  assert.ok(writes.every(key=>key.startsWith('amc8Activity')));
  reads[0].handlers.onData({state:{version:1,attempts:[]}});reads[0].handlers.onStatus('synced');
  assert.equal(get('monitor-days').children.length,5);assert.equal(get('monitor-days').hidden,false);
  assert.equal(get('monitor-status').textContent,'Connected · live updates enabled.');
  assert.equal(new URL(get('share-link').value).searchParams.get('goal'),'12');
  get('monitor-period').value='cycle';get('monitor-period').events.change();
  const upcoming=get('monitor-days').children[2];
  assert.ok(upcoming.children[0].children[0].textContent.includes('Upcoming'));
  assert.equal(upcoming.children[0].children[1].textContent,'0 / 12 answers');
  assert.equal(get('monitor-days').children[3].children[0].children[1].textContent,'No practice goal');
  get('monitor-goal').value='20';get('monitor-goal').events.input();
  assert.equal(get('monitor-days').children[2].children[0].children[1].textContent,'0 / 20 answers');
  assert.equal(get('monitor-days').children[3].children[0].children[1].textContent,'No practice goal');
  assert.equal(get('monitor-days').children[3].children.length,2);
  const shared=new URL(get('share-link').value);
  assert.equal(shared.searchParams.get('goal'),'20');assert.equal(shared.searchParams.get('period'),'cycle');
  assert.equal(shared.searchParams.get('exclude'),'3,6');
  assert.equal(new URLSearchParams(shared.hash.slice(1)).get('apiKey'),'demo');
  assert.equal(new URL(addresses.at(-1)).searchParams.get('goal'),'20');
});

test('default interval runs Sunday to Wednesday with future days clearly marked',()=>{
  const M=require('./amc8_activity.js');
  const days=M.cycleDays([{at:'2026-10-05T08:00:00Z',correct:true,review:false},{at:'2026-10-06T19:00:00Z',correct:true,review:false}],new Date('2026-10-05T12:00:00Z'),[3,6]);
  assert.deepEqual(days.map(d=>d.key),['2026-10-04','2026-10-05','2026-10-06','2026-10-07']);
  assert.equal(days[1].total,1);assert.equal(days[1].upcoming,false);
  assert.equal(days[2].total,0);assert.equal(days[2].upcoming,true);assert.equal(days[2].tutoring,false);
  assert.equal(days[3].upcoming,true);assert.equal(days[3].tutoring,true);
});
test('on tutoring day keep the interval ending today, then roll over the next day',()=>{
  const M=require('./amc8_activity.js');
  const wed=M.cycleDays([],new Date('2026-10-07T20:00:00Z'),[3,6]);
  assert.deepEqual(wed.map(d=>d.key),['2026-10-04','2026-10-05','2026-10-06','2026-10-07']);
  assert.equal(wed.at(-1).upcoming,false);assert.equal(wed.at(-1).tutoring,true);
  assert.deepEqual(M.cycleDays([],new Date('2026-10-08T20:00:00Z'),[3,6]).map(d=>d.key),['2026-10-08','2026-10-09','2026-10-10']);
});
test('cycle crosses DST safely, handles weekly tutoring and falls back when no days are selected',()=>{
  const M=require('./amc8_activity.js');
  assert.deepEqual(M.cycleDays([],new Date('2026-11-02T07:30:00Z'),[3,6]).map(d=>d.key),['2026-11-01','2026-11-02','2026-11-03','2026-11-04']);
  assert.equal(M.cycleDays([],new Date('2026-10-05T12:00:00Z'),[3]).length,7);
  assert.deepEqual(M.cycleDays([],new Date('2026-10-05T12:00:00Z'),[]),M.days([],new Date('2026-10-05T12:00:00Z')));
});
