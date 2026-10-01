const test=require('node:test');
const assert=require('node:assert/strict');
const {Session,pack,unpack,shareURL,validId}=require('./amc8_live_share.js');
const ID='ab'.repeat(24);
const p1={id:'exam-2003-1',kind:'exam',topic:'Geometry',answer:'E',html:'<p>Cube</p>'};
const p2={id:'exam-2003-2',kind:'exam',topic:'Algebra',answer:'B'};
const original={id:'generated-123',kind:'generated',topic:'Algebra',level:1,title:'Original',text:'2 + 3?',choices:['1','2','3','4','5'],answer:'E',explanation:'Add to get 5.'};
function backend(){
  const docs=new Map(),writes=[];
  function openDoc(id){
    if(!docs.has(id))docs.set(id,{data:null,listeners:new Set()});
    const doc=docs.get(id);
    const emit=()=>{for(const listener of doc.listeners)listener({exists:!!doc.data,data:()=>structuredClone(doc.data),metadata:{fromCache:false}});};
    return Promise.resolve({
      async set(data){writes.push(structuredClone(data));doc.data=structuredClone(data);emit();},
      onSnapshot(options,listener){doc.listeners.add(listener);emit();return ()=>doc.listeners.delete(listener);}
    });
  }
  return {openDoc,docs,writes};
}
const client=(b,extra={})=>new Session({openDoc:b.openDoc,makeId:()=>ID,...extra});

test('share links use a random session id and never carry student identities or history',()=>{
  const url=new URL(shareURL('https://example.test/amc8_practice.html?q=old&student=someone',ID,'web-config'));
  assert.equal(url.searchParams.get('follow'),ID);
  assert.equal(url.searchParams.size,1);
  assert.equal(url.hash,'#liveKey=web-config');
  assert.equal(validId('../student'),false);
});

test('question payloads use built-in exam content and validate original questions',()=>{
  assert.deepEqual(pack({...p1,history:'private',drawing:'private'}),{q:p1.id});
  assert.equal(unpack({q:p1.id,html:'<script>bad</script>'},[p1]),p1);
  assert.deepEqual(unpack(pack(original),[]),original);
  assert.equal(unpack({q:'unavailable'},[p1]),null);
  assert.equal(unpack({g:{...pack(original).g,c:['only one']}},[]),null);
  assert.equal(unpack({g:{...pack(original).g,t:'untrusted topic'}},[]),null);
});

test('multiple followers receive the initial question and every navigation',async()=>{
  const b=backend(),host=client(b),first=[],second=[];
  await host.startHost(p1);
  const viewer1=client(b,{onQuestion:q=>first.push(q)}),viewer2=client(b,{onQuestion:q=>second.push(q)});
  await viewer1.follow(ID,'web-config');await viewer2.follow(ID,'web-config');
  await host.publish(p2);await host.publish(original);
  assert.deepEqual(first,[pack(p1),pack(p2),pack(original)]);
  assert.deepEqual(second,first);
  assert.equal(b.writes.length,3);
  assert.deepEqual(Object.keys(b.writes[0]).sort(),['active','expiresAt','kind','question','revision','updatedAt','version']);
});

test('followers never publish their own questions or change the host',async()=>{
  const b=backend(),host=client(b);await host.startHost(p1);
  const viewer=client(b);await viewer.follow(ID,'web-config');await viewer.publish(p2);
  assert.equal(b.writes.length,1);assert.deepEqual(b.docs.get(ID).data.question,pack(p1));
});

test('rapid navigation writes in order, and stop reaches followers after pending updates',async()=>{
  const b=backend(),host=client(b),seen=[],statuses=[];await host.startHost(p1);
  await client(b,{onQuestion:q=>seen.push(q),onStatus:s=>statuses.push(s)}).follow(ID,'web-config');
  const a=host.publish(p2),c=host.publish(original);const stop=host.stopHost();
  await Promise.all([a,c,stop]);
  assert.deepEqual(b.writes.map(w=>w.revision),[1,2,3,4]);
  assert.deepEqual(seen,[pack(p1),pack(p2),pack(original)]);
  assert.equal(statuses.at(-1),'ended');assert.equal(host.role,'idle');assert.equal(b.docs.get(ID).data.active,false);
});

test('leaving unsubscribes and late connection attempts cannot reattach',async()=>{
  const b=backend(),host=client(b);await host.startHost(p1);
  const seen=[],viewer=client(b,{onQuestion:q=>seen.push(q)});await viewer.follow(ID,'web-config');viewer.leave();await host.publish(p2);
  assert.equal(seen.length,1);assert.equal(b.docs.get(ID).listeners.size,0);
  let resolve;const pending=new Session({openDoc:()=>new Promise(ok=>resolve=ok)});
  const connecting=pending.follow(ID,'web-config');pending.leave();resolve(await b.openDoc(ID));await connecting;
  assert.equal(pending.role,'idle');assert.equal(b.docs.get(ID).listeners.size,0);
});

test('write failures are visible and a later update recovers',async()=>{
  const b=backend(),statuses=[];let rejectNext=false;
  const openDoc=async id=>{const ref=await b.openDoc(id);return {...ref,set:async data=>{if(rejectNext){rejectNext=false;throw Error('offline');}return ref.set(data);}};};
  const host=new Session({openDoc,makeId:()=>ID,onStatus:s=>statuses.push(s)});await host.startHost(p1);
  rejectNext=true;await assert.rejects(host.publish(p2),/offline/);assert.equal(statuses.at(-1),'publish-error');
  await host.publish(p2);assert.equal(statuses.at(-1),'hosting');assert.deepEqual(b.docs.get(ID).data.question,pack(p2));
  rejectNext=true;await assert.rejects(host.stopHost(),/offline/);assert.equal(host.role,'host');assert.equal(statuses.at(-1),'stop-error');
  await host.stopHost();assert.equal(host.role,'idle');
});

test('unavailable and expired sessions report their state without showing a question',async()=>{
  const b=backend(),statuses=[],seen=[];const viewer=client(b,{onStatus:s=>statuses.push(s),onQuestion:q=>seen.push(q)});
  await viewer.follow(ID,'web-config');assert.equal(statuses.at(-1),'unavailable');
  const host=client(b,{now:()=>0});await host.startHost(p1);
  assert.equal(statuses.at(-1),'ended');assert.equal(seen.length,0);
});

test('an empty host selection clears the follower question',async()=>{
  const b=backend(),host=client(b),seen=[];await host.startHost(p1);await client(b,{onQuestion:q=>seen.push(q)}).follow(ID,'web-config');
  await host.publish(null);assert.deepEqual(seen,[pack(p1),null]);
});

test('a failed start does not create a shareable session',async()=>{
  const statuses=[];const host=new Session({openDoc:async()=>{throw Error('missing-firebase-api-key');},makeId:()=>ID,onStatus:s=>statuses.push(s)});
  await assert.rejects(host.startHost(p1),/missing-firebase-api-key/);assert.equal(host.role,'idle');assert.equal(statuses.at(-1),'error');
});
