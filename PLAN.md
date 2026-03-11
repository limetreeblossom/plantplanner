# Flowerbed Planner — Project Plan

## Overview

A browser-based tool for planning flowerbeds. Users draw shapes representing beds, assign plants to them, and get a total plant count as output. Runs from local files; no server or build step required.

---

## Architecture Decisions

### Tech stack
- **Plain HTML + JavaScript + CSS** — no framework, no build step, runs directly from the filesystem
- **SVG** for the drawing canvas — shapes are objects (not pixels), enabling click-to-select, move, and resize without redrawing
- **Fabric.js** (or plain SVG + JS) for the object model layer
- **jsPDF** for PDF export
- **CSV export** via a Blob download (no library needed)
- **Vitest** for unit testing (introduced at Phase 3)

### Data model
- Each design is a single JSON file containing shapes, plant assignments, and the plant database
- The plant database ships as a bundled `plants.json` (~20 common plants) that the user can extend via UI

### Plant density calculation
- Default: **hexagonal packing** — `count = area / (spacing² × 0.866)`
- User can override the count per shape manually (mixed mode)

### Units
- **Meters** as the primary unit
- Feet toggle can be added later as a display layer

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

### Phase 2 — Plant Assignment & Counts
**Goal:** Validate the core value proposition. No tests yet.

- Hardcoded plant list (5–10 plants with default spacing)
- Assign a plant to a selected shape via dropdown
- Calculate and display plant count per shape
- Running total plant list shown on screen

**Done when:** Assign "Rose (0.5m spacing)" to a shape and see "24 plants needed"

---

### ⚑ Prototype validation checkpoint

Before proceeding to Phase 3, validate that the core UX feels right. Then:
- Refactor pure logic (area calculation, density formula, data model) into separate `.js` modules
- These modules become the target for test coverage going forward
- **All phases from here use a test-first (TDD) approach**

---

### Phase 3 — Plant Database Management
**Approach: TDD**

- Load plant data from `plants.json`
- UI panel to add, edit, and delete plants (name, spacing, colour swatch)
- Support manual override of plant count per shape
- Spec the plant CRUD operations and density calculations before implementing

**Done when:** Add a custom plant, assign it, and manually override its count in one bed

---

### Phase 4 — Save / Load / Export
**Approach: TDD**

- Save full design as `.json` (shapes + assignments + plant database)
- Load a `.json` file to restore a design
- Export plant summary to CSV
- Export a printable PDF with canvas image + plant list table

**Done when:** Full round-trip — design → save → reload → export PDF

---

### Phase 5 — Polish & UX
**Approach: TDD for logic, lightweight for UI**

- Grid overlay with snap-to-grid
- Zoom and pan the canvas
- Undo/redo (command pattern)
- Keyboard shortcuts

---

### Phase 6 (Future) — Shape Templates
_Deferred — revisit after Phase 5 is complete._

- Pre-defined shapes: L-shape, kidney, border strip
- Templates are polygon/path presets dropped onto the canvas
- Resize and assign plants like any other shape

---

## Validated Assumptions

| Topic | Decision |
|---|---|
| Units | Meters primary; feet toggle deferred |
| Density model | Hexagonal packing with manual override |
| Overlap handling | Beds are independent; no overlap detection |
| Scope per design | One flowerbed at a time |
| Plant database | Bundled `plants.json`, user-extendable via UI |
| Save format | JSON file download/upload |
| Output | On-screen list + CSV export + PDF export |
| Devices | Desktop with mouse |
| Framework | None — plain HTML/JS/CSS |
| Testing | None for Phases 1–2; TDD from Phase 3 onwards |
| Multi-user | Not in scope |

---

## Status

| Phase | Status |
|---|---|
| 1 — Canvas & Shapes | ✅ Complete |
| 2 — Plant Assignment | ✅ Complete |
| 3 — Plant Database | ⬜ Not started |
| 4 — Save / Load / Export | ⬜ Not started |
| 5 — Polish & UX | ⬜ Not started |
| 6 — Templates (deferred) | ⏸ Deferred |

---

## Changelog

_Update this section as phases complete or decisions change._

- **2026-03-11** — Initial plan created. Phases defined, assumptions validated.
- **2026-03-11** — Phase 1 complete. Single `index.html`, SVG canvas with grid, draw rect/circle/ellipse, select/delete, info panel with real-world dimensions and area.
- **2026-03-11** — Phase 2 complete. 10-plant hardcoded database, dropdown assignment on selected shape, hexagonal packing count, canvas label updates, running plant summary panel.