# Architecture

## Runtime

The app is a static Vite site with two entry points:

- `index.html` loads `src/landing.js`, the product introduction page.
- `workspace.html` loads `src/main.js`, the data workbench.

Both pages read and write the `json-atlas-theme` local-storage preference (`system`, `light`, or `dark`). The workbench keeps document contents in JavaScript memory for the lifetime of the page. It does not persist document text.

## Data model

`src/core.js` converts parsed input into a small tagged tree:

```text
{ type: "object", entries: [{ key, value }] }
{ type: "array", items: [value] }
{ type: "string" | "number" | "boolean" | "null", value or raw }
```

Number nodes keep JSON number text in `raw`. This avoids converting a large JSON integer through JavaScript's imprecise `Number` type. The same model powers nested expansion, JSON serialization, path flattening, and structural comparison.

## Workbench state and rendering

`src/main.js` owns the active document, its original-source snapshot, working text, selected format, active view, search, comparison text, and per-tab state. The source editor is the editable working copy. Valid input is automatically formatted after a short pause. The original-source view is a separate editable snapshot captured on initial entry/import; the formatted-source view edits the working copy.

The result renderer replaces the view component when the selected mode changes:

- `graph`: `src/graph.js` builds graph nodes from the tagged tree and renders them through React Flow. Card child values navigate down; a nested card header navigates to its parent. Layout order follows source order.
- `tree`: `vanilla-jsoneditor` displays and edits the tree. Changes flow back to the working source.
- `table`: Tabulator displays a recursive data tree.
- `columns`: the app renders navigable path columns.
- `source` and `original`: CodeMirror displays the editable formatted copy or original-source snapshot.
- `compare`: two CodeMirror editors feed a structural diff. The right pane renders the merged data and scrolls in sync with both editors.

Input parsing and conversion are kept separate from view code in `src/core.js`. Browser-only libraries are loaded by the workbench entry point.

## Trust boundaries

- User data remains in browser memory and is not sent to an application API.
- User-controlled text inserted into HTML templates must pass through `escapeHtml`.
- Graph labels and editor values are rendered as text by their respective libraries.
- Import and export use browser file APIs; export creates a local download.

## Change guidance

- Add parsing, node conversion, serialization, path flattening, and structural diff behavior to `src/core.js` and cover it with `node:test` cases.
- Keep DOM event wiring and app state in `src/main.js`; keep graph layout and card interactions in `src/graph.js`.
- Keep landing-page appearance separate from the workbench while reusing the shared theme preference key.
- Update README and `docs/FORMATS.md` when supported formats or conversion semantics change.
