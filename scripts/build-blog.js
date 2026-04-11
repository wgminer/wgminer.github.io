#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const blogDir = path.join(rootDir, "blog");

function slugFromFilename(fileName) {
  return path.basename(fileName, path.extname(fileName));
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseFrontMatter(markdown) {
  if (!markdown.startsWith("---\n")) {
    return { meta: {}, content: markdown.trim() };
  }

  const endIndex = markdown.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return { meta: {}, content: markdown.trim() };
  }

  const rawMeta = markdown.slice(4, endIndex);
  const content = markdown.slice(endIndex + 5).trim();
  const meta = {};

  rawMeta.split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) meta[key] = value;
  });

  return { meta, content };
}

function hasFrontMatter(markdown) {
  return markdown.startsWith("---\n") && markdown.indexOf("\n---\n", 4) !== -1;
}

function getValidationWarnings(file, source, meta) {
  const warnings = [];

  if (hasFrontMatter(source)) {
    if (!meta.title) warnings.push("missing required frontmatter field: title");
    if (!meta.date) warnings.push("missing recommended frontmatter field: date");
    if (!meta.description)
      warnings.push("missing recommended frontmatter field: description");
  }

  if (source.includes("\n## title:")) {
    warnings.push("found markdown heading that looks like frontmatter key ('## title: ...')");
  }

  return warnings.map((warning) => `[warn] ${file}: ${warning}`);
}

function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  let paragraph = [];
  let inList = false;

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${escapeHtml(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!inList) return;
    html.push("</ul>");
    inList = false;
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeList();
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${escapeHtml(headingMatch[2])}</h${level}>`);
      return;
    }

    const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${escapeHtml(listMatch[1])}</li>`);
      return;
    }

    closeList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  closeList();
  return html.join("\n");
}

function renderPostPage(post, bodyHtml) {
  const escapedTitle = escapeHtml(post.title);
  const escapedDescription = escapeHtml(post.description || "");
  const escapedDate = escapeHtml(post.date || "");
  const pageDescription = escapedDescription || escapedTitle;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapedTitle} · Will Miner</title>
    <meta name="description" content="${pageDescription}" />
    <link rel="stylesheet" href="../style.css" />
    <link rel="icon" href="../favicon.ico" type="image/x-icon" />
  </head>
  <body>
    <a href="#main" class="skip-link">Skip to main content</a>
    <main id="main">
      <article>
        <p class="more-link"><a href="../index.html">← Back to home</a></p>
        <h1>${escapedTitle}</h1>
        ${escapedDate ? `<p class="item__date">Writing &middot; ${escapedDate}</p>` : ""}
        <section>
          ${bodyHtml}
        </section>
      </article>
    </main>
  </body>
</html>
`;
}

function renderBlogIndex(posts) {
  const items = posts
    .map((post) => {
      const description = post.description
        ? `<div class="item__description">${escapeHtml(post.description)}</div>`
        : "";
      return `          <li>
            <div class="item__title">
              <a href="${escapeHtml(post.slug)}.html">${escapeHtml(post.title)}</a>
            </div>
            <div class="item__date">Writing${post.date ? ` &middot; ${escapeHtml(post.date)}` : ""}</div>
${description}
          </li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Writing · Will Miner</title>
    <meta name="description" content="Writing by Will Miner." />
    <link rel="stylesheet" href="../style.css" />
    <link rel="icon" href="../favicon.ico" type="image/x-icon" />
  </head>
  <body>
    <a href="#main" class="skip-link">Skip to main content</a>
    <main id="main">
      <article>
        <p class="more-link"><a href="../index.html">← Back to home</a></p>
        <h1>Writing</h1>
        <section>
          <p>Collected writing and notes.</p>
          <ul class="link-list">
${items}
          </ul>
        </section>
      </article>
    </main>
  </body>
</html>
`;
}

function build() {
  if (!fs.existsSync(blogDir)) {
    console.log("No blog directory found; skipping.");
    return;
  }

  const files = fs
    .readdirSync(blogDir)
    .filter((file) => file.endsWith(".md"))
    .sort();

  const posts = [];

  files.forEach((file) => {
    const filePath = path.join(blogDir, file);
    const source = fs.readFileSync(filePath, "utf8");
    const { meta, content } = parseFrontMatter(source);
    const warnings = getValidationWarnings(file, source, meta);
    warnings.forEach((warning) => console.warn(warning));
    const slug = slugFromFilename(file);
    const title = meta.title || content.split("\n")[0] || slug;
    const date = meta.date || "";
    const description = meta.description || "";
    const bodyMarkdown = meta.title ? content : content.split("\n").slice(1).join("\n").trim();
    const bodyHtml = markdownToHtml(bodyMarkdown);
    const html = renderPostPage({ slug, title, date, description }, bodyHtml);

    fs.writeFileSync(path.join(blogDir, `${slug}.html`), html, "utf8");
    posts.push({ slug, title, date, description });
  });

  posts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  fs.writeFileSync(path.join(blogDir, "index.html"), renderBlogIndex(posts), "utf8");

  console.log(`Built ${posts.length} blog post page(s).`);
}

build();
