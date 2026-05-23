# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev    # development — nodemon auto-restarts on server.js changes
npm start      # production — plain node
```

App runs at `http://localhost:3000`. There are no tests and no lint step.

To package a distributable Windows executable:
```bash
npx pkg .
```
Output lands in `dist/` (target: `node18-win-x64`). The `pkg` config in `package.json` bundles `public/` and `data/`.

## Architecture

Single-page application with a thin Express backend. All logic lives in two files:

**`server.js`** — REST API + static file server. Stateless per-request; reads/writes JSON files directly on every call (no database, no in-memory cache). Projects are listed in `data/projects.json`; each project's items live in `data/<slug>-<timestamp>/` as individual `<id>.json` files. `nextId` is stored on the project record and incremented on each item creation.

**`public/index.html`** — the entire frontend: all CSS, HTML, and JS in one file. No build step, no framework. State is held in module-level `let` variables (`allItems`, `activeProject`, `activeFilters`, etc.). Rendering is manual innerHTML string-building — there is no virtual DOM or templating library.

## Data model

**Projects** (`data/projects.json`): array of `{ id, name, dataDir, kanbanColumns, nextId }`.

**Items** (`data/<dataDir>/<id>.json`): `{ id, type, title, status, priority, tags, description, subtasks, relations, createdAt, updatedAt }` plus type-specific fields:
- `milestone` — no extra fields (completion % is computed client-side from child tasks)
- `design_doc` — adds `implementation` (`"Optional"` | `"Required"`) and `milestoneId`
- `task` — adds `milestoneId`

Subtasks are inline arrays `[{ text, done }]` — not separate items. Relations are inline arrays `[{ targetId, type }]` where `type` is `"blocked_by"` or `"related_to"`. Blocking is enforced server-side on `PUT` when transitioning to `Closed`.

## Frontend patterns

- **`esc(str)`** — always use this when interpolating user data into innerHTML strings to prevent XSS.
- **`api(method, path, body)`** — central fetch wrapper; throws on non-2xx.
- **`renderView()`** — re-renders whichever view is active (tree or kanban). Call this after any state change.
- **`getFilteredItems()`** — applies `activeFilters` (Sets for types, statuses, priorities, tags) to `allItems`. Filters are multi-select.
- **Filter dropdown** — uses a `_filterValues` lookup table keyed by `fvN` strings so that user-defined tag values (arbitrary strings) can be safely referenced from inline `onclick` handlers without injection risk.
- **Kanban drag-drop** — SortableJS instances are stored in `sortableInstances[]` and destroyed before each re-render to avoid leaks.

## Design constraints (from DESIGN.md)

- Terminal aesthetic: monospace, green-on-black, CSS variables in `:root`.
- Object IDs are project-scoped auto-incrementing integers, displayed as `#N`.
- Kanban columns are fully configurable per project (stored on the project record, not hardcoded).
- Closing a `Closed` item fires confetti (canvas-confetti CDN).
