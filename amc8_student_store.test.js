const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {Session,validId}=require('./amc8_live_share.js');
const html=fs.readFileSync(`${__dirname}/amc8_practice.html`,'utf8');
const start=html.indexOf('<script>/* Per-student persistence')+8;
const source=html.slice(start,html.indexOf('</script>',start));
const ID='ab'.repeat(24);

function fixture(savedKey='saved-key'){
  const storage=new Map(savedKey?[['firebaseApiKey',savedKey]]:[]),apps=[],documents=new Map(),reads=[];
  const firebase={apps,initializeApp(config,name='[DEFAULT]'){
    assert.ok(!apps.some(app=>app.name===name),'Firebase app names must be unique');
    const subscriptions=new Set();
    const app={name,options:config,deleted:false,async delete(){
      this.deleted=true;apps.splice(apps.indexOf(this),1);
      for(const subscription of subscriptions){
        subscription.document.listeners.delete(subscription);
        subscription.error?.(Object.assign(Error('Client terminated'),{code:'failed-precondition'}));
      }
    }};
    const database={collection(collection){
      assert.equal(collection,'amc8PracticeStudents');
      return {doc(id){
        reads.push({id,key:config.apiKey});
        if(!documents.has(id))documents.set(id,{data:null,listeners:new Set()});
        const document=documents.get(id);
        return {onSnapshot(options,next,error){
          if(typeof options==='function'){error=next;next=options;}
          if(app.deleted)throw Object.assign(Error('Client terminated'),{code:'failed-precondition'});
          const subscription={next,error,document};subscriptions.add(subscription);document.listeners.add(subscription);
          next({exists:document.data!==null,data:()=>document.data,metadata:{fromCache:false}});
          return ()=>{subscriptions.delete(subscription);document.listeners.delete(subscription);};
        },async set(data){
          if(app.deleted)throw Error('Client terminated');
          document.data=data;
          for(const subscription of document.listeners)subscription.next({exists:true,data:()=>data,metadata:{fromCache:false}});
        }};
      }};
    }};
    app.firestore=()=>database;apps.push(app);return app;
  },app(){return apps.find(app=>app.name==='[DEFAULT]');},firestore(){return this.app().firestore();}};
  const window={firebase,LivePractice:{validId}};
  vm.runInNewContext(source,{window,firebase,URLSearchParams,location:{search:''},localStorage:{
    getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)
  }});
  const statuses=[],questions=[];
  const store=window.StudentStore;
  const viewer=new Session({openDoc:(id,key)=>store.liveRef(id,key),onStatus:status=>statuses.push(status),onQuestion:question=>questions.push(question)});
  function emit(revision,q){
    const record={kind:'amc8-live',version:1,active:true,revision,question:{q},expiresAt:Date.now()+3600000};
    const id='live-'+ID;
    if(!documents.has(id))documents.set(id,{data:null,listeners:new Set()});
    const document=documents.get(id);document.data=record;
    for(const subscription of document.listeners)subscription.next({exists:true,data:()=>record,metadata:{fromCache:false}});
  }
  emit(1,'exam-2020-25');
  const handlers={getLocal:()=>null,onRemote:()=>{},onStatus:()=>{}};
  return {store,viewer,statuses,questions,apps,reads,storage,emit,handlers};
}

for(const liveFirst of [true,false])test(`live sharing survives a different saved sync key (${liveFirst?'live':'sync'} starts first)`,async()=>{
  const f=fixture();
  const follow=()=>f.viewer.follow(ID,'link-key'),sync=()=>f.store.start('Test',f.handlers);
  await Promise.all(liveFirst?[follow(),sync()]:[sync(),follow()]);
  assert.equal(f.statuses.at(-1),'following');
  f.emit(2,'exam-2002-22');
  assert.deepEqual(f.questions,[{q:'exam-2020-25'},{q:'exam-2002-22'}]);
  assert.equal(f.reads.find(read=>read.id==='live-'+ID).key,'link-key');
  assert.equal(f.reads.find(read=>read.id==='test').key,'saved-key');
  assert.equal(f.store.syncing(),true);
  assert.equal(f.storage.get('firebaseApiKey'),'saved-key');
  assert.equal(f.statuses.includes('error'),false);
  f.viewer.leave();f.store.stop();
});

test('changing or disabling student sync leaves the live listener connected',async()=>{
  const f=fixture();await f.viewer.follow(ID,'link-key');await f.store.start('Test',f.handlers);
  f.store.setApiKey('new-saved-key');await f.store.start('Test',f.handlers);f.emit(2,'exam-2002-22');
  f.store.setApiKey('');f.store.stop();f.emit(3,'exam-2003-1');
  assert.equal(f.statuses.at(-1),'following');
  assert.deepEqual(f.questions,[{q:'exam-2020-25'},{q:'exam-2002-22'},{q:'exam-2003-1'}]);
  assert.equal(f.store.syncing(),false);f.viewer.leave();
});

test('a fresh browser can follow from the fragment key without saved sync settings',async()=>{
  const f=fixture('');await f.viewer.follow(ID,'link-key');
  assert.equal(f.statuses.at(-1),'following');assert.equal(f.questions.length,1);
  assert.equal(f.storage.has('firebaseApiKey'),false);assert.equal(f.store.syncing(),false);
  f.viewer.leave();
});

test('concurrent live and student connections reuse the same key without resetting either',async()=>{
  const f=fixture('link-key');await Promise.all([f.viewer.follow(ID,'link-key'),f.store.start('Test',f.handlers)]);
  const count=f.apps.length;
  await f.store.liveRef(ID,'link-key');await f.store.start('Test',f.handlers);
  assert.equal(f.apps.length,count);assert.equal(count,1);
  f.emit(2,'exam-2002-22');assert.equal(f.questions.length,2);assert.equal(f.statuses.at(-1),'following');
  f.viewer.leave();f.store.stop();
});

const attempt=(id,at,choice='A')=>({id,at,choice,answer:'A',correct:choice==='A',review:false,kind:'exam',title:id,topic:'Geometry',level:1});
const payload=(attempts,updatedAt='2026-10-24T20:00:00Z',extra={})=>({version:1,student:'Bruce',updatedAt,state:JSON.stringify({version:1,attempts,items:Object.fromEntries(attempts.map(a=>[a.id,{problem:{id:a.id,kind:'exam',topic:a.topic,level:1,answer:'A',title:a.id},manual:false,missed:!a.correct}])),...extra})});
const stateOf=p=>JSON.parse(p.state);

test('sync merges yesterday’s local practice with a different device’s newer history',()=>{
  const f=fixture(),old=attempt('exam-2023-1','2026-10-21T20:00:00Z'),yesterday=attempt('exam-2023-2','2026-10-24T20:00:00Z'),today=attempt('exam-2023-3','2026-10-25T20:00:00Z');
  const local=payload([old,yesterday]),remote=payload([old,today],'2026-10-25T21:00:00Z');
  const merged=f.store.mergePayloads(local,remote);
  assert.deepEqual(stateOf(merged).attempts.map(a=>a.id),[old.id,yesterday.id,today.id]);
  assert.deepEqual(stateOf(f.store.mergePayloads(merged,remote)),stateOf(merged),'repeated snapshots must not duplicate answers');
  assert.deepEqual(stateOf(f.store.mergePayloads(remote,merged)),stateOf(merged));
});

test('merged retries preserve first-attempt accuracy and the latest review result',()=>{
  const f=fixture(),first=attempt('exam-2023-1','2026-10-24T20:00:00Z','B'),retry=attempt(first.id,'2026-10-25T20:00:00Z');
  const state=stateOf(f.store.mergePayloads(payload([first]),payload([retry],'2026-10-25T21:00:00Z')));
  assert.deepEqual(state.attempts.map(a=>a.review),[false,true]);
  assert.equal(state.attempts[0].correct,false);assert.equal(state.items[first.id].missed,false);
});

test('merged follow-up answers and AI reviews survive updates from two devices',()=>{
  const f=fixture(),a=attempt('exam-2023-1','2026-10-24T20:00:00Z'),question={text:'same question',answer:'A'};
  const wrong={choice:'B',correct:false,at:'2026-10-24T20:01:00Z'},correct={choice:'A',correct:true,at:'2026-10-24T20:02:00Z'};
  const local=payload([{...a,followUp:{question,answers:[wrong]},aiReview:{feedback:'review'},aiReviewedAt:'2026-10-24T21:00:00Z'}],undefined,{liveFollowUps:{'followup-test':{sourceId:a.id,question,answers:[wrong]}}});
  const remote=payload([{...a,followUp:{question,answers:[correct]}}],'2026-10-25T20:00:00Z',{liveFollowUps:{'followup-test':{sourceId:a.id,question,answers:[correct]}}});
  const state=stateOf(f.store.mergePayloads(local,remote));
  assert.deepEqual(state.attempts[0].followUp.answers,[wrong,correct]);assert.equal(state.attempts[0].aiReview.feedback,'review');
  assert.deepEqual(state.liveFollowUps['followup-test'].answers,[wrong,correct]);
});

test('signed-in live participants use the link key for history sync without replacing a saved key',async()=>{
  for(const saved of ['', 'saved-key']){
    const f=fixture(saved);await f.store.start('Bruce',{...f.handlers,apiKey:'link-key'});
    assert.equal(f.store.syncing(),true);assert.equal(f.store.getApiKey(),saved||'link-key');
    assert.equal(f.reads.find(r=>r.id==='bruce').key,saved||'link-key');f.store.stop();
  }
});

test('an explicit device-only choice is respected when joining a live session',async()=>{
  const f=fixture();f.store.setApiKey('');let status;
  assert.equal(await f.store.start('Bruce',{...f.handlers,apiKey:'link-key',onStatus:s=>status=s}),false);
  assert.equal(status,'local');assert.equal(f.store.getApiKey(),'');assert.equal(f.reads.some(r=>r.id==='bruce'),false);
});

test('reconnecting uploads the union and applies it locally rather than losing either history',async()=>{
  const f=fixture(),a=attempt('exam-2023-1','2026-10-24T20:00:00Z'),b=attempt('exam-2023-2','2026-10-25T20:00:00Z');
  let local=payload([a]);await f.store.liveRef(ID,'saved-key');
  // Use the same mock database to seed the student document before opening its listener.
  const db=f.apps[0].firestore();await db.collection('amc8PracticeStudents').doc('bruce').set(payload([b],'2026-10-25T21:00:00Z'));
  await f.store.start('Bruce',{getLocal:()=>local,onRemote:p=>{local=p;},onStatus:()=>{}});
  await new Promise(setImmediate);
  assert.equal(stateOf(local).attempts.length,2);
  let remote;const off=db.collection('amc8PracticeStudents').doc('bruce').onSnapshot(s=>remote=s.data());off();
  assert.equal(stateOf(remote).attempts.length,2);f.store.stop();
});

test('atomic writes merge the latest server document before saving local progress',async()=>{
  const f=fixture(),a=attempt('exam-2023-1','2026-10-24T20:00:00Z'),b=attempt('exam-2023-2','2026-10-25T20:00:00Z');
  let local=payload([a]),writes=0;
  await f.store.start('Bruce',{getLocal:()=>local,onRemote:p=>{local=p;},onStatus:()=>{}});await new Promise(setImmediate);
  const db=f.apps[0].firestore();
  db.runTransaction=async fn=>fn({get:async()=>({exists:true,data:()=>payload([b],'2026-10-25T21:00:00Z')}),set:(_ref,value)=>{writes++;assert.equal(stateOf(value).attempts.length,2);}});
  assert.equal(await f.store.push(local),true);assert.equal(writes,1);assert.equal(stateOf(local).attempts.length,2);f.store.stop();
});


test('a superseded sign-in cannot attach a late sync listener to the wrong student',async()=>{
  const f=fixture();
  const old=f.store.start('Other',f.handlers),current=f.store.start('Bruce',f.handlers);
  assert.equal(await old,false);assert.equal(await current,true);
  assert.equal(f.reads.some(r=>r.id==='other'),false);assert.equal(f.reads.some(r=>r.id==='bruce'),true);f.store.stop();
});


test('saved exam history omits built-in statements, solutions and embedded images',()=>{
  const f=fixture(),a=attempt('exam-2023-1','2026-10-24T20:00:00Z'),p=payload([a]);
  const state=stateOf(p);state.items[a.id].problem.html='data:image/png;base64,'+'A'.repeat(1200000);state.items[a.id].problem.solution='A full solution';p.state=JSON.stringify(state);
  const compact=f.store.compactPayload(p);
  assert.ok(compact.state.length<2000);assert.equal(stateOf(compact).attempts.length,1);
  assert.equal(stateOf(compact).items[a.id].problem.id,a.id);
  assert.equal(stateOf(compact).items[a.id].problem.html,undefined);
  assert.equal(stateOf(compact).items[a.id].problem.solution,undefined);
  assert.equal(f.store.saveLocal('Bruce',p),true);
  assert.ok(f.storage.get('amc8Practice.v1:bruce').length<2000);
  assert.equal(stateOf(p).items[a.id].problem.html.length,1200022,'compaction must not mutate the in-memory source');
});

test('legacy oversized local or cloud history is compacted before merging or uploading',async()=>{
  const f=fixture(),a=attempt('exam-2023-1','2026-10-24T20:00:00Z'),p=payload([a]);
  const state=stateOf(p);state.items[a.id].problem.html='A'.repeat(1200000);p.state=JSON.stringify(state);
  assert.ok(f.store.mergePayloads(p,null).state.length<2000);
  assert.ok(f.store.mergePayloads(null,p).state.length<2000);
  let local=p;await f.store.start('Bruce',{getLocal:()=>local,onRemote:p=>{local=p;},onStatus:()=>{}});await new Promise(setImmediate);
  const db=f.apps[0].firestore();let remote;const off=db.collection('amc8PracticeStudents').doc('bruce').onSnapshot(s=>remote=s.data());off();
  assert.ok(remote.state.length<2000);assert.equal(stateOf(remote).attempts.length,1);f.store.stop();
});

test('original generated questions keep their question text and explanations when compacted',()=>{
  const f=fixture(),p=payload([]),state=stateOf(p);
  const question={id:'new-question',kind:'generated',title:'New',topic:'Algebra',level:1,text:'2+3?',choices:['1','2','3','4','5'],answer:'E',explanation:'Add to get 5.'};
  state.items[question.id]={problem:question,manual:true,missed:false};p.state=JSON.stringify(state);
  assert.deepEqual(stateOf(f.store.compactPayload(p)).items[question.id].problem,question);
});

test('the entire built-in exam bank fits in a history document without duplicating diagrams',()=>{
  const f=fixture(),bank=JSON.parse(html.match(/<script id="exam-bank" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const state={version:1,attempts:bank.map((p,i)=>({...attempt(p.id,new Date(Date.UTC(2026,9,24,0,i)).toISOString()),topic:p.topic,level:p.level,title:p.title,answer:p.answer,choice:p.answer})),items:Object.fromEntries(bank.map(p=>[p.id,{problem:p,manual:false,missed:false}]))};
  const compact=f.store.compactPayload({version:1,student:'Test',updatedAt:'2026-10-24T20:00:00Z',state});
  assert.ok(Buffer.byteLength(compact.state,'utf8')<1048000,'saved progress must fit under the Firestore document limit');
  assert.equal(stateOf(compact).attempts.length,bank.length);
  assert.equal(Object.keys(stateOf(compact).items).length,bank.length);
  assert.doesNotMatch(compact.state,/data:image|<img/);
});


test('switching students cancels a transaction before it can write the other profile',async()=>{
  const f=fixture();let local=payload([attempt('exam-2023-1','2026-10-24T20:00:00Z')]);
  await f.store.start('Bruce',{getLocal:()=>local,onRemote:p=>{local=p;},onStatus:()=>{}});await new Promise(setImmediate);
  let resume,writes=0;const db=f.apps[0].firestore();
  db.runTransaction=fn=>fn({get:()=>new Promise(resolve=>{resume=resolve;}),set:()=>{writes++;}});
  const pending=f.store.push(local);f.store.stop();resume({exists:false});
  assert.equal(await pending,false);assert.equal(writes,0);
});
