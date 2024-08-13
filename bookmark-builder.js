const axios = require("axios");
const fs = require("fs");
const { API_TOKEN } = require("./config");

const COLLECTION_ID = 0; // 0 to get all raindrops except Trash
const PER_PAGE = 50; // Maximum number of raindrops per page
const OUTPUT_FILE = "bookmarks.html";

async function getAllRaindrops() {
  let page = 0;
  let allRaindrops = [];
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await axios.get(
        `https://api.raindrop.io/rest/v1/raindrops/${COLLECTION_ID}`,
        {
          headers: {
            Authorization: `Bearer ${API_TOKEN}`,
          },
          params: {
            page: page,
            perpage: PER_PAGE,
            sort: "-created",
          },
        }
      );

      if (
        response.data &&
        response.data.items &&
        response.data.items.length > 0
      ) {
        allRaindrops = allRaindrops.concat(response.data.items);
        page += 1;
      } else {
        hasMore = false;
      }
    }

    console.log(`Total Raindrops: ${allRaindrops.length}`);
    generateHTML(allRaindrops);
  } catch (error) {
    console.error("Error fetching raindrops:", error);
  }
}

function generateHTML(raindrops) {
  let htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <title>Will Miner on the world wide web</title>
    <link rel="stylesheet" href="./tufte.css" />
    <link rel="stylesheet" href="./style.css" />
    <link rel="icon" href="./favicon.ico" type="image/x-icon" />
  </head>
  <body>
      <h1>Bookmarks</h1>
      <ul>
  `;

  raindrops.forEach((raindrop) => {
    htmlContent += `
          <li>
              <a href="${raindrop.link}" target="_blank">${raindrop.title}</a>
          </li>
      `;
  });

  htmlContent += `
      </ul>
  </body>
  </html>
  `;

  fs.writeFileSync(OUTPUT_FILE, htmlContent, "utf8");
  console.log(`HTML file created: ${OUTPUT_FILE}`);
}

getAllRaindrops();
