# Flowerbed Planner — Project Plan

## Overview

A browser-based tool for planning flowerbeds. Users draw shapes representing beds, drag individual plants onto them at specific positions, and get a total plant count. Served via Vite dev server; built as a static site.

---

## Architecture Decisions

### Tech stack
- **TypeScript + Vite + Vitest** — strict TypeScript, Vite for dev server and build, Vitest for tests
- **SVG** for the drawing canvas — shapes are objects (not pixels), enabling click-to-select without redrawing
- **Plain SVG + DOM** for the object model layer — no Fabric.js
- **SheetJS (xlsx)** for XLS export (added in Phase 3 iteration)
- **jsPDF** for PDF export (Phase 5)
- **JSON** save/load, no library needed (Phase 5)

### Module structure
- `src/types.ts` — shared TypeScript interfaces (`Plant`, `PlantMarker`, `ShapeData` discriminated union, `LabelEl`)
- `src/plants.ts` — `PLANTS` database, typed as `Plant[]`
- `src/geometry.ts` — pure geometry: `calcArea`, `shapeCentroid`, `pointInShape` family, `pxToM`, `fmt`, `computeFillPositions`, constants
- `src/markers.ts` — SVG marker construction (`buildMarkerEl`), icon builders, selection helpers, `applyOverrideToEl`
- `src/chips.ts` — sidebar chip construction (`buildChipEl`, `makeChipIcon`)
- `src/summary.ts` — `aggregatePlantCounts`, `summaryDisplayName`
- `src/tooltip.ts` — `applyTooltipContent`, `clearTooltipHandlers`
- `src/export.ts` — `buildExportRows` (XLS row builder)
- `src/toggles.ts` — `applyRingsToggle`, `applyGridToggle`, `applyBgToggle`
- `src/main.ts` — DOM wiring, SVG rendering, event handling; imports from all modules above

### Testing strategy
- **Vitest** is the test runner for all automated tests
- **Node environment** (default) for pure-logic modules: `geometry.ts`, `search.ts`, `summary.ts`, `export.ts`, `plantStore.ts`
- **happy-dom** (per-file `// @vitest-environment happy-dom` docblock) for modules that build DOM/SVG elements: `markers.ts`, `chips.ts`, `tooltip.ts`, `toggles.ts`
- **Playwright** deferred — end-to-end tests (drag-and-drop, canvas interaction, file import) are a planned addition but not yet implemented
- `main.ts` is not imported by any test — its module-level DOM queries make it untestable. Pure logic is extracted to separate modules to keep `main.ts` thin
- **ESLint** (flat config, `typescript-eslint` + `eslint-config-prettier`) + **Prettier** run via lint-staged on every staged file pre-commit
- **`tsc --noEmit`** runs as part of the pre-commit hook (after lint-staged, before tests)

### Data model
- Each design will be saved as a single JSON file (Phase 4): shapes, placed plant markers, and the plant database
- The plant database ships as a hardcoded array in `src/plants.ts` (~10 plants); extendable via UI in Phase 3

### Plant placement
- **Individual placement** — plants are dragged from a left sidebar palette and dropped at a specific position within a shape
- Each placed marker stores `{ plant, x, y, el }` in a `plantMarkers` array on the shape
- A dashed cc spacing ring (radius = `spacing / 2`) is shown around each marker as a visual guide
- No automatic density calculation — plant count = number of markers placed

### Units
- **Meters** as the primary unit (1 m = 100 px, `SCALE = 100`)
- Feet toggle deferred to Phase 5

### Overlap behavior
- Beds are **independent** — no overlap detection
- Each bed's plant count is calculated in isolation

---

## Phases

### Phase 1 — Canvas & Shapes
**Goal:** Get something visible and usable fast. No tests yet.

- Single `index.html`, SVG canvas, toolbar
- Draw rectangles, circles, and ellipses by click-drag
- Display real-world dimensions in meters
- Show area of each shape
- Select and delete shapes

**Done when:** You can draw a 3×2m rectangle and see "Area: 6m²"

---

### Phase 2 — Individual Plant Placement
**Goal:** Place individual plants by drag-and-drop at specific positions within beds. No tests yet.

- Left sidebar palette listing all plants as draggable chips
- Drag a plant chip onto a shape to place a colored marker dot at the drop position
- Markers only land inside a shape (drops outside shapes are ignored)
- Click a marker in Select mode to select it (highlighted); delete with Delete key or Delete button (same as shapes)
- Shape label shows placed count ("N plants") or area if empty
- Right panel shows placed count for selected shape
- Running plant summary with color swatches
- Dashed spacing ring around each marker showing the cc planting distance (radius = spacing / 2)

**Done when:** Drag "Rose" onto a bed → R dot with dashed ring appears; ring radius = 25 cm (half of 0.5 m spacing)

---

### ⚑ Prototype validation checkpoint ✅

Completed: refactored pure logic into `src/types.ts`, `src/plants.ts`, `src/geometry.ts`; UI in `src/main.ts`. Introduced TypeScript, Vite, Vitest. 34 tests passing. TDD applies from Phase 3 onwards.

---

### Phase 3 — Image Background & Scale Calibration ✅
**Approach: TDD for scale logic; lightweight for UI**

- Import an image file (JPEG, PNG, SVG) as a background layer below all shapes
- Calibrate scale by clicking two points on the image and entering the real-world distance
- `sessionScale` (px/m) updates for the session; all geometry reflects the new scale
- Image can be repositioned by dragging in Select mode; scale can be recalibrated at any time
- Grid redraws at 1m major / 0.5m minor intervals matching `sessionScale`
- Polygon shape tool: click to place vertices, snap-to-first-vertex to close, self-intersection guard
- Visibility toggles for CC rings, grid, and background image
- XLS export of plant summary (SheetJS)
- Drag to move shapes in Select mode (translates shape, all its markers, and the label)
- Drag to reposition individual plant markers within or across shapes
- Unified marker selection model: click to select, Delete to remove (no more instant-delete on click)
- `calcScale` pure function unit-tested

---

### Phase 4 — Plant Database Management
**Approach: TDD**

#### 4a — Trefle.io data pipeline ✅
- `scripts/fetch-plants.ts` — fetches all Swedish non-edible plants from Trefle.io (`/distributions/swe/plants`), paginates all 210 pages, writes `src/data/plants-raw.json` (~4 193 plants)
- `scripts/enrich-plants.ts` — fetches detailed data per slug (`/plants/{slug}`), extracts `flower_colors`, `spread_cm`, `growth_habit`, `bloom_months`, `light`, etc.; writes `src/data/plants-enriched.json`
- `src/search.ts` — live scientific-name search against the full raw corpus; merges enriched data (flower color → chip swatch, spread_cm → spacing) where available; family-based color fallback for unenriched plants
- Left panel: search input (keystroke-triggered) + scrollable results chips above the Favourites list
- Drag-and-drop migrated from index-based to JSON-serialised `plantData` in `dataTransfer`

#### 4b — Per-plant overrides UI ✅
- Edit button (✎) on each search-result chip opens a popover to override spacing and colour
- Overrides stored in `src/plantStore.ts` (get/set/delete per Trefle slug); validated before writing
- Saving an override updates the chip swatch and all already-placed markers on the canvas
- `plantStore.test.ts` covers CRUD and validation

**Done when:** Click ✎ on a search chip → change spacing/colour → placed markers update immediately

---

### Phase 5 — Zoom & Pan ✅
**Approach: lightweight for UI**

- Scroll wheel to zoom toward cursor
- Middle-click drag or Space+drag to pan
- SVG viewBox manipulation — all content coordinates unchanged

---

### Phase 5b — Code Quality & Test Coverage ✅
**Approach: extract → test → enforce**

- ESLint flat config (`typescript-eslint` + `eslint-config-prettier`) enforcing strict TS-aware rules
- Prettier for consistent formatting
- Husky v9 + lint-staged pre-commit hook: lint + format staged files, `tsc --noEmit`, full test suite
- Extracted pure/side-effect-free functions out of `main.ts` into testable modules:
  - `src/markers.ts` — marker element builder, icon builders, selection helpers, override apply
  - `src/chips.ts` — sidebar chip builder
  - `src/summary.ts` — plant count aggregation and display name
  - `src/tooltip.ts` — tooltip content application and handler cleanup
  - `src/export.ts` — XLS row builder
  - `src/toggles.ts` — visibility toggle functions
  - `src/geometry.ts` — extended with `computeFillPositions`
- 157 tests across 13 test files, all passing (node + happy-dom environments)
- Fixed 10 pre-existing TypeScript errors in `main.ts`; added `DOM.Iterable` to tsconfig lib

**Done when:** Pre-commit hook enforces lint + types + tests; 157 tests passing

---

### Phase 6 — Save / Load / Export
**Approach: TDD**

- Save full design as `.json` (shapes + placed markers + plant database + background image reference)
- Load a `.json` file to restore a design
- Export a printable PDF with canvas image + plant list table

**Done when:** Full round-trip — design → save → reload → export PDF

---

### Phase 7 — Polish & UX
**Approach: TDD for logic, lightweight for UI**

- Undo/redo (command pattern)
- Snap-to-grid (optional, relative to calibrated scale)

---

### Phase 8 (Future) — Shape Templates
_Deferred — revisit after Phase 7 is complete._

- Pre-defined shapes: L-shape, kidney, border strip
- Templates are polygon/path presets dropped onto the canvas
- Resize and assign plants like any other shape

---

## Validated Assumptions

| Topic | Decision |
|---|---|
| Units | Meters primary (1 m = 100 px); feet toggle deferred |
| Plant placement | Individual drag-and-drop markers; no auto density calculation |
| CC spacing ring | Dashed ring (radius = spacing / 2) shown per marker; toggleable |
| Overlap handling | Beds are independent; no overlap detection |
| Scope per design | One flowerbed at a time |
| Plant database | Hardcoded in `src/plants.ts`, user-extendable via UI in Phase 3 |
| Save format | JSON file download/upload |
| Output | On-screen list + XLS export + PDF export (Phase 5) |
| Devices | Desktop with mouse |
| Framework | Vite (dev/build), Vitest (tests), TypeScript |
| Testing | Vitest (node + happy-dom); 157 tests; Playwright deferred for E2E |
| Multi-user | Not in scope |

---

## Status

| Phase | Status |
|---|---|
| 1 — Canvas & Shapes | ✅ Complete |
| 2 — Plant Placement  | ✅ Complete |
| ⚑ Prototype checkpoint | ✅ Complete |
| 3 — Image Background & Scale Calibration | ✅ Complete |
| 4a — Trefle data pipeline & search | ✅ Complete |
| 4b — Per-plant overrides UI | ✅ Complete |
| 5 — Zoom & Pan | ✅ Complete |
| 5b — Code Quality & Test Coverage | ✅ Complete |
| 6 — Save / Load / Export | ⬜ Not started |
| 7 — Polish & UX | ⬜ Not started |
| 8 — Templates (deferred) | ⏸ Deferred |

---

## Changelog

_Update this section as phases complete or decisions change._

- **2026-03-11** — Initial plan created. Phases defined, assumptions validated.
- **2026-03-11** — Phase 1 complete. Single `index.html`, SVG canvas with grid, draw rect/circle/ellipse, select/delete, info panel with real-world dimensions and area.
- **2026-03-11** — Phase 2 revised and re-implemented. Replaced dropdown/hex-packing system with individual plant placement: left sidebar palette, drag-and-drop markers (colored dot + initial) onto shapes, click-to-delete markers, updated summary with color swatches.
- **2026-03-11** — Prototype checkpoint complete. Introduced Vite + Vitest + TypeScript. Extracted pure logic into `src/types.ts`, `src/plants.ts`, `src/geometry.ts`; UI code moved to `src/main.ts`. 34 tests, all passing.
- **2026-03-11** — Phase 3 complete. Background image import (JPEG/PNG/SVG) in dedicated SVG layer; drag to reposition. Scale calibration via two-click + distance entry, updates `sessionScale` and redraws grid. Polygon shape tool with snap-to-close and self-intersection guard. Adaptive grid (1m major / 0.5m minor, recalculates on calibration). Visibility toggles for CC rings, grid, and background image. XLS export of plant summary via SheetJS. 58 tests passing.
- **2026-03-11** — Phase 3 iteration. Drag-to-move shapes in Select mode (shape, markers, and label translate together). Drag-to-move individual plant markers. Unified selection model for markers: click to select (highlighted stroke), Delete key/button to remove — replaces instant click-to-delete.
- **2026-03-12** — Phase 4a complete. Trefle.io data pipeline: `fetch-plants` script (210 pages, ~4 193 Swedish non-edible plants → `plants-raw.json`), `enrich-plants` script (per-slug detail fetch → `plants-enriched.json` with flower colors, spread, growth habit, bloom months). Live scientific-name search in left panel with scrollable chip results. Flower color from enriched data drives chip swatch; family-color fallback for unenriched plants. Spacing derived from `spread_cm` where available, else 0.30 m default. Drag-and-drop migrated to JSON `plantData` transfer key.
- **2026-03-13** — Phase 4b complete. Removed hardcoded favourites list. Added per-plant override store (`src/plantStore.ts`: get/set/delete per Trefle slug with validation). Edit popover (✎ button on search chips) lets user override spacing and colour; saving updates chip swatch and all placed markers immediately. Fixed fill-mode markers not being interactive after toggling fill mode. Added regression test for `.tool-btn` data-tool attribute.
- **2026-03-13** — Phase 5 complete. Zoom via scroll wheel toward cursor; pan via middle-click drag or Space+drag. Implemented via SVG viewBox manipulation — canvas content coordinates unchanged.
- **2026-03-16** — Plant markers now scale proportionally with `sessionScale`. Replaced circle plant icons with traced flower SVG icon.
- **2026-03-18** — Phase 5b complete. ESLint flat config + Prettier + Husky pre-commit hook (lint-staged → tsc → tests). Extracted pure logic from `main.ts` into `markers.ts`, `chips.ts`, `summary.ts`, `tooltip.ts`, `export.ts`, `toggles.ts`, and extended `geometry.ts` with `computeFillPositions`. 157 tests across 13 files (node + happy-dom). Fixed 10 pre-existing TS errors; added `DOM.Iterable` to tsconfig. Testing strategy documented: Vitest for unit/DOM tests, Playwright deferred for E2E.