# Dual Clock Firebase Availability Design

## Goal

Extend `vancouver_beijing_dual_clock.html` so a user can inspect the dual clock for a chosen Beijing or Vancouver calendar date and optionally replace that day's hardcoded Vancouver availability with ranges stored in Firebase.

## Agreed behavior

- Vancouver time is the canonical basis for availability and Firebase document IDs.
- A compact date toolbar lets the user choose Beijing or Vancouver as the input date basis, select a date, return to Today, and open availability editing.
- Today shows the live clock. A non-today date anchors the clock arrow and title at `00:00` in the selected city.
- Selecting a Beijing date produces one panel spanning midnight-to-midnight in Beijing. Because that interval normally overlaps two Vancouver calendar dates, the panel can read both corresponding Vancouver override documents while remaining one visual panel.
- Selecting a Vancouver date produces one panel anchored at Vancouver midnight, using that Vancouver date directly.
- Time conversion uses the IANA zones `America/Vancouver` and `Asia/Shanghai`, so Vancouver daylight-saving changes are reflected for the selected date.
- The existing hardcoded defaults remain the fallback:
  - Weekday: `06:00–07:30` and `18:00–22:00` Vancouver time.
  - Weekend: `06:00–22:00` Vancouver time.
- A Firebase override can contain one or more Vancouver-time ranges for one Vancouver date. An intentionally empty range list is a valid override meaning no availability that day.
- Deleting the override document restores the hardcoded weekday/weekend fallback.
- Time ranges use 30-minute boundaries. Starts run from `00:00` through `23:30`; ends run from `00:30` through the exclusive endpoint `24:00`. This permits an exact full-day `00:00–24:00` override without relying on a native time input that cannot represent `24:00`.

## Firebase architecture

Use the same Firebase project configuration and API-key workflow as `../todo/family_todo_login.html`:

- Load Firebase 9.23 compat app and Firestore scripts.
- Read an API key from `?apiKey=...` first and persist it to the existing `firebaseApiKey` local-storage key; otherwise use the stored key.
- Provide compact settings controls to save, test, clear, and share the API key.
- Store overrides in collection `dualClockAvailability` with one document per Vancouver date (`YYYY-MM-DD`).
- A document has this shape:

```json
{
  "app": "vancouver-beijing-dual-clock",
  "version": 1,
  "vancouverDate": "2026-07-17",
  "ranges": [
    { "start": "06:00", "end": "07:30" },
    { "start": "18:00", "end": "22:00" }
  ],
  "updatedAt": "ISO timestamp"
}
```

Subscribe to the one or two Vancouver-date documents intersected by the displayed panel interval. Changing the selected date unsubscribes from all old documents before subscribing to the new set. Snapshot absence selects the hardcoded fallback for that Vancouver date. Firebase failures leave the page usable with fallback rules and show a concise status message.

Saving uses `set`, and deleting a customization uses document `delete`. Ranges are validated locally before writes: 30-minute `HH:MM` boundaries, start earlier than end, no overlaps, and sorted by start time. Only an end may equal `24:00`. Ranges do not cross midnight; users represent cross-midnight availability as ranges on the respective Vancouver dates.

Remote snapshots go through the same validation before becoming display state. A valid document must have the expected `app`, supported `version`, a `vancouverDate` matching its document ID, a valid non-empty ISO `updatedAt`, and a valid `ranges` array (including an empty array). Malformed remote data is ignored for rendering, the hardcoded fallback remains visible for that date, and the UI reports a non-blocking data error.

## UI and data flow

The existing single circular panel remains. A small toolbar above it contains:

- a Beijing/Vancouver basis selector,
- a native date input,
- a Today button,
- an availability edit button,
- a settings button and synchronization status.

The availability editor appears as a simple inline section rather than a new page. It clearly names the Vancouver date being edited, identifies whether the current display is a Firebase customization or a default rule, and provides rows of start/end 30-minute selects with Add range, Save customization, and Delete customization actions. If a Beijing-based panel intersects two Vancouver dates, a small Vancouver-date selector chooses which one the editor modifies.

Date selection flow:

1. Resolve the selected city's local `00:00` and next local `00:00` to the panel's start/end instants (or keep the arrow at the current instant in live mode).
2. Build one elapsed-hour dial slot per instant in that interval and format every slot independently in both IANA time zones.
3. Collect the distinct Vancouver dates touched by those slots.
4. Subscribe to each corresponding override document.
5. For each slot/sector, render the rule for its Vancouver date: its valid override if present, otherwise that date's weekday/weekend default.

Availability sectors are generated dynamically from the displayed instant interval rather than fixed CSS gradients. Each Vancouver-local range boundary is converted to an instant and clipped to the panel interval before its conic-gradient stop is calculated. Labels are positioned near each resulting sector and include their Vancouver date/time when the panel spans two Vancouver dates.

## Date and DST handling

Browser `Intl.DateTimeFormat` supplies zone-local parts. A small conversion helper converts a wall-clock date/time in an IANA zone to an instant by iteratively correcting a UTC guess against formatted zone parts. Tests cover Vancouver standard/daylight time, Beijing-to-Vancouver date rollover, and both Vancouver DST transition dates.

Each dial position represents an elapsed-hour instant and independently formats its Vancouver and Beijing labels. A Vancouver-selected ordinary day has 24 positions, the spring-forward day has 23 (no nonexistent local hour), and the fall-back day has 25 (the repeated local hour appears twice with an offset disambiguator). A Beijing-selected day always has 24 positions, with Vancouver labels independently reflecting any transition. This avoids applying one offset to an entire transition day.

Range boundaries are resolved against their specific Vancouver date. On the spring-forward date, nonexistent `02:00` and `02:30` boundaries are disabled in the editor and make a remote document invalid rather than being silently normalized. On the fall-back date, a repeated start boundary selects its earlier occurrence and a repeated end boundary selects its later occurrence; therefore a range such as `01:00–02:00` includes both occurrences of the repeated hour. The wall-time conversion helper exposes explicit `earlier`/`later` disambiguation and sector tests cover both transition rules.

## Live and anchored state

The page has an explicit `liveMode` state:

- Initial load and the Today button enter live mode. The picker shows the current date in the selected basis and the arrow follows the current instant. Whenever the selected basis's local date changes, the page rebuilds the panel interval, picker, intersecting Vancouver-date set, and subscriptions; this handles Beijing midnight independently of Vancouver midnight.
- Any direct date-input change exits live mode, even if the chosen value happens to equal today's date. The arrow remains at `00:00` in the selected basis.
- While anchored, switching the Beijing/Vancouver basis first finds the new city's calendar date containing the old anchor, then re-anchors the panel at `00:00` on that date and rewrites the picker. While live, switching basis keeps live mode and simply shows that city's current date.

## Error handling

- No API key: show defaults and explain that Firebase customization is unavailable until configured.
- Loading: keep defaults visible until the snapshot resolves.
- Missing document: label the editor as using defaults.
- Invalid ranges: prevent saving and place a clear validation message beside the editor.
- Read/write failure: retain the last usable/default display and show a non-blocking error.
- Stale snapshots from a prior date are ignored by unsubscribing and checking the active Vancouver date.
- Malformed snapshot: reject it, keep that date's default rule, and identify the affected Vancouver date in status text.

## Testing and verification

The inline script exposes a small `window.dualClockCore` object containing pure range, date-zone, dial-slot, gradient-sector, fallback, and snapshot-validation functions. Page initialization and Firebase access remain outside that core and accept injectable `now` and Firestore adapters. The Node test evaluates the core in a `vm` context, while a small fake document reference exercises subscribe/set/delete behavior without a network or browser dependency.

Extend `vancouver_beijing_dual_clock.test.js` with behavior-oriented tests for:

- preserved weekday/weekend fallback ranges,
- dynamic gradient generation from minute ranges,
- range sorting/validation and empty override support,
- Vancouver-date document IDs,
- Firebase set/delete and snapshot fallback behavior,
- malformed remote document rejection,
- API-key URL/local-storage flow,
- Beijing and Vancouver date anchoring,
- ordinary +15/+16 offsets plus 23-hour and 25-hour DST transition dials,
- spring-gap rejection and fall-repeat availability-sector semantics,
- Today/live versus selected-date midnight display.

Run the Node test file, then open the page locally and verify desktop and narrow-screen layouts, date changes, editor actions, and the browser console.
