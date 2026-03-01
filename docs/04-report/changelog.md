# Changelog

All notable changes to Agent-Realm are documented here, organized by PDCA cycle completion.

---

## [2026-03-01] - Client UI/UX Enhancement - v1.0.0

### Summary
Completed first full PDCA cycle for client feature. UI/UX improvements achieved 91% design match rate with zero blocking issues. State management refactored, layout made responsive, and bundle optimized.

### Added
- Custom hook `useAppState.ts` (97 lines) — Centralized view and panel state management
- Custom hook `useAgentActions.ts` (49 lines) — Extracted mutations for agent creation, deletion, broadcast, discussion
- WebSocket reconnection state tracking in `useWebSocket.ts`
- Visual reconnection indicator in LeftSidebar (spinning icon + "재연결" text)
- ResizablePanelGroup 3-panel layout with drag resize handles
- 8 convenience action methods in useAppState (clearMeetingRoom, closeRightPanel, setCommandPaletteState, etc.)

### Changed
- **Home.tsx**: Refactored from 250 lines to 210 lines (-16%)
  - Delegated state management to custom hooks
  - Retained view rendering and lifecycle logic
- **LeftSidebar.tsx**: Removed fixed `w-[260px]` width, now responsive to panel resizing
- **DetailPanel.tsx**: Removed framer-motion AnimatePresence, uses conditional rendering
- **useWebSocket.ts**: Added `reconnecting` state for better connection UX
- Panel sizing: Adjusted from design-spec (20/55/25) to optimized (18/dynamic/25) for visual balance

### Removed
- 30 unused shadcn/ui component files (47 → 18 files, -62% reduction)
  - Deleted: accordion, alert, aspect-ratio, breadcrumb, calendar, carousel, chart, checkbox, collapsible, context-menu, drawer, form, hover-card, input-otp, menubar, navigation-menu, pagination, popover, progress, radio-group, sheet, sidebar, table, toggle-group, and 6 others
- Removed fixed width constraints from LeftSidebar and DetailPanel

### Fixed
- WebSocket disconnection now shows clear UI feedback to user
- Panel layout now responsive to screen resize and user drag
- Reduced unused dependencies in bundle

### Quality Metrics
- Design Match Rate: 91% (exceeds 90% threshold)
- TypeScript Compliance: 100% (0 errors)
- Build Success: 100%
- Regression Tests: 0 issues
- Iterations Required: 0

### PDCA Cycle
- Plan: `docs/01-plan/features/client.plan.md`
- Design: `docs/02-design/features/client.design.md`
- Implementation: 7 files modified/created in `client/src/`
- Analysis: `docs/03-analysis/client.analysis.md` (91% match)
- Report: `docs/04-report/client.report.md`

### Known Low-Impact Gaps
1. `useAgentActions` missing `isCreating` return value (design specified, not implemented)
2. Right panel uses conditional rendering instead of ResizablePanel `collapsible` API
3. `toggle.tsx` remains unused (can be deleted)

### Next Steps
- (Optional) Delete `toggle.tsx` to complete FR-06 perfectly
- (Optional) Add `isCreating` return to useAgentActions
- (Recommended) Update design doc with final panel size percentages
- (Enhancement) Extract WebSocket message handler to reduce Home.tsx further

### Author
rlaeo

---
