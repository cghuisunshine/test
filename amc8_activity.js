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

// On a tutoring day, keep the interval ending today visible until the next date.
function cycleDays(attempts,now=new Date(),tutoringWeekdays=[3,6]){
  const schedule=[...new Set(tutoringWeekdays)].filter(n=>Number.isInteger(n)&&n>=0&&n<=6);
  if(!schedule.length)return days(attempts,now);
  const today=days([],now)[0].key,anchor=new Date(today+'T12:00:00Z');
  const shift=n=>{const date=new Date(anchor);date.setUTCDate(date.getUTCDate()+n);return date;};
  let previous=-1,next=0;
  while(!schedule.includes(shift(previous).getUTCDay()))previous--;
  while(!schedule.includes(shift(next).getUTCDay()))next++;
  const end=shift(next),start=shift(previous+1).toISOString().slice(0,10);
  return days(attempts.filter(a=>Date.parse(a.at)<=now.getTime()),end).filter(day=>day.key>=start).reverse().map(day=>({
    ...day,label:(day.key===today?'Today · ':'')+new Date(day.key+'T12:00:00Z').toLocaleDateString('en-CA',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}),upcoming:day.key>today,tutoring:day.key===end.toISOString().slice(0,10)
  }));
}

function shareURL(base,{student='Bruce',goal=10,excluded=[],key='',period='cycle'}){
  const url=new URL('amc8_monitor.html',base);url.search='';url.hash='';
  url.searchParams.set('student',student);
  url.searchParams.set('goal',String(goal));
  url.searchParams.set('period',period==='week'?'week':'cycle');
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
const api={days,cycleDays,watch,shareURL,readPayload};
root.ActivityMonitor=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
