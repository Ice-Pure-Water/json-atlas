# Architecture

## Runtime

The app is a static Vite site with two entry points:

- `index.html` loads `src/landing.js`, the product introduction page.
- `workspace.html` loads `src/main.js`, the data workbench.

Both pages use `src/shared/theme.js` for the `json-atlas-theme` preference (`system`, `light`, or `dark`). The workbench keeps document contents in JavaScript memory for the lifetime of the page. It does not persist document text.

## Data model

`src/core.js` converts parsed input into a small tagged tree:

```text
{ type: "object", entries: [{ key, value }] }
{ type: "array", items: [value] }
{ type: "string" | "number" | "boolean" | "null", value or raw }
```

Number nodes keep JSON number text in `raw`. This avoids converting a large JSON integer through JavaScript's imprecise `Number` type. The same model powers nested expansion, JSON serialization, path flattening, and structural comparison.

## Workbench state and rendering

`src/main.js` is a thin browser entry point. It loads `src/workbench/app.js`, which owns the active document, source snapshots, selected format, active view, search, comparison text, and in-memory document tabs. The shell markup lives in `src/workbench/shell.js`; the app controller composes focused modules for formatting and conversion (`formatting.js`), structural views (`data-views.js`), comparison rendering (`diff-renderer.js`), and graph interaction (`src/graph.js`).

The result renderer replaces the view component when the selected mode changes:

- `graph`: `src/graph.js` builds graph nodes from the tagged tree and renders them through React Flow. Card child values navigate down; a nested card header navigates to its parent. Layout order follows source order.
- `tree`: `vanilla-jsoneditor` displays and edits the tree. Changes flow back to the working source.
- `table`: Tabulator displays a recursive data tree.
- `graph`: React Flow and editable path columns render together. Selection stays synchronized; the path pane can replace a selected node value while preserving the document format.
- `editor`: CodeMirror displays the editable formatted copy above the collapsible, read-only original-source snapshot.
- `compare`: two CodeMirror editors feed a structural diff. The right pane renders the merged data and scrolls in sync with both editors.

Input parsing and conversion are kept separate from view code in `src/core.js`. `src/landing.js` is likewise a small entry point: it mounts the product page from `src/landing/shell.js` and attaches the same theme controller used by the workbench. Browser-only libraries are loaded by the workbench controller.

## Trust boundaries

- User data remains in browser memory and is not sent to an application API.
- User-controlled text inserted into HTML templates must pass through `escapeHtml`.
- Graph labels and editor values are rendered as text by their respective libraries.
- Import and export use browser file APIs; export creates a local download.

## Change guidance

- Add parsing, node conversion, serialization, path flattening, and structural diff behavior to `src/core.js` and cover it with `node:test` cases.
- Keep parsing and the tagged data model in `src/core.js`; keep graph layout and card interactions in `src/graph.js`.
- Keep workbench shell markup in `src/workbench/shell.js` and app coordination in `src/workbench/app.js`. Put pure data transformations in focused modules rather than adding more helpers to the controller.
- Keep landing-page markup in `src/landing/shell.js` and reuse `src/shared/theme.js` for appearance preference behavior.
- Update README and `docs/FORMATS.md` when supported formats or conversion semantics change.
