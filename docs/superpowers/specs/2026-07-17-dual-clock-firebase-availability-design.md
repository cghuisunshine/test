# Dual Clock Firebase Availability Design

## Goal

Extend `vancouver_beijing_dual_clock.html` so a user can inspect the dual clock for a chosen Beijing or Vancouver calendar date and optionally replace that day's hardcoded Vancouver availability with ranges stored in Firebase.

## Agreed behavior

- Vancouver time is the canonical basis for availability and Firebase document IDs.
- A compact date toolbar lets the user choose Beijing or Vancouver as the input date basis, select a date, return to Today, and open availability editing.
- Today shows the live clock. A non-today date anchors the clock arrow and title at `00:00` in the selected city.
- Selecting a Beijing date produces one panel anchored at Beijing midnight. The Vancouver date containing that instant becomes the availability date and Firebase document ID.
- Selecting a Vancouver date produces one panel anchored at Vancouver midnight, using that Vancouver date directly.
- Time conversion uses the IANA zones `America/Vancouver` and `Asia/Shanghai`, so Vancouver daylight-saving changes are reflected for the selected date.
- The existing hardcoded defaults remain the fallback:
  - Weekday: `06:00–07:30` and `18:00–22:00` Vancouver time.
  - Weekend: `06:00–22:00` Vancouver time.
- A Firebase override can contain one or more Vancouver-time ranges for one Vancouver date. An intentionally empty range list is a valid override meaning no availability that day.
- Deleting the override document restores the hardcoded weekday/weekend fallback.

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

Subscribe only to the document for the currently resolved Vancouver date. Changing the selected date unsubscribes from the old document before subscribing to the new one. Snapshot absence selects the hardcoded fallback. Firebase failures leave the page usable with fallback rules and show a concise status message.

Saving uses `set`, and deleting a customization uses document `delete`. Ranges are validated locally before writes: `HH:MM` values, start earlier than end, no overlaps, and sorted by start time. Ranges do not cross midnight; users represent cross-midnight availability as ranges on the respective Vancouver dates.

## UI and data flow

The existing single circular panel remains. A small toolbar above it contains:

- a Beijing/Vancouver basis selector,
- a native date input,
- a Today button,
- an availability edit button,
- a settings button and synchronization status.

The availability editor appears as a simple inline section rather than a new page. It clearly names the resolved Vancouver date, identifies whether the current display is a Firebase customization or a default rule, and provides rows of start/end time inputs with Add range, Save customization, and Delete customization actions.

Date selection flow:

1. Resolve the selected city's `00:00` to an instant (or use the current instant for Today).
2. Format that instant in both IANA time zones for labels and offset calculation.
3. Resolve the canonical Vancouver date.
4. Subscribe to that date's override document.
5. Render its ranges if present; otherwise render the weekday/weekend defaults for the canonical Vancouver date.

Availability sectors are generated dynamically from range minutes rather than fixed CSS gradients. Labels are positioned near each sector and include their time range, allowing any valid customization to render without special-case CSS.

## Date and DST handling

Browser `Intl.DateTimeFormat` supplies zone-local parts. A small conversion helper converts a wall-clock date/time in an IANA zone to an instant by iteratively correcting a UTC guess against formatted zone parts. Tests cover Vancouver standard and daylight time and Beijing-to-Vancouver date rollover.

The outer Beijing hour labels use the actual offset at the selected anchor rather than the current hardcoded `15`. This is normally +15 hours during Vancouver daylight time and +16 during standard time.

## Error handling

- No API key: show defaults and explain that Firebase customization is unavailable until configured.
- Loading: keep defaults visible until the snapshot resolves.
- Missing document: label the editor as using defaults.
- Invalid ranges: prevent saving and place a clear validation message beside the editor.
- Read/write failure: retain the last usable/default display and show a non-blocking error.
- Stale snapshots from a prior date are ignored by unsubscribing and checking the active Vancouver date.

## Testing and verification

Extend `vancouver_beijing_dual_clock.test.js` with behavior-oriented tests for:

- preserved weekday/weekend fallback ranges,
- dynamic gradient generation from minute ranges,
- range sorting/validation and empty override support,
- Vancouver-date document IDs,
- Firebase set/delete and snapshot fallback behavior,
- API-key URL/local-storage flow,
- Beijing and Vancouver date anchoring,
- DST-aware +15/+16 hour label offsets,
- Today/live versus selected-date midnight display.

Run the Node test file, then open the page locally and verify desktop and narrow-screen layouts, date changes, editor actions, and the browser console.
