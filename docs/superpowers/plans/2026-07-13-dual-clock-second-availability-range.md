# Dual Clock Second Availability Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vancouver 06:00–07:30 as a second green `较可能有空` range while preserving Vancouver 18:00–22:00.

**Architecture:** Keep the existing `.availability-ring` DOM element and radial mask. Extend its CSS `conic-gradient` with a second opaque interval; no JavaScript or additional elements are needed.

**Tech Stack:** Standalone HTML/CSS, Node.js built-in test runner, `node:assert`.

---

## File Structure

- Modify `vancouver_beijing_dual_clock.html`: define both availability sectors in the existing conic gradient.
- Modify `vancouver_beijing_dual_clock.test.js`: add a source-level regression test for both percentage intervals.

### Task 1: Render and Test the Second Availability Sector

**Files:**
- Modify: `vancouver_beijing_dual_clock.test.js:24`
- Modify: `vancouver_beijing_dual_clock.html:57`

- [ ] **Step 1: Write the failing regression test**

Add this test after the visible-green-fill test:

```js
test("shows both Vancouver availability ranges on the ring", () => {
  assert.match(
    html,
    /background:conic-gradient\(from 0deg,transparent 0 25%,var\(--available-soft\) 25% 31\.25%,transparent 31\.25% 75%,var\(--available-soft\) 75% 91\.6667%,transparent 91\.6667% 100%\)/
  );
});
```

- [ ] **Step 2: Run the regression test and verify RED**

Run:

```bash
node --test --test-name-pattern="shows both Vancouver availability ranges on the ring" vancouver_beijing_dual_clock.test.js
```

Expected: FAIL because the current gradient starts its green fill at 75% and does not contain the 25%–31.25% range.

- [ ] **Step 3: Implement the minimal CSS change**

Replace the existing `.availability-ring` background declaration with:

```css
background:conic-gradient(from 0deg,transparent 0 25%,var(--available-soft) 25% 31.25%,transparent 31.25% 75%,var(--available-soft) 75% 91.6667%,transparent 91.6667% 100%);
```

- [ ] **Step 4: Run the focused regression test and verify GREEN**

Run:

```bash
node --test --test-name-pattern="shows both Vancouver availability ranges on the ring" vancouver_beijing_dual_clock.test.js
```

Expected: PASS with one matching test passed and unrelated tests skipped.

- [ ] **Step 5: Run the complete dual-clock test file**

Run:

```bash
node --test vancouver_beijing_dual_clock.test.js
```

Expected: all tests pass with zero failures.

- [ ] **Step 6: Review the scoped diff**

Run:

```bash
git diff --check
git diff -- vancouver_beijing_dual_clock.html vancouver_beijing_dual_clock.test.js
```

Expected: no whitespace errors; the diff contains only the new regression test and the conic-gradient update.

- [ ] **Step 7: Commit the implementation**

```bash
git add vancouver_beijing_dual_clock.html vancouver_beijing_dual_clock.test.js
git commit -m "feat: add morning dual-clock availability range"
```

