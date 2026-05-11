"use strict";

/**
 * Runs the Raindrop bookmark build (same as npm run build:bookmarks), then starts live-server.
 * If the build fails (no token, 401, etc.), prints a warning and still opens the dev server.
 */

require("dotenv").config();

const { spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");

let liveServerStarted = false;

function startLiveServer() {
  if (liveServerStarted) return;
  liveServerStarted = true;

  const liveServer = path.join(root, "node_modules", "live-server", "live-server.js");
  const srv = spawn(process.execPath, [liveServer, "--port=8000", "--open=index.html"], {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });

  srv.on("close", (exitCode) => process.exit(exitCode ?? 0));
}

const build = spawn(process.execPath, [path.join(root, "build.js")], {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});

build.on("error", (err) => {
  console.warn("Could not start bookmark build:", err.message);
  startLiveServer();
});

build.on("close", (code) => {
  if (code !== 0) {
    console.warn(
      "\nBookmark build did not complete (missing RAINDROP_TOKEN, API error, etc.). Starting dev server anyway.\n"
    );
  }

  startLiveServer();
});
