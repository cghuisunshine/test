const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(
  path.join(__dirname, "vancouver_beijing_dual_clock.html"),
  "utf8"
);

const plain = value => JSON.parse(JSON.stringify(value));

function loadCore() {
  const match = html.match(/<script id="dualClockCoreSource">([\s\S]*?)<\/script>/);
  assert.ok(match, "inline dual clock core script should exist");
  const context = { module: { exports: {} }, exports: {}, Intl, Date, URL, URLSearchParams };
  vm.createContext(context);
  vm.runInContext(match[1], context);
  return context.module.exports;
}

test("shows the live Vancouver time only in the center", () => {
  assert.match(html, /id="vanTime"/);
  assert.doesNotMatch(html, /id="vanBadge"/);
  assert.doesNotMatch(html, /getElementById\('vanBadge'\)/);
});

test("shows the live Beijing time only on the arrow", () => {
  assert.match(html, /id="bjBadge"/);
  assert.doesNotMatch(html, /id="bjTime"/);
  assert.doesNotMatch(html, /getElementById\('bjTime'\)/);
});

test("keeps the availability color clearly visible", () => {
  assert.match(html, /--available-soft:rgba\(32,164,100,\.55\)/);
});

test("provides sorted weekday and weekend fallback rules", () => {
  const core = loadCore();
  assert.deepEqual(plain(core.defaultRangesForWeekday("Mon")), [
    { start: "06:00", end: "07:30" },
    { start: "18:00", end: "22:00" }
  ]);
  assert.deepEqual(plain(core.defaultRangesForWeekday("Sun")), [
    { start: "06:00", end: "22:00" }
  ]);
});

test("validates and sorts half-hour Vancouver ranges", () => {
  const core = loadCore();
  assert.equal(core.validateRanges([{ start: "00:00", end: "24:00" }], "2026-07-17").ok, true);
  assert.equal(core.validateRanges([{ start: "07:00", end: "06:00" }], "2026-07-17").ok, false);
  assert.equal(core.validateRanges([
    { start: "06:00", end: "08:00" },
    { start: "07:30", end: "09:00" }
  ], "2026-07-17").ok, false);
  const sorted = core.validateRanges([
    { start: "18:00", end: "22:00" },
    { start: "06:00", end: "07:30" }
  ], "2026-07-17");
  assert.equal(sorted.ok, true);
  assert.deepEqual(plain(sorted.ranges), [
    { start: "06:00", end: "07:30" },
    { start: "18:00", end: "22:00" }
  ]);
});

test("rejects nonexistent spring-forward range boundaries", () => {
  const core = loadCore();
  assert.equal(core.validateRanges([{ start: "02:00", end: "03:00" }], "2026-03-08").ok, false);
  assert.equal(core.validateRanges([{ start: "01:30", end: "02:30" }], "2026-03-08").ok, false);
});

test("builds DST-aware Vancouver and Beijing day panels", () => {
  const core = loadCore();
  const winter = core.buildPanel("Vancouver", "2026-01-15");
  const summer = core.buildPanel("Vancouver", "2026-07-15");
  const spring = core.buildPanel("Vancouver", "2026-03-08");
  const fall = core.buildPanel("Vancouver", "2026-11-01");
  const beijing = core.buildPanel("Beijing", "2026-07-18");

  assert.equal(winter.durationHours, 24);
  assert.equal(summer.durationHours, 24);
  assert.equal(spring.durationHours, 23);
  assert.equal(fall.durationHours, 25);
  assert.equal(beijing.durationHours, 24);
  assert.equal(beijing.vancouverDates[0], "2026-07-17");

  const repeated = fall.slots.filter(slot => slot.vancouver.hour === "01");
  assert.equal(repeated.length, 2);
  assert.notEqual(repeated[0].vancouver.offset, repeated[1].vancouver.offset);
});

test("builds dynamic weekday, weekend, and empty-override sectors", () => {
  const core = loadCore();
  const weekday = core.buildPanel("Vancouver", "2026-07-17");
  const weekend = core.buildPanel("Vancouver", "2026-07-18");
  const weekdaySegments = core.buildAvailabilitySegments(weekday, {});
  const weekendSegments = core.buildAvailabilitySegments(weekend, {});
  const emptySegments = core.buildAvailabilitySegments(weekday, { "2026-07-17": [] });

  assert.deepEqual(plain(weekdaySegments.map(segment => [segment.startTime, segment.endTime])), [
    ["06:00", "07:30"],
    ["18:00", "22:00"]
  ]);
  assert.deepEqual(plain(weekendSegments.map(segment => [segment.startTime, segment.endTime])), [
    ["06:00", "22:00"]
  ]);
  assert.deepEqual(plain(emptySegments), []);
});

test("uses both Vancouver dates and dated labels on a Beijing panel", () => {
  const core = loadCore();
  const panel = core.buildPanel("Beijing", "2026-07-18");
  const segments = core.buildAvailabilitySegments(panel, {});
  assert.deepEqual(plain(panel.vancouverDates), ["2026-07-17", "2026-07-18"]);
  assert.ok(segments.some(segment => segment.label.includes("2026-07-17")));
  assert.ok(segments.some(segment => segment.label.includes("2026-07-18")));
});

test("renders repeated fall ranges as disjoint non-overlapping sectors", () => {
  const core = loadCore();
  const panel = core.buildPanel("Vancouver", "2026-11-01");
  const repeated = core.buildAvailabilitySegments(panel, {
    "2026-11-01": [{ start: "01:00", end: "01:30" }]
  });
  assert.equal(repeated.length, 2);
  assert.ok(repeated.every(segment => segment.endPct - segment.startPct === 2));

  const adjacent = core.buildAvailabilitySegments(panel, {
    "2026-11-01": [
      { start: "00:00", end: "01:00" },
      { start: "01:00", end: "02:00" }
    ]
  });
  assert.equal(adjacent.reduce((sum, segment) => sum + segment.endPct - segment.startPct, 0), 12);
});

test("uses actual spring-day duration for sector percentages", () => {
  const core = loadCore();
  const panel = core.buildPanel("Vancouver", "2026-03-08");
  const segments = core.buildAvailabilitySegments(panel, {
    "2026-03-08": [{ start: "03:00", end: "04:00" }]
  });
  assert.equal(panel.durationHours, 23);
  assert.ok(Math.abs((segments[0].endPct - segments[0].startPct) - 100 / 23) < 0.0001);
});

test("includes date-basis, date, and Today controls", () => {
  assert.match(html, /id="basisSelect"/);
  assert.match(html, /id="dateInput"/);
  assert.match(html, /id="todayBtn"/);
});

test("models live and explicitly anchored date selection", () => {
  const core = loadCore();
  const fixedNow = new Date("2026-07-17T15:00:00.000Z");
  const state = core.createViewState({ basis: "Vancouver", now: () => fixedNow });
  assert.equal(state.liveMode, true);
  assert.equal(state.date, "2026-07-17");

  const anchored = core.reduceViewState(state, { type: "SELECT_DATE", date: state.date }, fixedNow);
  assert.equal(anchored.liveMode, false);
  assert.equal(anchored.date, "2026-07-17");

  const liveAgain = core.reduceViewState(anchored, { type: "TODAY" }, fixedNow);
  assert.equal(liveAgain.liveMode, true);
});

test("switches basis consistently in live and anchored modes", () => {
  const core = loadCore();
  const fixedNow = new Date("2026-07-17T15:00:00.000Z");
  const live = core.createViewState({ basis: "Vancouver", now: () => fixedNow });
  const liveBeijing = core.reduceViewState(live, { type: "SET_BASIS", basis: "Beijing" }, fixedNow);
  assert.equal(liveBeijing.liveMode, true);
  assert.equal(liveBeijing.date, "2026-07-17");

  const anchored = core.reduceViewState(live, { type: "SELECT_DATE", date: "2026-07-17" }, fixedNow);
  const anchoredBeijing = core.reduceViewState(anchored, { type: "SET_BASIS", basis: "Beijing" }, fixedNow);
  assert.equal(anchoredBeijing.liveMode, false);
  assert.equal(anchoredBeijing.date, "2026-07-17");
  assert.equal(core.getZonedParts(new Date(anchoredBeijing.anchor), core.ZONES.Beijing).hour, "00");
});

test("rebuilds live state when the selected basis crosses midnight", () => {
  const core = loadCore();
  const before = new Date("2026-07-17T15:59:00.000Z");
  const after = new Date("2026-07-17T16:01:00.000Z");
  const state = core.createViewState({ basis: "Beijing", now: () => before });
  const next = core.reduceViewState(state, { type: "TICK" }, after);
  assert.equal(state.date, "2026-07-17");
  assert.equal(next.date, "2026-07-18");
  assert.equal(next.panelRevision, state.panelRevision + 1);
});
