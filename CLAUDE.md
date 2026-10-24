# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal site for Will Miner (williamminer.com), hosted on GitHub Pages. Plain static HTML and CSS, no build process or frameworks.

## Architecture

- **Pages**: `index.html` (homepage) and one folder per blog post under `blog/` (e.g. `blog/hiring-at-slack/index.html`)
- **Styling**: Single `style.css` shared by every page. Colors are CSS variables on `:root` with a dark-mode override. Type is Newsreader from Google Fonts.
- **JavaScript**: Only a small inline script in `index.html` that reveals the page once fonts load (avoids layout shift)
- **Deployment**: Static files served directly via GitHub Pages; custom domain set in `CNAME`

## Development

```bash
# Local server (Will runs this himself; ask him to test)
npm run dev
```

No build, lint, or test setup.

## Key Files

- `index.html` - Homepage: intro, Speaking and writing, Projects
- `blog/<slug>/index.html` - Published posts; `blog/<slug>.md` is the source draft
- `style.css` - All styling, light and dark themes
- `img/share/` - 1200x630 social share cards (`og:image` / `twitter:image`), one per page
- `sitemap.xml`, `robots.txt` - Keep the sitemap updated when adding a post

## Adding a blog post

1. Create `blog/<slug>/index.html` by copying an existing post (it links `../../style.css`)
2. Fill in title, description, canonical, and Open Graph / Twitter meta
3. Make a share card in `img/share/<slug>.jpg` at 1200x630 matching the existing ones
4. Link it from the Speaking and writing list in `index.html`
5. Add it to `sitemap.xml`

## Notes

- Projects (Harness, World Clock, Sounds) live in separate repos served under the same domain, so they're linked with relative paths in the same tab
- `art-generator.js`, `experiments/`, `img/backgrounds/`, and the unused images in `img/` are leftovers not referenced by any page
- `config.js` is gitignored and unused
