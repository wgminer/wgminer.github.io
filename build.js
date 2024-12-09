const axios = require("axios");
const fs = require("fs");
const path = require("path");
const prettier = require("prettier");
const { API_TOKEN } = require("./config");

const COLLECTION_ID = 0;
const PER_PAGE = 50;
const OUTPUT_DIR = "bookmarks";
const BOOKMARK_START = "<!-- START BOOKMARKS -->";
const BOOKMARK_END = "<!-- END BOOKMARKS -->";

async function main() {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR);
    }

    const bookmarks = await fetchBookmarks();
    await generateBookmarksPage(bookmarks);
    await updateIndexPage(bookmarks.slice(0, 3));

    console.log("Build complete!");
  } catch (error) {
    console.error("Build failed:", error);
  }
}

async function fetchBookmarks() {
  let page = 0;
  let bookmarks = [];

  while (true) {
    const response = await axios.get(
      `https://api.raindrop.io/rest/v1/raindrops/${COLLECTION_ID}`,
      {
        headers: { Authorization: `Bearer ${API_TOKEN}` },
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

function renderBookmark(bookmark) {
  // Default
  let html = `
    <a  class="bookmark__title" target="_blank" href="${bookmark.link}" rel="noopener noreferrer">${bookmark.title}</a>
    <div class="bookmark__excerpt">${bookmark.excerpt}</div>`;

  // Image
  if (bookmark.type === "image") {
    html = `
      <div>
        <img class="bookmark__image" src="${bookmark.link}" alt="${bookmark.title}" />
        <div class="bookmark__title">${bookmark.title}</div>
      </div>`;
  }

  // Youtube
  if (
    bookmark.link.includes("youtube.com") ||
    bookmark.link.includes("youtu.be")
  ) {
    const videoId = getYouTubeId(bookmark.link);
    html = `
      <div>
        <iframe class="bookmark__embed" width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
        <div class="bookmark__title">${bookmark.title}</div>
      </div>`;
  }

  // Twitter/X
  if (
    bookmark.link.includes("twitter.com") ||
    bookmark.link.includes("x.com")
  ) {
    const tweetUrl = bookmark.link.split("?")[0]; // Remove query parameters
    html = `
      <div>
        <blockquote class="twitter-tweet">
          <a href="${tweetUrl}"></a>
        </blockquote>
        <script async src="https://platform.twitter.com/widgets.js"></script>
      </div>`;
  }

  return `<li>${html}</li>`;
}

async function generateBookmarksPage(bookmarks) {
  let content = fs.readFileSync(path.join(OUTPUT_DIR, "index.html"), "utf8");

  const startIndex = content.indexOf(BOOKMARK_START);
  const endIndex = content.indexOf(BOOKMARK_END);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error("Bookmark markers not found in bookmarks/index.html");
  }

  const groupedBookmarks = groupBookmarksByDate(bookmarks);

  const bookmarkContent = `${BOOKMARK_START}
      ${Object.entries(groupedBookmarks)
        .map(
          ([monthYear, monthBookmarks]) => `
        <h2>${monthYear}</h2>
        <ul class="bookmark-list">
          ${monthBookmarks.map((bookmark) => renderBookmark(bookmark)).join("\n")}
        </ul>
      `
        )
        .join("\n")}
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

  fs.writeFileSync(path.join(OUTPUT_DIR, "index.html"), prettified);
}

async function updateIndexPage(recentBookmarks) {
  let content = fs.readFileSync("index.html", "utf8");

  const startIndex = content.indexOf(BOOKMARK_START);
  const endIndex = content.indexOf(BOOKMARK_END);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error("Bookmark markers not found");
  }

  const bookmarkContent = `${BOOKMARK_START}
    <ul class="bookmark-list">
      ${recentBookmarks.map((bookmark) => renderBookmark(bookmark)).join("\n")}
    </ul>
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

  fs.writeFileSync("index.html", prettified);
}

main();
