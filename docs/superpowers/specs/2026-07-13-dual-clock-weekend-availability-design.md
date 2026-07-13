# Dual Clock Weekend Availability Design

## Goal

Update `vancouver_beijing_dual_clock.html` so the Vancouver availability ring marks one continuous 06:00–22:00 range on Saturdays and Sundays. On weekdays, retain the existing 06:00–07:30 and 18:00–22:00 ranges.

## Design

Use the displayed Vancouver `weekday` value already returned by `getParts()` to determine whether the current clock date is Saturday or Sunday. During each clock update, toggle one `weekend` class on the existing `#clock` element. The availability ring and labels use descendant CSS selectors for that state, so no wrapper or duplicate ring is needed.

The default CSS remains the weekday split-sector gradient. The weekend class changes it to one continuous conic-gradient sector from 25% through 91.6667%, corresponding to 06:00–22:00 on the 24-hour dial. On weekends, hide the `.morning` label and reposition the remaining label to `left:35%; top:76%`, near the midpoint of the continuous arc. Removing the class restores both existing weekday label positions.

This keeps date logic in JavaScript and visual details in CSS. The existing clock uses `Etc/GMT+7` as its displayed Vancouver time source; using the weekday from that same source guarantees that the availability state agrees with the date shown on the clock. Changing the clock to seasonal `America/Vancouver` time is outside this change's scope.

## Testing

Extend `vancouver_beijing_dual_clock.test.js` with regression checks that assert:

- Saturday and Sunday are recognized as weekend days.
- The update loop applies the weekend class using Vancouver's weekday.
- The weekend gradient covers exactly 06:00–22:00.
- The existing weekday split gradient remains unchanged.
- Weekend and weekday label presentation are both represented.

Run the new test first and confirm it fails for the missing behavior. Then implement the minimal HTML, CSS, and JavaScript changes and run the complete test file.
