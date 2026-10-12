# Contributing

Thanks for helping improve JSON Atlas.

## Development

1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Run `npm run dev` and open the local URL printed by Vite.
4. Run `npm run format:check`, `npm test`, and `npm run build` before submitting changes.

## Project principles

- Keep document parsing and transformations in the browser.
- Never transmit user data or add account, cloud-save, or sharing features.
- Preserve JSON number text through parse, transform, comparison, and export.
- Only expand complete JSON object or array strings by default; keep ordinary text intact.
- Keep dependencies focused and disclose format-specific conversion behavior.
- Escape user-controlled text before placing it in HTML templates.
- Keep data-core logic testable without browser APIs; add regression cases to `test/`.

## Pull requests

Describe the user-visible change, formats affected, and any precision or privacy implications. Include a small input/output example when changing parsing behavior.

Run `npm run format:check`, `npm test`, and `npm run build` locally. For UI changes, include the affected workbench view and theme in the description so the change can be reviewed against the correct state.
