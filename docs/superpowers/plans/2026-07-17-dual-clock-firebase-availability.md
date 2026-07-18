# Dual Clock Firebase Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DST-correct date selection and per-Vancouver-date Firebase availability overrides to the existing Vancouver–Beijing dual clock.

**Architecture:** Keep the deliverable as one HTML file with two inline scripts: a UMD-style pure core exposed as `window.dualClockCore`, followed by a DOM/Firebase controller. The core owns timezone conversion, dial slots, range validation, availability sectors, snapshot validation, and an injectable override-store adapter; the controller owns rendering, live/anchored state, controls, and Firebase compat initialization.

**Tech Stack:** HTML/CSS, browser JavaScript, `Intl.DateTimeFormat`, Firebase 9.23 compat App/Firestore, Node.js built-in test runner and `vm`.

---

### Task 1: Pure time-zone and availability core

**Files:**
- Modify: `vancouver_beijing_dual_clock.html`
- Modify: `vancouver_beijing_dual_clock.test.js`
- Read-only reference: `/Users/chenguagnghui/tutor/todo/family_todo_login.html`

- [ ] **Step 1: Replace source-shape availability assertions with failing core tests**

Add a test helper that extracts `<script id="dualClockCoreSource">`, evaluates it in `vm` with `{ module: { exports: {} } }`, and returns the exports. Normalize cross-realm results before structural assertions with `const plain = value => JSON.parse(JSON.stringify(value));`. Add tests for:

```js
assert.deepEqual(plain(core.defaultRangesForWeekday("Mon")), [
  { start: "06:00", end: "07:30" },
  { start: "18:00", end: "22:00" }
]);
assert.deepEqual(plain(core.defaultRangesForWeekday("Sun")), [
  { start: "06:00", end: "22:00" }
]);
assert.equal(core.validateRanges([{ start: "00:00", end: "24:00" }], "2026-07-17").ok, true);
assert.equal(core.validateRanges([{ start: "07:00", end: "06:00" }], "2026-07-17").ok, false);
assert.equal(core.validateRanges([
  { start: "06:00", end: "08:00" },
  { start: "07:30", end: "09:00" }
], "2026-07-17").ok, false);
```

Pass the Vancouver date to validation tests. Assert unsorted non-overlapping input returns a sorted copy, while overlap is rejected. Add deterministic date tests for Vancouver midnight in winter/summer, Beijing midnight resolving to the prior Vancouver date, 23/25-hour Vancouver transition days, and repeated fall-hour slots carrying distinguishable UTC offsets.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test vancouver_beijing_dual_clock.test.js`

Expected: FAIL because `dualClockCoreSource` and its exported functions do not exist.

- [ ] **Step 3: Implement the minimal inline core**

Add a UMD wrapper exporting constants and pure functions:

```js
const ZONES = { Vancouver: "America/Vancouver", Beijing: "Asia/Shanghai" };
const DEFAULT_WEEKDAY_RANGES = [
  { start: "06:00", end: "07:30" },
  { start: "18:00", end: "22:00" }
];
const DEFAULT_WEEKEND_RANGES = [{ start: "06:00", end: "22:00" }];

return {
  getZonedParts,
  zonedDateTimeToInstant,
  buildPanel,
  validateRanges,
  defaultRangesForWeekday
};
```

`buildPanel(basis, dateText)` resolves consecutive local midnights and emits elapsed-hour slots, independently formatting both cities. `validateRanges(ranges, vancouverDate)` sorts a copied list, rejects overlap after sorting, enforces 30-minute half-open boundaries, permits `24:00` only as an end, and rejects nonexistent spring-forward boundaries for that date. It returns `{ ok, ranges, error }`; editor saves always use its normalized `ranges` result.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test vancouver_beijing_dual_clock.test.js`

Expected: all pure-core and preserved structural tests pass.

- [ ] **Step 5: Commit**

```bash
git add vancouver_beijing_dual_clock.html vancouver_beijing_dual_clock.test.js
git commit -m "feat: add dual clock date and range core"
```

### Task 2: Dynamic panel and availability rendering

**Files:**
- Modify: `vancouver_beijing_dual_clock.html`
- Modify: `vancouver_beijing_dual_clock.test.js`

- [ ] **Step 1: Write failing rendering-model tests**

Test the not-yet-exported `buildAvailabilitySegments(panel, overrideMap)` for weekday defaults, weekend defaults, empty overrides, Beijing panels crossing two Vancouver dates, spring gaps, adjacent fall ranges, and a `01:00–01:30` fall range producing two disjoint sectors. Assert gradient stops are calculated as percentages of the actual 23/24/25-hour panel duration and cross-date labels include Vancouver date and time.

- [ ] **Step 2: Run and verify RED**

Run: `node --test vancouver_beijing_dual_clock.test.js`

Expected: FAIL because dynamic segments/gradient behavior is absent.

- [ ] **Step 3: Implement the segment core and dynamic dial DOM**

Export `buildAvailabilitySegments`. It walks the panel in 30-minute instants, applies the relevant Vancouver date's normalized half-open wall-time rules, combines only contiguous available steps, and returns segment percentages and label text. Replace the fixed 24-hour DOM build with `renderDial(panel)`. Rebuild hour nodes when panel identity changes, use slot count for polar angles, disambiguate repeated Vancouver hours with a compact offset suffix, and render one CSS conic gradient plus generated `.availability-label` nodes. Preserve click/keyboard selection and live Beijing badge behavior.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test vancouver_beijing_dual_clock.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vancouver_beijing_dual_clock.html vancouver_beijing_dual_clock.test.js
git commit -m "feat: render date-aware dual clock panels"
```

### Task 3: Date toolbar and live/anchored state

**Files:**
- Modify: `vancouver_beijing_dual_clock.html`
- Modify: `vancouver_beijing_dual_clock.test.js`

- [ ] **Step 1: Write failing controller/state tests**

Add source assertions for `basisSelect`, `dateInput`, and `todayBtn`. Add behavior tests for a not-yet-exported pure state API:

```js
const state = core.createViewState({ basis: "Vancouver", now: () => fixedNow });
const next = core.reduceViewState(state, { type: "SELECT_DATE", date: state.date }, fixedNow);
assert.equal(next.liveMode, false); // selecting today directly is still anchored
```

Also behavior-test `TODAY`, anchored `SET_BASIS`, live `SET_BASIS`, and `TICK` crossing Beijing midnight before Vancouver midnight. The reducer accepts the current instant explicitly, so no test depends on the system clock.

- [ ] **Step 2: Run and verify RED**

Run: `node --test vancouver_beijing_dual_clock.test.js`

Expected: FAIL because the controls/state do not exist.

- [ ] **Step 3: Add compact controls and state transitions**

Export `createViewState({ basis, now })` and `reduceViewState(state, action, nowInstant)` from the core. Add a conventional toolbar above the clock and make the DOM controller render solely from this state. Initial load and Today set `liveMode = true`; date changes set it false and anchor at selected-basis midnight. Basis changes keep live mode if live; when anchored, re-anchor to midnight of the new city's date containing the prior anchor. Each one-second `TICK` detects selected-basis date rollover and marks the panel/subscriptions for rebuild.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test vancouver_beijing_dual_clock.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vancouver_beijing_dual_clock.html vancouver_beijing_dual_clock.test.js
git commit -m "feat: add dual clock date navigation"
```

### Task 4: Firebase API-key setup and isolated date documents

**Files:**
- Modify: `vancouver_beijing_dual_clock.html`
- Modify: `vancouver_beijing_dual_clock.test.js`

- [ ] **Step 1: Write failing Firebase adapter tests**

Define tests against this not-yet-exported contract:

```js
const store = core.createOverrideStore({
  docRefForDate,
  now: () => "2026-07-17T12:00:00.000Z",
  onUpdate: (date, value) => updates.push({ date, value }),
  onError: (date, error) => errors.push({ date, error })
});
store.setDates(["2026-07-16", "2026-07-17"]);
```

Use fake refs with `onSnapshot(success, failure)`, `set`, and `delete` counters. Assert unique-date subscription, old-listener unsubscription, generation-token rejection of callbacks fired after unsubscribe, snapshot-error retention of the last usable/default state, exact save payload fields/order, and date-isolated deletion. Test every malformed condition: wrong `app`, unsupported version, document-ID/date mismatch, invalid ISO timestamp, non-array/invalid/overlapping ranges, and spring-gap boundaries. Test missing snapshots and a valid empty `ranges` override separately.

Add failing behavior tests for pure API-key helpers with fake location/storage: URL key wins and persists, stored key is fallback, clear removes it, and `buildShareUrl` preserves only path plus encoded key. Keep source assertions for Firebase 9.23 compat scripts and copied project identifiers.

- [ ] **Step 2: Run and verify RED**

Run: `node --test vancouver_beijing_dual_clock.test.js`

Expected: FAIL because the adapter and Firebase setup are absent.

- [ ] **Step 3: Implement Firebase sync**

Export `validateOverrideDocument(data, documentId)`, the API-key helpers, and `createOverrideStore({ docRefForDate, now, onUpdate, onError })`. `setDates` increments a generation, unsubscribes old refs, deduplicates dates, and captures the generation in success/error callbacks. `save(date, ranges)` revalidates and writes exactly `{ app, version, vancouverDate, ranges: normalizedRanges, updatedAt: now() }`; `remove(date)` deletes only that ref.

Load the compat scripts, initialize the same project as the family todo page, and connect the store to `db.collection("dualClockAvailability").doc(vancouverDate)`. Implement tested API-key read/save/test/clear/share actions. Keep defaults or the last usable state visible when unconfigured/failed. Error status identifies the affected Vancouver date.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test vancouver_beijing_dual_clock.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vancouver_beijing_dual_clock.html vancouver_beijing_dual_clock.test.js
git commit -m "feat: sync clock availability with Firebase"
```

### Task 5: Availability editor and final verification

**Files:**
- Modify: `vancouver_beijing_dual_clock.html`
- Modify: `vancouver_beijing_dual_clock.test.js`

- [ ] **Step 1: Write failing editor tests**

Assert the editor exposes the intersecting Vancouver-date selector, customization/default source text, range rows, Add, Save, and Delete actions; contains a `24:00` end option; supports saving an empty override; disables spring-gap boundaries; sorts unsorted rows before save; and reports invalid ranges without a write. Cover loading, default, customized, saved, malformed-data-with-date, and write-error status text.

- [ ] **Step 2: Run and verify RED**

Run: `node --test vancouver_beijing_dual_clock.test.js`

Expected: FAIL because editor controls and handlers are absent.

- [ ] **Step 3: Implement the inline editor and statuses**

Render editable rows from the selected Vancouver date's current override or copied defaults. Use 30-minute selects, Add/remove-row controls, Save customization via `set`, and Delete customization via document `delete`. An empty row list remains saveable. Pass rows through `validateRanges(ranges, selectedVancouverDate)` and save its sorted copy. Disable nonexistent spring-forward values and display concise loading/saved/error/fallback statuses, including the Vancouver date for malformed remote data.

- [ ] **Step 4: Run the complete automated suite**

Run: `node --test vancouver_beijing_dual_clock.test.js`

Expected: all tests pass with zero failures.

- [ ] **Step 5: Run static checks**

Run: `git diff --check`

Expected: no output and exit 0.

- [ ] **Step 6: Perform browser verification**

Run: `python3 -m http.server 8765 --bind 127.0.0.1`

Open: `http://127.0.0.1:8765/vancouver_beijing_dual_clock.html`

At 1280×900 and 390×844, verify no-key fallback and a clean console; Today/live mode; Vancouver `2026-01-15` (+16) and `2026-07-15` (+15); Vancouver spring `2026-03-08` (23 slots) and fall `2026-11-01` (25 slots/repeated offset labels); Beijing `2026-07-18` (one panel, two Vancouver dates and date/time sector labels); add/remove/empty editor rows; and invalid-range feedback. If a real key is available, manually verify save/delete; otherwise the fake-adapter tests are the authoritative write verification.

- [ ] **Step 7: Commit**

```bash
git add vancouver_beijing_dual_clock.html vancouver_beijing_dual_clock.test.js
git commit -m "feat: edit per-day clock availability"
```
