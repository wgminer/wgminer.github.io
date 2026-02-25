# Experiments

Optional features that can be re-enabled on the site.

## Cursor draw

Draws a thin line (accent color) on the background as you move the cursor. Click the background (not links) to toggle on/off.

**To add back:**

1. In `index.html`, add inside `<body>` (e.g. right after the opening tag):
   ```html
   <script src="./experiments/cursor-draw.js"></script>
   ```
2. In `style.css`, add to `body`: `position: relative; z-index: 1;`
3. In `style.css`, add to `article`: `position: relative; z-index: 1;`

This keeps the canvas behind the main content.
