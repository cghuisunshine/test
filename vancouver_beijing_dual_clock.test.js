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

test("shows both 24-hour and Chinese 12-hour current times in the clock panel", () => {
  for (const id of ["vanTime", "vanTime12", "bjTime24", "bjTime12"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /vanTime12\.textContent=core\.formatChinese12HourTime\(vanTime24\)/);
  assert.match(html, /bjTime12\.textContent=core\.formatChinese12HourTime\(bjTime24Text\)/);
});

test("keeps the availability color clearly visible", () => {
  assert.match(html, /--available-soft:rgba\(32,164,100,\.55\)/);
});

test("provides sorted weekday and weekend fallback rules", () => {
  const core = loadCore();
  assert.deepEqual(plain(core.defaultRangesForWeekday("Mon")), [
    { start: "06:00", end: "07:15" },
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
    ["06:00", "07:15"],
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

test("builds a seven-day availability view from the current date forward", () => {
  const core = loadCore();
  const week = core.buildWeeklyAvailability("2026-08-13", {});
  assert.equal(week.start, "2026-08-13");
  assert.equal(week.end, "2026-08-19");
  assert.deepEqual(plain(week.days.map(day => day.weekday)), [
    "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"
  ]);
  assert.deepEqual(plain(week.days.map(day => day.ranges.length)), [2, 2, 1, 1, 2, 2, 2]);
});

test("shows the exact corresponding Beijing dates and times in the week", () => {
  const core = loadCore();
  const week = core.buildWeeklyAvailability("2026-08-13", {});
  assert.deepEqual(plain(week.days[0].ranges), [
    {
      vancouver: { startTime: "06:00", endTime: "07:15" },
      beijing: {
        startDate: "2026-08-13", startTime: "21:00",
        endDate: "2026-08-13", endTime: "22:15"
      }
    },
    {
      vancouver: { startTime: "20:45", endTime: "22:00" },
      beijing: {
        startDate: "2026-08-14", startTime: "11:45",
        endDate: "2026-08-14", endTime: "13:00"
      }
    }
  ]);
});

test("formats weekly availability with Chinese 12-hour conventions", () => {
  const core = loadCore();
  assert.equal(core.formatChinese12HourRange("06:00", "07:15"), "上午6:00–7:15");
  assert.equal(core.formatChinese12HourRange("11:45", "13:00"), "上午11:45–下午1:00");
  assert.equal(core.formatChinese12HourRange("18:00", "22:00"), "下午6:00–10:00");
  assert.equal(core.formatChinese12HourTime("00:00"), "上午12:00");
  assert.equal(core.formatChinese12HourTime("12:00"), "下午12:00");
  assert.equal(core.formatChinese12HourTime("24:00"), "上午12:00");
});

test("shows both time conventions on clock-panel availability labels", () => {
  assert.match(html, /time24\.textContent=segment\.label/);
  assert.match(html, /time12\.textContent=core\.formatChinese12HourRange\(segment\.startTime,segment\.endTime\)/);
  assert.match(html, /className='availability-time-24'/);
  assert.match(html, /className='availability-time-12'/);
});

test("weekly tables honor custom and empty Firebase overrides", () => {
  const core = loadCore();
  const week = core.buildWeeklyAvailability("2026-08-13", {
    "2026-08-13": [],
    "2026-08-14": [{ start: "09:00", end: "10:30" }]
  });
  assert.equal(week.days[0].overridden, true);
  assert.deepEqual(plain(week.days[0].ranges), []);
  assert.equal(week.days[1].overridden, true);
  assert.deepEqual(plain(week.days[1].ranges[0].vancouver), {
    startTime: "09:00", endTime: "10:30"
  });
});

test("places two weekly availability tables below the clock", () => {
  const clockPanel = html.indexOf('<section class="panel">');
  const weeklySection = html.indexOf('<section class="weekly-section"');
  assert.ok(clockPanel >= 0 && weeklySection > clockPanel);
  assert.match(html, /id="vancouverWeekBody"/);
  assert.match(html, /id="beijingWeekBody"/);
  assert.match(html, /每周可用时间/);
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

test("defaults the date basis control to browser-local time", () => {
  assert.match(html, /<option value="Local"[^>]*>本地/);
  assert.ok(html.indexOf('value="Local"') < html.indexOf('value="Vancouver"'));
});

test("resolves the browser IANA timezone with a UTC fallback", () => {
  const core = loadCore();
  const fakeIntl = {
    DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: "Asia/Tokyo" }) })
  };
  assert.equal(core.resolveLocalTimeZone(fakeIntl), "Asia/Tokyo");
  assert.equal(core.resolveLocalTimeZone({ DateTimeFormat: () => { throw new Error("no zone"); } }), "UTC");
  assert.equal(core.resolveLocalTimeZone({ DateTimeFormat: () => ({ resolvedOptions: () => ({}) }) }), "UTC");
});

test("shows Vancouver or Beijing instead of an IANA name for local basis", () => {
  const core = loadCore();
  assert.equal(core.localTimeZoneLabel("America/Vancouver"), "温哥华");
  assert.equal(core.localTimeZoneLabel("Canada/Pacific"), "温哥华");
  assert.equal(core.localTimeZoneLabel("Asia/Shanghai"), "北京");
  assert.equal(core.localTimeZoneLabel("Asia/Chongqing"), "北京");
});

test("uses browser-local time as the default date and midnight basis", () => {
  const core = loadCore();
  core.setLocalTimeZone("America/Toronto");
  const fixedNow = new Date("2026-07-18T03:30:00.000Z");
  const state = core.createViewState({ now: () => fixedNow });
  assert.equal(state.basis, "Local");
  assert.equal(state.date, "2026-07-17");

  const anchored = core.reduceViewState(state, { type: "SELECT_DATE", date: "2026-07-17" }, fixedNow);
  assert.equal(core.getZonedParts(new Date(anchored.anchor), "America/Toronto").hour, "00");
  assert.equal(core.buildPanel("Local", "2026-03-08").durationHours, 23);
});

test("refreshes at local midnight and keeps Vancouver dates canonical", () => {
  const core = loadCore();
  core.setLocalTimeZone("America/Toronto");
  const before = new Date("2026-07-18T03:59:00.000Z");
  const after = new Date("2026-07-18T04:01:00.000Z");
  const state = core.createViewState({ now: () => before });
  const next = core.reduceViewState(state, { type: "TICK" }, after);
  assert.equal(state.date, "2026-07-17");
  assert.equal(next.date, "2026-07-18");
  assert.deepEqual(plain(core.buildPanel("Local", "2026-07-18").vancouverDates), [
    "2026-07-17", "2026-07-18"
  ]);
});

test("formats the visible and browser titles with times only", () => {
  const core = loadCore();
  const title = core.formatClockTitle(
    { hour: "08", minute: "30", date: "2026-07-18" },
    { hour: "17", minute: "30", date: "2026-07-17" }
  );
  assert.equal(title, "北京 08:30 - 温哥华 17:30");
  assert.doesNotMatch(title, /\d{4}-\d{2}-\d{2}/);
  assert.match(html, /id="bjDate"/);
  assert.match(html, /id="vanDate"/);
});

test("hides the live pointer and Beijing badge for anchored dates", () => {
  assert.match(html, /hand\.hidden\s*=\s*!viewState\.liveMode/);
  assert.match(html, /bjBadge\.hidden\s*=\s*!viewState\.liveMode/);
  assert.match(html, /\.hand\[hidden\],\.badge\[hidden\]\{display:none\}/);
});

function createFakeRefs() {
  const refs = new Map();
  function docRefForDate(date) {
    if (!refs.has(date)) {
      const ref = {
        writes: [], deletes: 0, listeners: [],
        onSnapshot(success, failure) {
          const listener = { success, failure, unsubscribed: false };
          this.listeners.push(listener);
          return () => { listener.unsubscribed = true; };
        },
        set(payload) { this.writes.push(payload); return Promise.resolve(); },
        delete() { this.deletes += 1; return Promise.resolve(); }
      };
      refs.set(date, ref);
    }
    return refs.get(date);
  }
  return { refs, docRefForDate };
}

function validOverride(date, ranges = [{ start: "06:00", end: "07:30" }]) {
  return {
    app: "vancouver-beijing-dual-clock",
    version: 1,
    vancouverDate: date,
    ranges,
    updatedAt: "2026-07-17T12:00:00.000Z"
  };
}

test("loads Firebase compat and uses the family Firebase project", () => {
  assert.match(html, /firebasejs\/9\.23\.0\/firebase-app-compat\.js/);
  assert.match(html, /firebasejs\/9\.23\.0\/firebase-firestore-compat\.js/);
  assert.match(html, /projectId:\s*['"]homeinventory-4718c['"]/);
  assert.match(html, /FIREBASE_API_KEY_KEY\s*=\s*['"]firebaseApiKey['"]/);
});

test("validates every field in remote override documents", () => {
  const core = loadCore();
  assert.equal(core.validateOverrideDocument(validOverride("2026-07-17"), "2026-07-17").ok, true);
  assert.equal(core.validateOverrideDocument(validOverride("2026-07-17", []), "2026-07-17").ok, true);
  const invalid = [
    { ...validOverride("2026-07-17"), app: "wrong" },
    { ...validOverride("2026-07-17"), version: 2 },
    { ...validOverride("2026-07-17"), vancouverDate: "2026-07-18" },
    { ...validOverride("2026-07-17"), updatedAt: "yesterday" },
    { ...validOverride("2026-07-17"), ranges: "06:00-07:30" },
    validOverride("2026-07-17", [{ start: "06:00", end: "08:00" }, { start: "07:30", end: "09:00" }]),
    validOverride("2026-03-08", [{ start: "02:00", end: "03:00" }])
  ];
  for (const document of invalid) {
    assert.equal(core.validateOverrideDocument(document, document.vancouverDate === "2026-07-18" ? "2026-07-17" : document.vancouverDate).ok, false);
  }
});

test("subscribes by Vancouver date and ignores stale callbacks", () => {
  const core = loadCore();
  const fake = createFakeRefs();
  const updates = [], errors = [];
  const store = core.createOverrideStore({
    docRefForDate: fake.docRefForDate,
    now: () => "2026-07-17T12:00:00.000Z",
    onUpdate: (date, value) => updates.push({ date, value }),
    onError: (date, error) => errors.push({ date, error: error.message })
  });
  store.setDates(["2026-07-16", "2026-07-17", "2026-07-17"]);
  assert.equal(fake.refs.get("2026-07-17").listeners.length, 1);
  const old = fake.refs.get("2026-07-16").listeners[0];
  store.setDates(["2026-07-17"]);
  assert.equal(old.unsubscribed, true);
  old.success({ exists: true, data: () => validOverride("2026-07-16") });
  assert.equal(updates.length, 0);

  const active = fake.refs.get("2026-07-17").listeners.at(-1);
  active.success({ exists: false, data: () => ({}) });
  assert.deepEqual(plain(updates.at(-1)), { date: "2026-07-17", value: null });
  active.failure(new Error("offline"));
  assert.deepEqual(plain(errors.at(-1)), { date: "2026-07-17", error: "offline" });
});

test("writes sorted exact payloads and deletes only one date", async () => {
  const core = loadCore();
  const fake = createFakeRefs();
  const store = core.createOverrideStore({
    docRefForDate: fake.docRefForDate,
    now: () => "2026-07-17T12:00:00.000Z",
    onUpdate() {}, onError() {}
  });
  await store.save("2026-07-17", [
    { start: "18:00", end: "22:00" },
    { start: "06:00", end: "07:30" }
  ]);
  assert.deepEqual(plain(fake.refs.get("2026-07-17").writes[0]), validOverride("2026-07-17", [
    { start: "06:00", end: "07:30" },
    { start: "18:00", end: "22:00" }
  ]));
  await store.remove("2026-07-17");
  assert.equal(fake.refs.get("2026-07-17").deletes, 1);
  assert.equal(fake.refs.has("2026-07-18"), false);
});

test("handles Firebase API keys through URL and storage", () => {
  const core = loadCore();
  const values = new Map([["firebaseApiKey", "stored-key"]]);
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  const fromUrl = core.resolveFirebaseApiKey({ search: "?apiKey=url-key" }, storage);
  assert.equal(fromUrl, "url-key");
  assert.equal(values.get("firebaseApiKey"), "url-key");
  assert.equal(core.resolveFirebaseApiKey({ search: "" }, storage), "url-key");
  core.clearFirebaseApiKey(storage);
  assert.equal(values.has("firebaseApiKey"), false);
  assert.equal(core.buildShareUrl({ origin: "https://example.test", pathname: "/clock.html" }, "a+b"), "https://example.test/clock.html?apiKey=a%2Bb");
});

test("provides availability editor and Firebase settings controls", () => {
  for (const id of [
    "editAvailabilityBtn", "availabilityEditor", "editorDateSelect", "rangeRows",
    "addRangeBtn", "saveOverrideBtn", "deleteOverrideBtn", "editorStatus",
    "settingsBtn", "settingsPanel", "firebaseKeyInput", "saveFirebaseKeyBtn",
    "testFirebaseBtn", "clearFirebaseKeyBtn", "shareFirebaseBtn"
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("places the availability editor before the tall clock panel", () => {
  assert.ok(html.indexOf('id="availabilityEditor"') < html.indexOf('<section class="panel">'));
  assert.match(html, /availabilityEditor\.scrollIntoView/);
});

test("offers half-hour choices, 24:00 ends, and disables spring gaps", () => {
  const core = loadCore();
  const starts = core.timeOptionsForDate("2026-03-08", "start");
  const ends = core.timeOptionsForDate("2026-03-08", "end");
  assert.equal(starts.find(option => option.value === "02:00").disabled, true);
  assert.equal(starts.find(option => option.value === "02:30").disabled, true);
  assert.equal(ends.find(option => option.value === "24:00").disabled, false);
});

test("keeps empty overrides valid and invalid ranges write-free", async () => {
  const core = loadCore();
  const fake = createFakeRefs();
  const store = core.createOverrideStore({
    docRefForDate: fake.docRefForDate,
    now: () => "2026-07-17T12:00:00.000Z",
    onUpdate() {}, onError() {}
  });
  await store.save("2026-07-17", []);
  assert.deepEqual(plain(fake.refs.get("2026-07-17").writes[0].ranges), []);
  await assert.rejects(store.save("2026-07-17", [
    { start: "08:00", end: "09:00" },
    { start: "08:30", end: "10:00" }
  ]));
  assert.equal(fake.refs.get("2026-07-17").writes.length, 1);
});

test("contains clear synchronization and data-source status messages", () => {
  assert.match(html, /正在加载/);
  assert.match(html, /使用默认规则/);
  assert.match(html, /Firebase 自定义/);
  assert.match(html, /已保存/);
  assert.match(html, /数据无效/);
  assert.match(html, /保存失败/);
});
