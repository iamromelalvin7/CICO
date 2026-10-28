# CICO Mobile Audit — Problems and Fixes

Looking at both screenshots, the biggest issue is not the colour palette or the visual design. The mobile layout and navigation need correction. The dashboard looks reasonably polished, but several details make it feel like a desktop layout squeezed onto a phone rather than an interface designed specifically for mobile.

Issues are separated into critical bugs, layout problems, usability problems, and visual refinements so the fixes can be handed off directly.

---

## 1. Critical issues

### 1. The dashboard content is wider than the visible viewport
**High priority.** The balance card, summary cards, and spending section appear to extend almost to the right edge of the screen. The two-column cards are particularly tight, and the spending card nearly touches the viewport boundary.

**Fix:** Set `width: 100%`, `max-width: 100%`, and `min-width: 0` on the appropriate layout containers. Use `box-sizing: border-box` globally and remove fixed widths that exceed the available content area. Keep consistent horizontal padding of approximately 16–20px.

### 2. The navigation drawer is broken or poorly sized
**High priority.** In the second screenshot, the drawer occupies roughly 44% of the screen width, leaving the remaining dashboard visible underneath a dim overlay. That is not automatically wrong, but the drawer appears unusually narrow relative to its content, and its layout wastes a huge amount of vertical space.

**Fix:** On mobile, use a drawer width of `min(320px, 85vw)`. Keep the close button inside the drawer header, align it consistently, and ensure the overlay covers the entire application viewport below the status bar as intended. The drawer should scroll independently if its contents exceed the available height.

### 3. The bottom navigation needs safe-area handling
The bottom navigation is very close to the bottom of the screenshot, and the drawer overlay interacts with the navigation area awkwardly.

**Fix:** Use `position: fixed; bottom: 0;` for the bottom navigation when appropriate, add `padding-bottom: env(safe-area-inset-bottom)`, and give the page content sufficient bottom padding so the final dashboard card cannot be obscured. Decide explicitly whether the drawer overlays the bottom bar or sits above it.

### 4. The spending chart layout is too stretched vertically
The donut chart sits in a large area of white space, with the legend positioned far below it. The chart and its labels could use the screen more efficiently.

**Fix:** Reduce the chart container's excessive height, centre the donut within a deliberate chart region, and keep the legend directly below it. On narrow screens, consider a smaller donut with a diameter around 170–200px and consistent spacing.

---

## 2. Layout and responsive design problems

### 5. The dashboard cards have inconsistent widths
This is one of the clearest problems in screenshot one. The balance card and the four summary cards occupy only the left portion of the screen, while the spending-by-category card spans almost the entire width.

**Fix:** Make the main dashboard use one responsive content container. At mobile breakpoints, the balance card and spending card should span the available width, while the summary cards should use a consistent two-column grid.

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.balance-card,
.spending-card {
  grid-column: 1 / -1;
  min-width: 0;
}

@media (max-width: 480px) {
  .dashboard-container {
    width: 100%;
    padding-inline: 16px;
    box-sizing: border-box;
  }
}
```

### 6. The dashboard has excessive vertical scrolling
The balance card takes up substantial height, followed by four summary cards and a large spending chart. On a phone, the user must scroll a considerable distance to see the complete financial picture.

**Fix:** Reduce unnecessary vertical padding, keep card spacing consistent, and make the balance chart shorter on mobile. Do not shrink text or touch targets simply to fit more content on screen.

### 7. The summary cards are cramped
The Savings and Investments cards have longer descriptions that wrap onto multiple lines. The card heights differ from the Income and Expenses cards, making the grid less balanced.

**Fix:** Use a shared grid with `align-items: stretch`, consistent internal padding, and predictable minimum heights. Allow descriptions to wrap naturally without clipping. Consider shortening the descriptions to "Net savings" and "Net invested" if the full explanations are available elsewhere.

### 8. The header has too much unused horizontal space on the dashboard
The CICO logo is at the left, while the sync status is positioned far away. On narrow devices, fixed spacing or a desktop-oriented header layout can make the header feel disconnected.

**Fix:** Use a flexible header layout with the menu button and logo grouped together and the sync status aligned to the right. Allow the status text to shrink or use a compact indicator on very narrow screens. Avoid fixed margins for positioning.

### 9. The page's horizontal padding is inconsistent in effect
The dashboard has a relatively narrow content column at the top but a nearly edge-to-edge spending card below. This makes the page look as if different components follow different layout rules.

**Fix:** Establish a single spacing system: for example, 16px page padding, 12px between summary cards, and 20px between major sections. Individual cards should not independently define their own viewport widths.

---

## 3. Navigation and interaction problems

### 10. The mobile drawer is too narrow
At the screenshot's displayed size, the drawer is about 44% of the screen width. This leaves the menu items unnecessarily constrained.

**Fix:** Set the drawer to `width: min(320px, 85vw)`. Give each menu item enough horizontal padding and ensure labels do not wrap or collide with icons.

### 11. The drawer contains too much empty vertical space
The menu options are all clustered near the top, leaving a very large blank region before the sync status at the bottom.

**Fix:** This is partly acceptable in a navigation drawer, but the spacing should be deliberate. Use a flex column with the navigation items grouped at the top and the sync status anchored at the bottom. Keep the bottom status inside the drawer's safe area.

### 12. The close button and header alignment need correction
The close icon is positioned at the far right of the narrow drawer. Small stray dash-like marks are also visible around the header's right side, which look like rendering artifacts or unintended decorative elements.

**Fix:** Inspect the drawer header's CSS and icon components. Remove unintended pseudo-elements, borders, or decorative marks. Use a simple flex row with the logo on the left and a properly sized close button on the right.

### 13. The drawer overlay is too visually heavy
The dashboard underneath becomes heavily greyed out. The overlay should establish focus without making the underlying interface look disabled to an excessive degree.

**Fix:** Start with a neutral black overlay around `rgba(0, 0, 0, 0.35)` and adjust after testing. The drawer should have a higher stacking order than the overlay, with a clear shadow or boundary. Ensure the overlay covers the intended area consistently.

### 14. The drawer and bottom navigation need a consistent layering rule
In the open-drawer screenshot, the bottom navigation remains visible beneath the overlay. That is a valid design choice only if it is intentional; otherwise, it looks like two navigation systems competing for attention.

**Fix:** Decide on one behaviour:
- The drawer covers the bottom navigation entirely; or
- The drawer sits above the bottom navigation and the latter is hidden while the drawer is open.

For CICO, hide or cover the bottom navigation while the drawer is open.

### 15. The app has duplicate navigation paths
The drawer contains Overview, Add transaction, Transactions and Ask CICO, while the bottom bar provides Home, Add, Activity and Ask. The functionality is understandable, but the naming differs between navigation systems.

**Fix:** Standardise the labels and destinations. For example, Overview = Home, Transactions = Activity, Add transaction = Add, and Ask CICO = Ask. Settings can remain exclusive to the drawer.

### 16. The bottom navigation labels and icons need clearer active-state treatment
Home has a pale green background around its icon, while the other destinations have no comparable container. This can work, but the active state should be unmistakable and consistent.

**Fix:** Use a shared active-state component with consistent icon dimensions, label positioning, colour and background. Make sure the selected state updates whenever the route changes.

### 17. The central Add button dominates the navigation
The circular green Add button is substantially more prominent than the other destinations. That is reasonable because transaction entry is the app's primary action, but the current design risks making the bottom navigation feel unbalanced.

**Fix:** Keep Add as the primary action, but align it vertically with the other items, use a consistent hit area, and ensure its label and icon remain legible. Do not reduce the actual tap target merely to make the design look symmetrical.

---

## 4. Financial dashboard and data presentation

These issues are less about responsive CSS and more about making CICO trustworthy as a finance app.

### 18. The balance chart lacks useful information
The chart is nearly flat and then rises sharply at the end. It has no visible axis labels, dates, or contextual markers. The user cannot tell which transaction caused the increase or how the balance evolved.

**Fix:** Add date labels and useful hover/tap details. If the data is sparse, use a simpler balance trend display rather than a large chart dominated by empty space. Plot actual balance history, not an artificially interpolated trend.

### 19. The balance chart's vertical scale is unclear
There is no y-axis or other visual reference for the amount represented by the line. The large final jump is visually dramatic without explaining its magnitude.

**Fix:** Use a clearly defined scale or labelled balance points. Include a tooltip showing the date and actual balance. Ensure the chart's scale is derived from the real data.

### 20. The balance card's definition is easy to overlook
The card explains that spendable money equals income minus expenses, savings and investments, but this important definition is displayed in small, muted text.

**Fix:** Keep the balance formula accessible through a short subtitle or an information icon. Make the definition readable without competing with the balance itself.

### 21. "Total balance" may be confused with total cash or net worth
The displayed GH₵285 is a calculated spendable balance, not necessarily the total amount of money the user owns. Savings and investments are excluded.

**Fix:** Consider labelling it "Available balance" or "Spendable balance." Keep the formula visible so users understand that savings and investments are excluded. If CICO later supports separate cash accounts, define the balance semantics before implementing them.

### 22. The "Change for Oct 1–28" label needs a precise definition
It shows +GH₵285.00, matching the current balance. That may be correct if this is the user's first period with activity, but it is not necessarily the same as a change in balance.

**Fix:** Calculate the actual difference between the balance at the start and end of the selected period. If no opening balance or prior-period data exists, use a label such as "Net change this month" only when that calculation is supported by the transaction data.

### 23. The monthly selector needs clearer navigation affordances
The date selector displays "This month" between two arrows. The interface does not make it obvious whether the arrows move to previous and next months or whether the central control opens a date picker.

**Fix:** Keep the arrows large enough to tap, disable or appropriately handle future periods, and allow the central label to open a month selector. Make sure the displayed range and every dashboard metric update together.

### 24. The spending legend has small secondary text
Category amounts are readable, but the percentages and supporting text are smaller and lighter. On a phone, this can be difficult for users who need to scan their spending quickly.

**Fix:** Increase the readability of secondary text, maintain sufficient contrast, and align category names, amounts and percentages using a consistent grid. Preserve the category colours while ensuring labels remain understandable without colour alone.

### 25. The donut chart is not optimised for touch
The chart itself is decorative unless the user can interact with it. It currently takes up a large area without an apparent way to inspect individual categories directly.

**Fix:** Either make each segment tappable to reveal the category and amount, or keep the chart non-interactive and let the legend act as the primary breakdown. Avoid adding interaction that duplicates the legend without adding value.

### 26. The dashboard's number formatting needs consistency checks
All figures use the GH₵ currency prefix and two decimal places, which is consistent. However, currency formatting should remain consistent across the balance, cards, chart, transaction list and Ask CICO responses.

**Fix:** Use a shared currency-formatting utility with the appropriate Ghanaian cedi locale and two decimal places. Never calculate totals from already formatted strings.

---

## 5. Typography, accessibility and visual polish

### 27. Some text is too small for mobile
The sync status, card descriptions, chart legend percentages and secondary labels are all visually subordinate. Some appear close to the lower end of comfortable mobile readability.

**Fix:** Aim for 16px body text where practical and at least 14px for secondary text. Use 12px only for genuinely tertiary information that remains readable. Avoid reducing text sizes to solve layout problems.

### 28. Secondary text has limited contrast
Several grey labels sit on white or near-white backgrounds. The pale green and grey interface looks clean, but subtle contrast can become difficult to read at reduced brightness.

**Fix:** Check text and icon contrast against WCAG guidelines. Use at least 4.5:1 for normal text and 3:1 for large text. Keep decorative borders lighter if desired, but do not sacrifice text readability.

### 29. The cards use too much rounded-corner styling
The balance card, metric cards, spending card and selector all have rounded corners. The style is consistent, but the combination of generous radii, borders and shadows creates a slightly repetitive appearance.

**Fix:** Define a small radius scale and apply it consistently. Use stronger rounding for major cards and slightly tighter rounding for controls. Remove shadows where borders already establish enough separation.

### 30. Some icons may be too small to tap comfortably
The hamburger, close, arrows and bottom navigation icons need proper hit areas. Their visible glyph size is not the same as the actual clickable area.

**Fix:** Give interactive controls a minimum target around 44 × 44 CSS pixels, preferably 48 × 48 where space permits. Add accessible labels for icon-only buttons.

### 31. The interface depends too heavily on colour to communicate meaning
Green indicates income or positive balance changes, coral indicates expenses, and other colours identify savings and investments. These distinctions are useful, but colour alone should not communicate financial meaning.

**Fix:** Pair colour with text labels, directional icons, and explicit signs where appropriate. Check the design in grayscale and under common colour-vision deficiencies.

### 32. The page needs better handling of long text and larger font settings
The current descriptions wrap, but there is no visible evidence that the layout has been tested with larger system fonts, narrow phones or unusually long category names.

**Fix:** Test at 320px, 375px, 390px and 430px viewport widths, as well as with increased text scaling. Use flexible grid columns, natural wrapping and `min-width: 0` rather than clipping text.

---

## 6. Engineering fixes that prevent these problems from returning

These are not all visible defects in the screenshots. They are the implementation checks to add so the same mobile issues do not reappear.

- **33. Add a global responsive layout rule.** Use a shared page container, a consistent spacing scale, `box-sizing: border-box`, and responsive breakpoints. Avoid individual fixed widths for cards.
- **34. Prevent horizontal overflow.** Inspect all dashboard sections, charts, navigation elements and long labels for overflow. Do not hide overflow globally just to conceal broken layouts; fix the element that causes it.
- **35. Make the drawer accessible.** When open, lock background scrolling, move keyboard focus into the drawer, support Escape to close it, and restore focus to the menu button when it closes. Use appropriate dialog or navigation semantics.
- **36. Handle safe areas and scrolling correctly.** Test the bottom navigation with iPhone home indicators, browser toolbars and the software keyboard. Ensure the page remains scrollable and no content becomes permanently hidden.
- **37. Use real data for every visualisation.** The balance trend and category breakdown must reflect the actual transactions for the selected period. Include loading, empty, error and offline states rather than showing misleading placeholder data.
- **38. Test the complete mobile workflow.** Open the drawer, navigate to Add, record a transaction, return to the dashboard, inspect Activity, and use Ask CICO. Verify that the bottom navigation, route state and dashboard totals remain consistent.

---

## Recommended order of implementation

Do not ask Codex to change all 38 items at once. That creates a high risk of breaking working functionality while it makes cosmetic changes.

**Phase 1 — Fix the layout (do first).** Fix the inconsistent card widths, dashboard grid, horizontal overflow, drawer width, overlay stacking and bottom-navigation safe area. Verify at multiple mobile widths before changing colours or shadows.

**Phase 2 — Fix navigation and interaction.** Standardise labels and destinations, correct the drawer close button, define overlay behaviour, and test tap targets, keyboard handling and scrolling.

**Phase 3 — Improve financial clarity.** Clarify the available-balance label, verify the period-change calculation, optimise the charts and improve the readability of category amounts.

**Phase 4 — Polish and regression-test.** Refine typography, contrast, radii and shadows. Test small and large phones, browser zoom, offline behaviour and the complete transaction-entry flow.

---

## Codex implementation brief

### CICO — Mobile UI Audit and Fixes

**Objective**

Audit and fix the existing CICO personal-finance PWA's mobile interface based on the supplied dashboard and open-navigation-drawer screenshots.

Preserve CICO's existing design identity, financial calculations, offline-first behaviour, Supabase synchronisation, Claude integration and transaction-entry functionality. This is a responsive-layout and usability repair, not a complete redesign.

**1. Responsive dashboard**
- Establish one consistent mobile page container with 16–20px horizontal padding.
- Use `box-sizing: border-box` and ensure grid children can shrink with `min-width: 0`.
- Make the available-balance and spending-by-category cards span the full content width.
- Display Income, Expenses, Savings and Investments in a two-column grid on mobile.
- Use consistent card gaps, padding, alignment and predictable minimum heights.
- Allow long descriptions to wrap without clipping.
- Remove unnecessary fixed widths and prevent horizontal page overflow.
- Reduce excessive vertical whitespace, particularly around the balance trend chart and spending donut chart.

**2. Navigation drawer**
- Use a mobile drawer width of `min(320px, 85vw)`.
- Align the logo and close button within a consistent header.
- Investigate and remove the stray dash-like rendering artifacts visible around the close button.
- Use a properly layered backdrop and drawer.
- Close the drawer when the backdrop is tapped or Escape is pressed.
- Lock background scrolling while the drawer is open.
- Manage focus accessibly and restore focus to the menu trigger on close.
- Anchor the sync indicator at the bottom of the drawer while respecting safe areas.
- Hide or cover the bottom navigation when the drawer is open.

**3. Bottom navigation**
- Keep Home, Add, Activity and Ask consistently aligned.
- Standardise navigation labels and route destinations with the drawer.
- Preserve Add as the primary action.
- Provide adequate touch targets and accessible labels.
- Apply a consistent active state and avoid overlap with the iOS home indicator.
- Add sufficient bottom padding to the page content to prevent the fixed navigation from covering content.

**4. Charts and financial clarity**
- Reduce excessive empty space around the balance trend and donut chart.
- Render chart data from actual transactions and historical balances.
- Provide useful date labels and tap/hover details where appropriate.
- Verify the calculation of monthly balance change against the opening and closing balances for the selected period.
- Consider renaming Total balance to Available balance or Spendable balance if the existing formula excludes savings and investments.
- Keep all monetary calculations numeric internally and use a shared GH₵ formatting utility.

Do not fabricate historical data, trends, transactions or financial figures.

**5. Accessibility and visual polish**
- Improve the readability and contrast of secondary labels.
- Use consistent typography, card radii, spacing and icon sizes.
- Maintain a minimum 44 × 44 CSS pixel target for interactive controls where practical.
- Do not rely on colour alone to communicate financial meaning.
- Support text wrapping, zoom and increased text scaling.

**6. Testing and acceptance criteria**

Test viewport widths of 320px, 375px, 390px and 430px.

Verify that:
- No dashboard component causes horizontal page scrolling.
- The balance and spending cards align to the same content boundaries.
- The four summary cards form a clean two-column grid.
- The drawer fits its content and does not leave the bottom navigation competing with it.
- No controls or content are obscured by safe areas or fixed navigation.
- The dashboard remains usable when labels wrap or font scaling increases.
- Month navigation updates all relevant metrics consistently.
- Financial totals and charts remain accurate.
- Add, Activity, Ask CICO, offline storage and synchronisation continue to work.

**Implementation constraints**

Inspect the existing codebase and identify the actual components and styles responsible before editing. Reuse existing components and design tokens where possible. Avoid unnecessary dependencies and do not replace functioning financial logic.

Implement changes in priority order: responsive layout, navigation, financial clarity, then visual polish.

After implementation, report the files changed, the issues fixed, the tests performed, and any remaining limitations. Do not claim a test passed unless it was actually run.

---

**Main recommendation:** fix the inconsistent content widths first. That is the clearest structural defect in the screenshots. Once the dashboard grid, drawer and bottom navigation behave properly at real phone widths, the rest of the visual polish will be much easier to judge.