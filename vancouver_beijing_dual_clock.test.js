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

test("uses a clearly visible green fill for the most available sector", () => {
  assert.match(html, /--available-soft:rgba\(32,164,100,\.55\)/);
});

test("shows both Vancouver availability ranges on the ring", () => {
  assert.match(
    html,
    /background:conic-gradient\(from 0deg,transparent 0 25%,var\(--available-soft\) 25% 31\.25%,transparent 31\.25% 75%,var\(--available-soft\) 75% 91\.6667%,transparent 91\.6667% 100%\)/
  );
});

test("places a concise availability label at the green sector", () => {
  assert.match(html, /\.availability-label\{\s*position:absolute;left:29\.5%;top:38\.2%/);
  assert.match(html, /\.availability-label\{[^}]*transform:translate\(-50%,-50%\)[^}]*\}/);
  assert.match(html, /<div class="availability-label">较可能有空<\/div>/);
  assert.doesNotMatch(html, /较可能有空：18:00–22:00/);
});

test("labels the morning availability range", () => {
  assert.match(html, /\.availability-label\.morning\{left:73\.2%;top:54\.6%\}/);
  assert.equal(
    (html.match(/<div class="availability-label(?: morning)?">较可能有空<\/div>/g) || []).length,
    2
  );
});

test("recognizes Saturday and Sunday as weekend days", () => {
  assert.match(
    html,
    /function isWeekend\(weekday\)\{\s*return weekday==='Sat'\|\|weekday==='Sun';\s*\}/
  );
});

test("switches availability using the displayed Vancouver weekday", () => {
  assert.match(
    html,
    /clock\.classList\.toggle\('weekend',isWeekend\(van\.weekday\)\);/
  );
});

test("marks 06:00 through 22:00 as continuously available on weekends", () => {
  assert.match(
    html,
    /\.clock\.weekend \.availability-ring\{\s*background:conic-gradient\(from 0deg,transparent 0 25%,var\(--available-soft\) 25% 91\.6667%,transparent 91\.6667% 100%\);\s*\}/
  );
});

test("shows one repositioned availability label on weekends", () => {
  assert.match(html, /\.clock\.weekend \.availability-label\{left:35%;top:76%\}/);
  assert.match(html, /\.clock\.weekend \.availability-label\.morning\{display:none\}/);
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
