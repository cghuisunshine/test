const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(`${__dirname}/amc8_practice.html`, 'utf8');
const protocol = html.match(/<script>\/\* Similar-question protocol[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g, '');
const core = html.match(/<script>\/\* Pure practice logic[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g, '');
const ui = html.slice(html.indexOf('// Follow-up practice stays'), html.indexOf('dashboard();if(!followRequested)next();'));
const check = html.slice(html.indexOf("$('check').onclick=()=>{"), html.indexOf("$('flag').onclick="));
const question = { text: 'A rectangle measures 8 cm by 3 cm. What is its perimeter?', choices: ['11', '22', '24', '28', '48'], answer: 'B', explanation: 'Add all four sides: 2 × (8 + 3) = 22 cm.' };
function element() {
  return { hidden: true, disabled: false, checked: false, textContent: '', children: [], className: '',
    classList: { add() {}, toggle() {} }, setAttribute() {},
    replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); } };
}
function fixture({ enabled = true, correct = false, kind = 'exam', fetch } = {}) {
  const elements = new Map(), storage = new Map(enabled === null ? [] : [['amc8PracticeFollowUp', String(enabled)]]), requests = [];
  const context = {
    module: { exports: {} }, window: {}, Date, AbortController, setTimeout, clearTimeout, crypto: require('node:crypto').webcrypto,
    live: { role: 'idle', publications: [], publish(p,f=null) { this.publications.push({p,f}); return Promise.resolve(); } },
    document: { createElement: element, querySelectorAll: () => [] },
    $: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    state: { attempts: [], items: {} }, student: 'Test', activeAttempt: null, checked: false, selected: correct ? 'A' : 'C', started: Date.now(),
    current: { id: 'exam-2023-1', kind, title: 'Rectangle perimeter', topic: 'Geometry', level: 1, html: 'Original rectangle problem', solution: 'Add all four sides', answer: 'A' },
    AI: { endpoint: 'https://example.test/tutor' },
    blankImage: () => ({ image: 'blank', mime_type: 'image/jpeg', filename: 'blank.jpg' }),
    readableHTML: s => s, save() { context.saved++; }, saved: 0, dashboard() {}, updatePhotoControls() {}, hasWorking: () => false, describeDuration: () => '1 second',
    fetch: (...args) => { requests.push(args); return fetch ? fetch(...args) : Promise.resolve({ ok: true, json: async () => ({ response: JSON.stringify(question) }) }); }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(`${__dirname}/amc8_activity.js`, 'utf8'), context);
  // The pure core uses window.ActivityMonitor's exported helper.
  vm.runInContext(core, context); context.P = context.window.Practice;
  vm.runInContext(protocol, context); context.FQ = context.window.SimilarQuestion;
  vm.runInContext(ui, context); vm.runInContext(check, context);
  return { c: context, $: context.$, storage, requests, async submit() { context.$('check').onclick(); await new Promise(setImmediate); } };
}

test('follow-up protocol accepts service envelopes and rejects incomplete or duplicate choices', () => {
  const { c } = fixture();
  for (const envelope of [question, { response: question }, { response: '```json\n' + JSON.stringify(question) + '\n```' }]) {
    assert.equal(c.FQ.parseResponse(envelope).answer, 'B');
  }
  for (const bad of [{ ...question, answer: 'F' }, { ...question, choices: ['1', '2', '2', '3', '4'] }, { ...question, choices: ['1', '2'] }, { ...question, explanation: '' }, { response: 'not JSON' }, { ok: false }]) {
    assert.throws(() => c.FQ.parseResponse(bad));
  }
});

test('follow-ups default to enabled while respecting a saved opt-out', async () => {
  const fresh = fixture({ enabled: null });
  assert.equal(fresh.$('followup-enabled').checked, true);
  await fresh.submit();
  assert.equal(fresh.requests.length, 1);
  const optedOut = fixture({ enabled: false });
  assert.equal(optedOut.$('followup-enabled').checked, false);
  await optedOut.submit();
  assert.equal(optedOut.requests.length, 0);
});

test('only an enabled missed real exam answer automatically requests a follow-up', async () => {
  for (const options of [{ enabled: false }, { correct: true }, { kind: 'generated' }, {}]) {
    const f = fixture(options); await f.submit();
    const expected = !options.correct && options.kind !== 'generated' && options.enabled !== false;
    assert.equal(f.requests.length, expected ? 1 : 0);
    assert.equal(f.$('followup').hidden, !expected);
    if (expected) {
      const body = JSON.parse(f.requests[0][1].body);
      assert.match(body.message, /SPECIFIC mathematical concept/);
      assert.match(body.message, /Original rectangle problem/);
      assert.match(body.message, /Add all four sides/);
      assert.equal(f.$('followup-choices').children.length, 5);
      assert.equal(f.$('followup-check').disabled, true);
    }
  }
});

test('wrong then correct follow-up answers save separately and keep the original miss', async () => {
  const f = fixture(); await f.submit();
  const exam = f.c.state.attempts[0];
  f.$('followup-choices').children[0].onclick(); f.$('followup-check').onclick();
  assert.equal(exam.followUp.answers[0].correct, false);
  assert.equal(f.$('followup-solution').hidden, true);
  assert.equal(f.$('followup-retry').hidden, false);
  f.$('followup-retry').onclick();
  assert.equal(f.$('followup-check').disabled, true);
  f.$('followup-choices').children[1].onclick(); f.$('followup-check').onclick(); f.$('followup-check').onclick();
  assert.deepEqual(Array.from(exam.followUp.answers, a => a.correct), [false, true]);
  assert.equal(f.c.state.attempts.length, 1);
  assert.equal(exam.correct, false);
  assert.equal(f.c.state.items[exam.id].missed, true);
  assert.equal(f.c.P.stats(f.c.state).correct, 0);
  assert.equal(f.$('followup-solution').textContent, question.explanation);
});

test('revealing a solution requests a different question instead of retrying the revealed answer', async () => {
  const f = fixture(); await f.submit();
  f.$('followup-choices').children[0].onclick(); f.$('followup-check').onclick(); f.$('followup-reveal').onclick();
  assert.match(f.$('followup-solution').textContent, /Answer B/);
  assert.equal(f.$('followup-retry').textContent, 'Try another similar question');
  f.$('followup-retry').onclick(); await new Promise(setImmediate);
  assert.equal(f.requests.length, 2);
  assert.ok(JSON.parse(f.requests[1][1].body).message.includes(question.text));
  assert.equal(f.$('followup-solution').hidden, true);
});

test('service failure can be retried without changing the saved exam score', async () => {
  let calls = 0;
  const f = fixture({ fetch: async () => ++calls === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => question } });
  await f.submit();
  assert.match(f.$('followup-status').textContent, /503/);
  assert.equal(f.$('followup-retry').hidden, false);
  f.$('followup-retry').onclick(); await new Promise(setImmediate);
  assert.equal(f.$('followup-content').hidden, false);
  assert.equal(f.c.state.attempts.length, 1);
});

test('navigating away aborts generation and ignores late responses', async () => {
  let resolve;
  const f = fixture({ fetch: () => new Promise(r => { resolve = r; }) });
  await f.submit();
  vm.runInContext('resetFollowUp();current={...current,id:"exam-2023-2"};', f.c);
  assert.equal(f.requests[0][1].signal.aborted, true);
  resolve({ ok: true, json: async () => question }); await new Promise(setImmediate);
  assert.equal(f.$('followup').hidden, true);
  assert.equal(f.c.state.attempts[0].followUp, undefined);
});

test('turning the setting off cancels a pending request and remembers the choice', async () => {
  const f = fixture({ fetch: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Error('aborted')))) });
  await f.submit();
  f.$('followup-enabled').checked = false; f.$('followup-enabled').onchange(); await new Promise(setImmediate);
  assert.equal(f.storage.get('amc8PracticeFollowUp'), 'false');
  assert.equal(f.$('followup').hidden, true);
  assert.equal(f.requests[0][1].signal.aborted, true);
});


test('a generated follow-up publishes the same question and only its content', async () => {
  const f=fixture();f.c.live.role='host';await f.submit();
  const published=f.c.live.publications.at(-1);
  assert.equal(published.p.id,f.c.current.id);
  assert.match(published.f.id,/^followup-/);
  assert.equal(published.f.text,question.text);
  assert.equal(published.f.answer,question.answer);
  assert.equal(published.f.answers,undefined);
});

test('followers solve the host follow-up independently even before answering the original', async () => {
  const f=fixture();f.c.live.role='follower';
  f.c.shared={id:'followup-shared',...question};
  vm.runInContext('showSharedFollowUp(shared)',f.c);
  assert.equal(f.$('followup-content').hidden,false);
  f.$('followup-choices').children[1].onclick();f.$('followup-check').onclick();
  assert.equal(f.c.state.liveFollowUps['followup-shared'].answers[0].correct,true);
  assert.equal(f.c.state.attempts.length,0);
  assert.equal(f.requests.length,0);
  vm.runInContext('showSharedFollowUp(shared)',f.c);
  assert.match(f.$('followup-feedback').textContent,/Correct!/);
  f.$('followup-enabled').checked=false;f.$('followup-enabled').onchange();
  assert.equal(f.$('followup').hidden,false);
  await f.submit();
  assert.equal(f.requests.length,0);
  assert.equal(f.$('followup').hidden,false);
  assert.equal(f.c.state.attempts.length,1);
});

test('replacement follow-ups reset only the follow-up and keep exam work and answers', async () => {
  const f=fixture();f.c.live.role='follower';await f.submit();
  f.c.shared={id:'followup-first',...question};vm.runInContext('showSharedFollowUp(shared)',f.c);
  f.$('followup-choices').children[0].onclick();f.$('followup-check').onclick();
  const attempt=f.c.activeAttempt;
  f.c.shared={id:'followup-second',...question,text:'A different similar problem'};vm.runInContext('showSharedFollowUp(shared)',f.c);
  assert.equal(f.c.activeAttempt,attempt);assert.equal(f.c.checked,true);
  assert.equal(f.$('followup-statement').textContent,'A different similar problem');
  assert.equal(f.$('followup-feedback').textContent,'');
  assert.equal(f.c.state.liveFollowUps['followup-first'].answers.length,1);
  f.$('followup-choices').children[0].onclick();f.$('followup-check').onclick();f.$('followup-reveal').onclick();
  assert.equal(f.$('followup-retry').hidden,true);
  vm.runInContext('showSharedFollowUp(null)',f.c);
  assert.equal(f.$('followup').hidden,true);assert.equal(f.c.activeAttempt,attempt);
});


test('live navigation works with a cached script that has no follow-up decoder', () => {
  const f=fixture(),first=f.c.current,second={...first,id:'exam-2023-2'};
  f.c.bank=[first,second];
  // This is the API surface of the script before follow-up sharing was added.
  f.c.window.LivePractice={unpack:require('./amc8_live_share.js').unpack};
  f.c.followedQuestion=null;f.c.followedFollowUp=null;f.c.current=null;f.c.displayed=[];
  f.c.show=p=>{f.c.current=p;f.c.displayed.push(p.id);};
  f.c.setLiveStatus=status=>{assert.fail('Unexpected live status: '+status);};
  const start=html.indexOf('onQuestion:data=>{');
  const callback=html.slice(start,html.indexOf('  }});',start)+3);
  vm.runInContext('var onLiveQuestion=({'+callback+'}).onQuestion;',f.c);
  f.c.onLiveQuestion({q:first.id});f.c.onLiveQuestion({q:second.id});
  assert.deepEqual(f.c.displayed,[first.id,second.id]);
  f.c.onLiveQuestion({q:second.id,f:{id:'followup-cached',...question}});
  assert.equal(f.$('followup-statement').textContent,question.text);
});

test('older Safari without Array.at or crypto.randomUUID can generate and receive follow-ups', async () => {
  const f=fixture();
  f.c.crypto={getRandomValues:require('node:crypto').webcrypto.getRandomValues.bind(require('node:crypto').webcrypto)};
  vm.runInContext('Array.prototype.at=undefined;',f.c);
  await f.submit();
  assert.equal(f.$('followup-content').hidden,false);
  assert.match(f.c.live.publications[f.c.live.publications.length-1].f.id,/^followup-[a-f0-9]{32}$/);
  f.c.live.role='follower';f.c.shared={id:'followup-older-safari',...question};
  vm.runInContext('showSharedFollowUp(shared)',f.c);
  f.$('followup-choices').children[1].onclick();f.$('followup-check').onclick();
  assert.match(f.$('followup-feedback').textContent,/Correct!/);
});

test('the page requests a versioned live-sharing script after an API change', () => {
  assert.match(html,/<script src="amc8_live_share\.js\?v=[^"\s]+"><\/script>/);
});
