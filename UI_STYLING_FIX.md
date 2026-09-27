# UI Styling Fix — Tailwind CSS 4

## Symptom
The React application loaded, but forms and pages appeared as nearly unstyled browser-default HTML. Inputs were full-width/default-bordered, cards lost spacing/rounding, icons overlapped fields, and responsive grids did not activate.

## Root cause
The project depends on Tailwind CSS 4 (`tailwindcss` + `@tailwindcss/postcss`), while `src/index.css` still used the Tailwind CSS 3 directives:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

With the installed Tailwind 4 toolchain, those legacy directives did not generate the utility classes used throughout the React components.

## Correction
`src/index.css` was migrated to Tailwind 4 CSS-first configuration:

```css
@import "tailwindcss";

@theme {
  /* Invoice & Receipt Maker custom primary/dark/status tokens */
}
```

The app-specific primary, dark, status, font and shadow tokens were moved into `@theme`, while the existing responsive/mobile custom CSS was preserved.

## Verification
- Existing release audit: **18/18 PASS**
- Tailwind 4 compiler smoke test: **41/41 representative Business Setup utilities generated**
- Verified examples include `p-4`, `lg:p-6`, `max-w-4xl`, `bg-primary-600`, `text-gray-900`, `md:grid-cols-2`, `rounded-lg`, `focus:ring-primary-500`, and `border-gray-200`.
- No financial/store/report/PDF/backup logic was changed.

## Retest
From the project folder:

```bash
npm ci
npm run dev
```

Then open the URL printed by Vite (normally `http://localhost:5173`). Do **not** open `index.html` directly as a file.

If you had the old build open, stop the dev server, restart it, and hard-refresh the browser (`Ctrl+Shift+R`).
