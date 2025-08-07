# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal portfolio website for William Miner (williamminer.com), hosted on GitHub Pages. It's a simple static HTML/CSS/JS website with no build process or frameworks - just vanilla web technologies.

## Architecture

- **Frontend**: Vanilla HTML5, CSS, and JavaScript
- **Styling**: Uses Tufte CSS for typography and custom CSS for layout and theming
- **JavaScript**: Single `index.js` file handling location-based greetings and interactive elements
- **Dependencies**: Minimal - only axios for potential API calls and fs (unused)
- **Deployment**: Static files served directly via GitHub Pages

## Development Commands

```bash
# Start local development server
npm run dev

# No build process required - direct file editing
# No linting or testing setup currently configured
```

## Key Files

- `index.html` - Main page structure and content
- `index.js` - JavaScript functionality (location greetings, animations, dropdowns)
- `style.css` - Custom styling and dark mode support
- `tufte.css` - Typography framework
- `config.js` - Contains API token (currently unused)

## Notable Features

- **Location-based greetings**: JavaScript detects user's timezone/locale and shows appropriate greeting
- **Interactive elements**: Collapsible sections for coaching services
- **Responsive design**: Works across devices
- **Dark mode support**: CSS variables and media queries

## Content Structure

The site includes sections for:
- Personal introduction
- Speaking and writing portfolio
- Coaching and advising services
- Creative experiments and projects

## Development Notes

- No TypeScript, no build tools - direct file editing
- Uses live-server for local development
- All assets (images, styles, scripts) are committed to repository
- API token in config.js appears unused and should be reviewed for security