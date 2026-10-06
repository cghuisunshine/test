const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(`${__dirname}/amc8_practice.html`, 'utf8');
const core = html.match(/<script>\/\* Pure practice logic[\s\S]*?<\/script>/)[0]
  .replace(/^<script>|<\/script>$/g, '');
const context = { module: { exports: {} }, Date };
vm.runInNewContext(fs.readFileSync(`${__dirname}/amc8_activity.js`, 'utf8'), context);
vm.runInNewContext(core, context);
const P = context.module.exports;
const bank = JSON.parse(html.match(/<script id="exam-bank" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const question = (year, number) => ({ id: `exam-${year}-${number}`, year, kind: 'exam', topic: 'Geometry', level: 1, answer: 'E', title: `${year} problem ${number}` });

test('year practice selects all topics and sorts numerically without changing the bank', () => {
  const source = [question(2023, 25), question(2022, 1), question(2023, 10), question(2023, 2), { ...question(2023, 3), kind: 'generated' }];
  const original = source.slice();
  assert.deepEqual(Array.from(P.yearQuestions(source, '2023'), P.problemNumber), [2, 10, 25]);
  assert.deepEqual(source, original);
  assert.equal(P.yearQuestions(source, 'unknown').length, 0);
});

test('year choices are newest first and identify actual missing problem numbers', () => {
  const source = Array.from({ length: 25 }, (_, i) => question(2023, i + 1));
  source.push(question(2026, 1), question(2026, 3));
  const years = P.examYears(source);
  assert.deepEqual(Array.from(years, y => y.year), [2026, 2023]);
  assert.equal(years[0].count, 2);
  assert.ok(years[0].missing.includes(2));
  assert.ok(!years[0].missing.includes(3));
  assert.equal(years[1].count, 25);
  assert.equal(years[1].missing.length, 0);
});

test('every complete cached year contains exactly problems 1–25 in order', () => {
  const complete = P.examYears(bank).filter(y => !y.missing.length);
  assert.ok(complete.length > 0);
  for (const { year } of complete) {
    const questions = P.yearQuestions(bank, year);
    assert.equal(questions.length, 25);
    assert.deepEqual(Array.from(questions, P.problemNumber), Array.from({ length: 25 }, (_, i) => i + 1));
    assert.ok(questions.every(p => p.html && p.solution && /^[A-E]$/.test(p.answer)));
  }
});

test('year progress counts distinct answered problems and the latest retry, even with unordered history', () => {
  const questions = [question(2023, 1), question(2023, 2), question(2023, 3)];
  const state = { attempts: [
    { id: questions[0].id, correct: true, at: '2026-10-04T12:00:00Z' },
    { id: questions[0].id, correct: false, at: '2026-10-03T12:00:00Z' },
    { id: questions[1].id, correct: false, at: '2026-10-04T12:00:00Z' },
    { id: 'exam-2022-1', correct: true, at: '2026-10-04T12:00:00Z' },
    { id: questions[2].id, correct: true, at: 'invalid' }
  ] };
  const progress = P.yearProgress(state, questions);
  assert.equal(progress.answered, 2);
  assert.equal(progress.correct, 1);
  assert.equal(progress.latest.get(questions[0].id).correct, true);
});

test('year retries keep first-attempt accuracy and clear missed answers', () => {
  const state = { attempts: [], items: {} }, questions = [question(2023, 1)];
  P.record(state, questions[0], 'A', 20);
  P.record(state, questions[0], 'E', 10);
  assert.equal(P.yearProgress(state, questions).answered, 1);
  assert.equal(P.yearProgress(state, questions).correct, 1);
  assert.equal(P.stats(state).correct, 0);
  assert.equal(state.items[questions[0].id].missed, false);
});

test('new students and empty selections have no year progress', () => {
  assert.equal(P.yearProgress({ attempts: [] }, [question(2023, 1)]).answered, 0);
  assert.equal(P.yearProgress({ attempts: [] }, []).correct, 0);
});
