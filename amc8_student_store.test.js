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
