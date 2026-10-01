const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

process.env.TZ = 'America/Vancouver';
const html = fs.readFileSync(`${__dirname}/amc8_practice.html`, 'utf8');
const core = html.match(/<script>\/\* Pure practice logic[\s\S]*?<\/script>/)[0]
  .replace(/^<script>|<\/script>$/g, '');
const context = { module: { exports: {} }, Date };
vm.runInNewContext(core, context);
const P = context.module.exports;
const ids = questions => Array.from(questions, p => p.id);
const fixture = () => ({ attempts: [], items: {} });
function attempt(state, id, at, correct, topic = 'Geometry', kind = 'exam') {
  state.attempts.push({ id, at, correct });
  state.items[id] = { problem: { id, topic, kind } };
}

test('seven local calendar days include today and cross month and DST boundaries', () => {
  assert.deepEqual(Array.from(P.pastDays(new Date('2026-11-03T12:00:00')), d => d.key),
    ['2026-11-03', '2026-11-02', '2026-11-01', '2026-10-31', '2026-10-30', '2026-10-29', '2026-10-28']);
  assert.equal(P.dayKey('2026-09-30T06:59:59Z'), '2026-09-29');
  assert.equal(P.dayKey('2026-09-30T07:00:00Z'), '2026-09-30');
});

test('day selection respects local midnight and deduplicates questions, newest first', () => {
  const state = fixture();
  attempt(state, 'before', '2026-09-30T06:59:59Z', false);
  attempt(state, 'first', '2026-09-30T07:00:00Z', false);
  attempt(state, 'second', '2026-09-30T10:00:00Z', true);
  attempt(state, 'first', '2026-09-30T12:00:00Z', false);
  attempt(state, 'after', '2026-10-01T07:00:00Z', false);
  assert.deepEqual(ids(P.dayQuestions(state, '2026-09-30')), ['first', 'second']);
});

test('optional exclusion uses latest answer, including retries on later days', () => {
  const state = fixture();
  attempt(state, 'corrected', '2026-09-29T12:00:00Z', false);
  attempt(state, 'missed-later', '2026-09-29T13:00:00Z', true);
  attempt(state, 'corrected', '2026-09-30T12:00:00Z', true);
  attempt(state, 'missed-later', '2026-09-30T13:00:00Z', false);
  assert.deepEqual(ids(P.dayQuestions(state, '2026-09-29')), ['missed-later', 'corrected']);
  assert.deepEqual(ids(P.dayQuestions(state, '2026-09-29', '', true)), ['missed-later']);
});

test('latest answer is determined by timestamp even if imported history is unordered', () => {
  const state = fixture();
  attempt(state, 'p', '2026-09-30T15:00:00Z', true);
  attempt(state, 'p', '2026-09-30T12:00:00Z', false);
  assert.deepEqual(ids(P.dayQuestions(state, '2026-09-30', '', true)), []);
});

test('topic filtering works for past-exam and original questions', () => {
  const state = fixture();
  attempt(state, 'exam', '2026-09-30T12:00:00Z', false);
  attempt(state, 'original', '2026-09-30T13:00:00Z', false, 'Algebra', 'generated');
  assert.deepEqual(ids(P.dayQuestions(state, '2026-09-30', 'Algebra')), ['original']);
  assert.deepEqual(ids(P.dayQuestions(state, '2026-09-30', 'Geometry')), ['exam']);
});

test('empty days, unavailable problems and invalid timestamps produce no questions', () => {
  const state = fixture();
  state.attempts.push({ id: 'unavailable', at: '2026-09-30T12:00:00Z', correct: false });
  attempt(state, 'invalid-date', 'not-a-date', false);
  assert.deepEqual(ids(P.dayQuestions(state, '2026-09-30')), []);
  assert.deepEqual(ids(P.dayQuestions(state, '2026-09-29')), []);
});

test('retrying a day question preserves first-attempt scoring and clears misses', () => {
  const state = fixture();
  const p = { id: 'p', topic: 'Geometry', kind: 'exam', level: 1, title: 'Question', answer: 'E' };
  P.record(state, p, 'A', 20);
  P.record(state, p, 'E', 10);
  assert.equal(state.attempts[1].review, true);
  assert.equal(P.stats(state, 'Geometry').total, 1);
  assert.equal(P.stats(state, 'Geometry').correct, 0);
  assert.equal(state.items.p.missed, false);
  assert.deepEqual(ids(P.dayQuestions(state, P.dayKey(new Date()), '', true)), []);
});
