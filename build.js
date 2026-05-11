require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const prettier = require("prettier");

const COLLECTION_ID = 0;
const PER_PAGE = 50;
const OUTPUT_DIR = "bookmarks";
const INDEX_HTML = "index.html";
const BOOKMARK_START = "<!-- START BOOKMARKS -->";
const BOOKMARK_END = "<!-- END BOOKMARKS -->";
const HOME_BOOKMARK_START = "<!-- START HOME BOOKMARKS -->";
const HOME_BOOKMARK_END = "<!-- END HOME BOOKMARKS -->";
const HOME_BOOKMARK_PREVIEW = 10;

/** Order: RAINDROP_TOKEN / API_TOKEN env, then optional config.js (gitignored). */
function loadApiToken() {
  const raw =
    process.env.RAINDROP_TOKEN ||
    process.env.API_TOKEN ||
    "";
  let t = String(raw).trim();
  if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1);
  if (t.startsWith("'") && t.endsWith("'")) t = t.slice(1, -1);
  t = t.trim();
  if (t) return t;

  try {
    const cfg = require("./config");
    t = String(cfg.API_TOKEN || "").trim();
    if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1);
    if (t.startsWith("'") && t.endsWith("'")) t = t.slice(1, -1);
    return t.trim();
  } catch {
    return "";
  }
}

let apiToken = "";

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncatePlainText(str, maxLen) {
  const s = String(str || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > maxLen * 0.5 ? cut.slice(0, lastSpace) : cut;
  return base.trimEnd() + "…";
}

async function main() {
  try {
    apiToken = loadApiToken();
    if (!apiToken) {
      console.error(`
No Raindrop API token found.

Set RAINDROP_TOKEN in a .env file (see .env.example), or:

  export RAINDROP_TOKEN='…'

Alternatively create config.js from config.example.js.

Get a non-expiring token: https://app.raindrop.io/#/settings/apps
Open (or create) an app → copy the **Test token** — not Client ID, and not an
old OAuth access_token (those expire after ~2 weeks).
`);
      process.exit(1);
    }

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR);
    }

    const bookmarks = await fetchBookmarks();
    console.log(
      `Raindrop: ${bookmarks.length} bookmark(s) fetched → writing bookmarks/index.html`
    );

    await generateBookmarksPage(bookmarks);
    await generateHomeBookmarks(bookmarks);

    console.log("Build complete!");
  } catch (error) {
    if (error?.response?.status === 401) {
      console.error(`
Raindrop rejected the token (401).

• Regenerate the **Test token** in App settings: https://app.raindrop.io/#/settings/apps
• If you were using an OAuth access_token from the authorization flow, it may have
  expired — use the Test token for builds instead.
• Verify in terminal:
  curl -s -H "Authorization: Bearer YOUR_TOKEN" https://api.raindrop.io/rest/v1/user

Docs: https://developer.raindrop.io/v1/authentication/token
`);
      process.exit(1);
    }
    console.error("Build failed:", error);
    process.exit(1);
  }
}

async function fetchBookmarks() {
  let page = 0;
  let bookmarks = [];

  while (true) {
    const response = await axios.get(
      `https://api.raindrop.io/rest/v1/raindrops/${COLLECTION_ID}`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
        params: {
          page,
          perpage: PER_PAGE,
          sort: "-created",
        },
      }
    );

    const items = response.data?.items || [];
    if (items.length === 0) break;

    bookmarks = bookmarks.concat(items);
    page++;
  }
  return bookmarks;
}

function getYouTubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function groupBookmarksByDate(bookmarks) {
  const grouped = {};

  bookmarks.forEach((bookmark) => {
    const date = new Date(bookmark.created);
    const monthYear = date.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });

    if (!grouped[monthYear]) {
      grouped[monthYear] = [];
    }
    grouped[monthYear].push(bookmark);
  });

  return grouped;
}

function monthSectionId(monthYear) {
  return `bm-${String(monthYear)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

function formatBookmarkDay(created) {
  const d = new Date(created);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function bookmarkDatetimeAttr(created) {
  const d = new Date(created);
  if (Number.isNaN(d.getTime())) return "";
  return escapeHtml(d.toISOString());
}

/** Path looks like a direct image asset (Raindrop often keeps type as "link"). */
function looksLikeDirectImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const pathOnly = url.split("?")[0].split("#")[0];
    return /\.(gif|jpe?g|png|webp|avif|svg)(\b|$)/i.test(pathOnly);
  } catch {
    return false;
  }
}

/** Raindrop parsed preview image (Open Graph, etc.). */
function bookmarkCoverUrl(bookmark) {
  const c = bookmark.cover;
  if (c && String(c).trim()) return String(c).trim();
  const media = bookmark.media;
  if (Array.isArray(media) && media[0] && media[0].link)
    return String(media[0].link).trim();
  return "";
}

function isFullBleedImageBookmark(bookmark) {
  if (bookmark.type === "image") return true;
  return looksLikeDirectImageUrl(bookmark.link);
}

function bookmarkDomain(bookmark) {
  const d = bookmark.domain;
  if (d != null && String(d).trim()) {
    return String(d).trim().replace(/^www\./i, "");
  }
  try {
    return new URL(bookmark.link).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function renderBookmark(bookmark) {
  const title = escapeHtml(bookmark.title);
  const excerpt = escapeHtml(bookmark.excerpt || "");
  const link = escapeHtml(bookmark.link);
  const day = formatBookmarkDay(bookmark.created);
  const timeAttr = bookmarkDatetimeAttr(bookmark.created);

  if (
    bookmark.link.includes("twitter.com") ||
    bookmark.link.includes("x.com")
  ) {
    const tweetUrl = bookmark.link.split("?")[0];
    return `<tr class="bookmark-table__row bookmark-table__row--embed">
      <td colspan="3" class="bookmark-table__embed-cell">
        <div class="bookmark-table__embed-block">
          <blockquote class="twitter-tweet">
            <a href="${escapeHtml(tweetUrl)}"></a>
          </blockquote>
          <script async src="https://platform.twitter.com/widgets.js"></script>
        </div>
      </td>
    </tr>`;
  }

  if (
    bookmark.link.includes("youtube.com") ||
    bookmark.link.includes("youtu.be")
  ) {
    const videoId = getYouTubeId(bookmark.link);
    if (videoId) {
      return `<tr class="bookmark-table__row bookmark-table__row--embed">
      <td colspan="3" class="bookmark-table__embed-cell">
        <div class="bookmark-table__embed-block">
          <iframe class="bookmark__embed" title="${title}" width="560" height="315" src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>
          <p class="bookmark-table__caption">${title}</p>
        </div>
      </td>
    </tr>`;
    }
  }

  /* Image / direct image URL: visual is only the image (no title row). */
  if (isFullBleedImageBookmark(bookmark)) {
    return `<tr class="bookmark-table__row bookmark-table__row--media">
      <td colspan="3" class="bookmark-table__media-cell">
        <div class="bookmark-media bookmark-media--solo">
          <a class="bookmark-media__link" target="_blank" href="${link}" rel="noopener noreferrer" aria-label="${title}">
            <img class="bookmark__image" src="${link}" alt="" loading="lazy" decoding="async" />
          </a>
        </div>
      </td>
    </tr>`;
  }

  const isArticle = bookmark.type === "article";
  const domainEsc = isArticle ? escapeHtml(bookmarkDomain(bookmark)) : "";

  const excerptCell = isArticle
    ? `<span class="bookmark-table__empty" aria-hidden="true">—</span>`
    : excerpt
      ? excerpt
      : `<span class="bookmark-table__empty" aria-hidden="true">—</span>`;

  const dateMarkup = timeAttr
    ? `<time datetime="${timeAttr}">${day}</time>`
    : day;

  const coverRaw = bookmarkCoverUrl(bookmark);
  const coverEsc = coverRaw ? escapeHtml(coverRaw) : "";
  const showTitleThumb = Boolean(coverEsc && coverEsc !== link);

  const titleLinkOnly = showTitleThumb
    ? `<div class="bookmark-table__title-block">
        <img class="bookmark-table__thumb" src="${coverEsc}" alt="" loading="lazy" decoding="async" />
        <a class="bookmark-table__title" target="_blank" href="${link}" rel="noopener noreferrer">${title}</a>
      </div>`
    : `<a class="bookmark-table__title" target="_blank" href="${link}" rel="noopener noreferrer">${title}</a>`;

  const titleMarkup =
    isArticle && domainEsc
      ? `<div class="bookmark-table__article-head">${titleLinkOnly}<span class="bookmark-table__domain">${domainEsc}</span></div>`
      : titleLinkOnly;

  return `<tr class="bookmark-table__row${isArticle ? " bookmark-table__row--article" : ""}">
    <td class="bookmark-table__date">${dateMarkup}</td>
    <td class="bookmark-table__title-cell">${titleMarkup}</td>
    <td class="bookmark-table__excerpt">${excerptCell}</td>
  </tr>`;
}

async function generateBookmarksPage(bookmarks) {
  const templatePath = path.join(OUTPUT_DIR, "index.html");
  let content = fs.readFileSync(templatePath, "utf8");

  const startIndex = content.indexOf(BOOKMARK_START);
  const endIndex = content.indexOf(BOOKMARK_END);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error("Bookmark markers not found in bookmarks/index.html");
  }

  const groupedBookmarks = groupBookmarksByDate(bookmarks);

  let monthSections = Object.entries(groupedBookmarks)
    .map(
      ([monthYear, monthBookmarks]) => {
        const mid = monthSectionId(monthYear);
        return `
        <section class="bookmark-month" aria-labelledby="${mid}">
        <h2 class="bookmark-month__label" id="${mid}">${escapeHtml(monthYear)}</h2>
        <div class="bookmark-table-scroll">
        <table class="bookmark-table">
          <thead>
            <tr>
              <th scope="col">Saved</th>
              <th scope="col">Title</th>
              <th scope="col">Excerpt</th>
            </tr>
          </thead>
          <tbody>
            ${monthBookmarks.map((bookmark) => renderBookmark(bookmark)).join("\n")}
          </tbody>
        </table>
        </div>
        </section>
      `;
      }
    )
    .join("\n");

  if (!monthSections.trim()) {
    monthSections = `<p class="bookmark-sync-hint">Raindrop returned no bookmarks for this collection.</p>`;
  }

  const bookmarkContent = `${BOOKMARK_START}
      ${monthSections}
      ${BOOKMARK_END}`;

  content =
    content.substring(0, startIndex) +
    bookmarkContent +
    content.substring(endIndex + BOOKMARK_END.length);

  const prettified = await prettier.format(content, {
    parser: "html",
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
  });

  fs.writeFileSync(templatePath, prettified);
}

/** Simple list items for the homepage (no embeds). */
function renderHomeBookmarkItem(bookmark) {
  const title = escapeHtml(bookmark.title);
  const link = escapeHtml(bookmark.link);
  const rawExcerpt = bookmark.excerpt || "";
  const excerpt = truncatePlainText(rawExcerpt, 220);
  const excerptHtml = excerpt ? escapeHtml(excerpt) : "";
  const domainEsc = escapeHtml(bookmarkDomain(bookmark));

  if (isFullBleedImageBookmark(bookmark)) {
    return `<li class="bookmark-home__item bookmark-home__item--figure">
      <a class="bookmark-home__figure-link" target="_blank" href="${link}" rel="noopener noreferrer" aria-label="${title} (opens in new tab)">
        <img class="bookmark-home__figure-img" src="${link}" alt="" loading="lazy" decoding="async" />
      </a>
    </li>`;
  }

  const isArticle = bookmark.type === "article";
  const coverRaw = bookmarkCoverUrl(bookmark);
  const coverEsc = coverRaw ? escapeHtml(coverRaw) : "";
  const showThumb = Boolean(coverEsc && coverEsc !== link);

  const domainLine =
    isArticle && domainEsc
      ? `<div class="item__description bookmark-home__article-meta"><p class="bookmark-home__domain">${domainEsc}</p></div>`
      : "";

  if (isArticle) {
    if (showThumb) {
      return `<li class="bookmark-home__item bookmark-home__item--thumb bookmark-home__item--article">
      <img class="bookmark-home__thumb" src="${coverEsc}" alt="" loading="lazy" decoding="async" />
      <div class="bookmark-home__main">
        <div class="item__title">
          <a target="_blank" href="${link}" rel="noopener noreferrer">${title}<span class="sr-only"> (opens in new tab)</span></a>
        </div>
        ${domainLine}
      </div>
    </li>`;
    }
    return `<li class="bookmark-home__item bookmark-home__item--article">
      <div class="item__title">
        <a target="_blank" href="${link}" rel="noopener noreferrer">${title}<span class="sr-only"> (opens in new tab)</span></a>
      </div>
      ${domainLine}
    </li>`;
  }

  const desc = excerptHtml
    ? `<div class="item__description"><p>${excerptHtml}</p></div>`
    : "";

  if (showThumb) {
    return `<li class="bookmark-home__item bookmark-home__item--thumb">
      <img class="bookmark-home__thumb" src="${coverEsc}" alt="" loading="lazy" decoding="async" />
      <div class="bookmark-home__main">
        <div class="item__title">
          <a target="_blank" href="${link}" rel="noopener noreferrer">${title}<span class="sr-only"> (opens in new tab)</span></a>
        </div>
        ${desc}
      </div>
    </li>`;
  }

  return `<li class="bookmark-home__item">
      <div class="item__title">
        <a target="_blank" href="${link}" rel="noopener noreferrer">${title}<span class="sr-only"> (opens in new tab)</span></a>
      </div>
      ${desc}
    </li>`;
}

async function generateHomeBookmarks(bookmarks) {
  const indexPath = path.join(__dirname, INDEX_HTML);
  let content = fs.readFileSync(indexPath, "utf8");

  const startIndex = content.indexOf(HOME_BOOKMARK_START);
  const endIndex = content.indexOf(HOME_BOOKMARK_END);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error("Home bookmark markers not found in index.html");
  }

  let inner;

  if (!bookmarks.length) {
    inner = `<p class="bookmark-sync-hint">Raindrop returned no bookmarks for this collection.</p>`;
  } else {
    const preview = bookmarks.slice(0, HOME_BOOKMARK_PREVIEW);
    const listItems = preview.map((b) => renderHomeBookmarkItem(b)).join("\n");
    const showMore =
      bookmarks.length > HOME_BOOKMARK_PREVIEW
        ? `<p class="bookmark-home__more"><a href="./bookmarks/">Show more</a></p>`
        : "";
    inner = `<ul class="link-list">\n${listItems}\n</ul>\n${showMore}`;
  }

  const block = `${HOME_BOOKMARK_START}\n${inner}\n      ${HOME_BOOKMARK_END}`;

  content =
    content.substring(0, startIndex) +
    block +
    content.substring(endIndex + HOME_BOOKMARK_END.length);

  const prettified = await prettier.format(content, {
    parser: "html",
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
  });

  fs.writeFileSync(indexPath, prettified);
}

main();
