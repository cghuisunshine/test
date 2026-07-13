const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(
  path.join(__dirname, "vancouver_beijing_dual_clock.html"),
  "utf8"
);

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
