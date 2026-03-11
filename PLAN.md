# Flowerbed Planner — Project Plan

## Overview

A browser-based tool for planning flowerbeds. Users draw shapes representing beds, drag individual plants onto them at specific positions, and get a total plant count. Served via Vite dev server; built as a static site.

---

## Architecture Decisions

### Tech stack
- **TypeScript + Vite + Vitest** — strict TypeScript, Vite for dev server and build, Vitest for tests
- **SVG** for the drawing canvas — shapes are objects (not pixels), enabling click-to-select without redrawing
- **Plain SVG + DOM** for the object model layer — no Fabric.js
- **jsPDF** for PDF export (Phase 4)
- **CSV export** via a Blob download, no library needed (Phase 4)

### Module structure
- `src/types.ts` — shared TypeScript interfaces (`Plant`, `PlantMarker`, `ShapeData` discriminated union, `LabelEl`)
- `src/plants.ts` — `PLANTS` database, typed as `Plant[]`
- `src/geometry.ts` — pure geometry: `calcArea`, `shapeCentroid`, `pointInShape` family, `pxToM`, `fmt`, constants
- `src/main.ts` — all DOM, SVG rendering, and event handling; imports from the modules above

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
- Click a marker in Select mode to delete it
- Shape label shows placed count ("N plants") or area if empty
- Right panel shows placed count for selected shape
- Running plant summary with color swatches
- Dashed spacing ring around each marker showing the cc planting distance (radius = spacing / 2)

**Done when:** Drag "Rose" onto a bed → R dot with dashed ring appears; ring radius = 25 cm (half of 0.5 m spacing)

---

### ⚑ Prototype validation checkpoint ✅

Completed: refactored pure logic into `src/types.ts`, `src/plants.ts`, `src/geometry.ts`; UI in `src/main.ts`. Introduced TypeScript, Vite, Vitest. 34 tests passing. TDD applies from Phase 3 onwards.

---

### Phase 3 — Image Background & Scale Calibration
**Approach: TDD for scale logic; lightweight for UI**

- Import an image file (JPEG, PNG, SVG) to use as a background on the canvas
- The image is rendered below all shapes and markers (in a dedicated background layer)
- After importing, the user sets the scale by clicking two points on the image and entering the real-world distance between them
- This calibration updates `SCALE` (px/m) for the session so that shapes drawn on top reflect the correct real-world dimensions
- The image can be repositioned and the scale can be recalibrated at any time
- Scale calibration logic is pure and unit-tested

**Done when:** Import a blueprint, click two known points, enter "5 m", draw a rectangle — its area reflects the calibrated scale

---

### Phase 4 — Plant Database Management
**Approach: TDD**

- UI panel to add, edit, and delete plants (name, spacing, colour swatch)
- Changes are reflected immediately in the left sidebar palette
- Spec the plant CRUD operations before implementing

**Done when:** Add a custom plant, drag it onto a bed, see it in the summary

---

### Phase 4 — Save / Load / Export
**Approach: TDD**

- Save full design as `.json` (shapes + assignments + plant database)
- Load a `.json` file to restore a design
- Export plant summary to CSV
- Export a printable PDF with canvas image + plant list table

**Done when:** Full round-trip — design → save → reload → export PDF

---

### Phase 5 — Save / Load / Export
**Approach: TDD**

- Save full design as `.json` (shapes + placed markers + plant database + background image reference)
- Load a `.json` file to restore a design
- Export plant summary to CSV
- Export a printable PDF with canvas image + plant list table

**Done when:** Full round-trip — design → save → reload → export PDF

---

### Phase 6 — Polish & UX
**Approach: TDD for logic, lightweight for UI**

- Zoom and pan the canvas
- Undo/redo (command pattern)
- Snap-to-grid (optional, relative to calibrated scale)

---

### Phase 7 (Future) — Shape Templates
_Deferred — revisit after Phase 6 is complete._

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
| Output | On-screen list + CSV export + PDF export |
| Devices | Desktop with mouse |
| Framework | Vite (dev/build), Vitest (tests), TypeScript |
| Testing | None for Phases 1–2; TDD from Phase 3 onwards |
| Multi-user | Not in scope |

---

## Status

| Phase | Status |
|---|---|
| 1 — Canvas & Shapes | ✅ Complete |
| 2 — Plant Placement  | ✅ Complete |
| ⚑ Prototype checkpoint | ✅ Complete |
| 3 — Plant Database | ⬜ Not started |
| 4 — Save / Load / Export | ⬜ Not started |
| 5 — Polish & UX | ⬜ Not started |
| 6 — Templates (deferred) | ⏸ Deferred |

---

## Changelog

_Update this section as phases complete or decisions change._

- **2026-03-11** — Initial plan created. Phases defined, assumptions validated.
- **2026-03-11** — Phase 1 complete. Single `index.html`, SVG canvas with grid, draw rect/circle/ellipse, select/delete, info panel with real-world dimensions and area.
- **2026-03-11** — Phase 2 revised and re-implemented. Replaced dropdown/hex-packing system with individual plant placement: left sidebar palette, drag-and-drop markers (colored dot + initial) onto shapes, click-to-delete markers, updated summary with color swatches.
- **2026-03-11** — Prototype checkpoint complete. Introduced Vite + Vitest + TypeScript. Extracted pure logic into `src/types.ts`, `src/plants.ts`, `src/geometry.ts`; UI code moved to `src/main.ts`. 34 tests, all passing.