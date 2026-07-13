# Dual Clock Second Availability Range Design

## Goal

Update `vancouver_beijing_dual_clock.html` so the Vancouver-time availability display includes two green ranges:

- 06:00–07:30
- 18:00–22:00 (existing)

The existing `较可能有空` label remains unchanged.

## Design

Keep the current single `.availability-ring` element and express both ranges as stops in its CSS `conic-gradient`. The 24-hour clock maps each hour to `100% / 24` of the circle, so the ranges become:

- 06:00–07:30: 25%–31.25%
- 18:00–22:00: 75%–91.6667%

All other portions of the availability ring remain transparent. This approach follows the existing implementation, requires no new DOM elements or JavaScript, and keeps both sectors visually identical.

## Testing

Add a Node regression test to `vancouver_beijing_dual_clock.test.js` that asserts the availability-ring gradient contains both Vancouver-time percentage ranges. Run the test before implementation to confirm it fails because the second range is absent, then run it again after the CSS change to confirm it passes. Finally, run the complete test file.

