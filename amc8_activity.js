/* Shared read-only AMC 8 activity monitoring. No student login or history writes. */
(function(root){
'use strict';
const CONFIG={authDomain:"homeinventory-4718c.firebaseapp.com",projectId:"homeinventory-4718c",storageBucket:"homeinventory-4718c.firebasestorage.app",messagingSenderId:"719884896213",appId:"1:719884896213:web:e93d5dffc79dec10995f5c"};
  function days(attempts,now=new Date(),excludedWeekdays=[]) {
    const zone='America/Vancouver';
    const keyFor=value=>{
      const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
      const part=type=>parts.find(p=>p.type===type).value;
      return `${part('year')}-${part('month')}-${part('day')}`;
    };
    const today=keyFor(now),anchor=new Date(today+'T12:00:00Z');
    const days=Array.from({length:7},(_,i)=>{
      const date=new Date(anchor);date.setUTCDate(date.getUTCDate()-i);
      return {key:date.toISOString().slice(0,10),label:(i===0?'Today · ':'')+date.toLocaleDateString('en-CA',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}),total:0,correct:0,retries:0,seconds:0,missingTime:0};
    });
    const byDay=new Map(days.map(d=>[d.key,d]));
    for(const a of attempts){
      const day=byDay.get(keyFor(a.at));if(!day||Date.parse(a.at)>now.getTime())continue;
      day.total++;if(a.correct)day.correct++;if(a.review)day.retries++;
      if(typeof a.seconds==='number'&&Number.isFinite(a.seconds)&&a.seconds>=0)day.seconds+=a.seconds;else day.missingTime++;
    }
    return days.filter(day=>!excludedWeekdays.includes(new Date(day.key+'T12:00:00Z').getUTCDay()));
  }

function shareURL(base,{student='Bruce',goal=10,excluded=[],key=''}){
  const url=new URL('amc8_monitor.html',base);url.search='';url.hash='';
  url.searchParams.set('student',student);
  url.searchParams.set('goal',String(goal));
  // Include an empty exclusion list so a recipient's saved filter cannot override the link.
  url.searchParams.set('exclude',excluded.join(','));
  if(key)url.hash=new URLSearchParams({apiKey:key}).toString();
  return url.toString();
}
function readPayload(payload){
  try{
    if(!payload||!payload.state)return null;
    const state=typeof payload.state==='string'?JSON.parse(payload.state):payload.state;
    if(state.version!==1||!Array.isArray(state.attempts))return null;
    if(!state.attempts.every(a=>a&&typeof a.at==='string'&&Number.isFinite(Date.parse(a.at))&&typeof a.correct==='boolean'&&typeof a.review==='boolean'))return null;
    return state;
  }catch(e){return null;}
}
let loading=null;
function loadSdk(){
  if(root.firebase&&root.firebase.firestore)return Promise.resolve();
  if(!loading)loading=['firebase-app-compat.js','firebase-firestore-compat.js'].reduce((promise,file)=>promise.then(()=>new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://www.gstatic.com/firebasejs/9.23.0/'+file;script.onload=resolve;script.onerror=()=>reject(Error('firebase-sdk-unavailable'));document.head.append(script);
  })),Promise.resolve()).catch(error=>{loading=null;throw error;});
  return loading;
}
const databases=new Map();
function watch(name,key,handlers){
  let cancelled=false,off=null;
  const stop=()=>{cancelled=true;if(off){off();off=null;}};
  if(!key){handlers.onStatus('missing-key');return stop;}
  handlers.onStatus('connecting');
  (async()=>{
    try{
      await loadSdk();if(cancelled)return;
      let database=databases.get(key);
      if(!database){const app=root.firebase.initializeApp({...CONFIG,apiKey:key},'amc8ActivityMonitor-'+databases.size);database=app.firestore();databases.set(key,database);}
      const id=encodeURIComponent(String(name).trim().replace(/\s+/g,' ').toLowerCase()).slice(0,200);
      off=database.collection('amc8PracticeStudents').doc(id).onSnapshot({includeMetadataChanges:true},snapshot=>{
        if(cancelled)return;
        handlers.onData(snapshot.exists?snapshot.data():null);
        handlers.onStatus(snapshot.metadata&&snapshot.metadata.fromCache?'cached':'synced');
      },error=>{if(!cancelled)handlers.onStatus('error',error);});
    }catch(error){if(!cancelled)handlers.onStatus('error',error);}
  })();
  return stop;
}
const api={days,watch,shareURL,readPayload};
root.ActivityMonitor=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
