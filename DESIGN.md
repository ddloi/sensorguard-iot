# SensorGuard interface

The dashboard uses a restrained industrial operations style for hackathon presentation. The implementation in `packages/dashboard/src/index.css` is the source of truth; older generic recommendations are archived in `docs/archive/design-system/MASTER.md`.

## Theme and color

Dark is the default: base `#0b1220`, panels `#111d2d`, primary text `#f1f5fa`, muted text `#9aadc3`. Cyan `#67d7eb` identifies selected navigation and the moving average. Blue identifies sensor temperature. Amber signals warnings, rose signals critical incidents, and green signals recovery. A full light theme is available and remembered locally.

## Typography

Use a local system sans-serif stack and monospace for identifiers and measurements. Body 14px, support labels 12px, page heading 25px. Fonts must not require a network request during a demo.

## Layout

An adaptive command bar and static latest event sit above a 270px device sidebar and flexible main content. Below 1024px the sidebar collapses; the main device selector remains accessible. Summary values share one divided strip. Main panels separate sensor gauges, time series and incident history. Earlier resolved incidents have collapsible details.

## Components and interaction

Use native buttons, select controls and disclosure elements. All controls have keyboard focus, loading or disabled states where applicable. Demo requests display acceptance or failure and open incident history. Show only reported service health, with a distinct configured-only label for Datadog. Avoid decorative glow, moving tickers and noninteractive hover lifts.

## Charts and accessibility

Plot real timestamps and a dynamic temperature range. The 85°C threshold belongs only to MOTOR-001's demo. HTML axis labels retain readable size on phones. Pair all status colors with text, include a skip link, and honor reduced motion. Check 375px, 768px, 1024px and desktop widths.
