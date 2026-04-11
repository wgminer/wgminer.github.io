# williamminer.com

Personal website and writing archive for [williamminer.com](https://williamminer.com).

## Local development

- Install dependencies: `npm install`
- Build blog pages: `npm run build:blog`
- Start local server: `npm run dev`

The dev command rebuilds blog content first, then serves the site at `http://127.0.0.1:8000`.

## Blog workflow

- Write posts as Markdown files in `blog/*.md`
- Include frontmatter at the top of each post:

```md
---
title: Post title
date: YYYY-MM-DD
description: One-sentence summary.
---
```

- Run `npm run build:blog` to generate:
  - `blog/<slug>.html` for each Markdown post
  - `blog/index.html` list page

## Project structure

- `index.html` - homepage
- `style.css` - global styles
- `scripts/build-blog.js` - lightweight blog generator
- `blog/` - Markdown sources and generated blog pages
