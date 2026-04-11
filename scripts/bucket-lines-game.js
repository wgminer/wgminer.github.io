(function () {
  "use strict";

  var root = document.getElementById("game-root");
  var reducedEl = document.getElementById("bucket-game-reduced");
  var activeEl = document.getElementById("bucket-game-active");
  var canvas = document.getElementById("game-canvas");
  var hudLevel = document.getElementById("hud-level");
  var hudRamps = document.getElementById("hud-ramps");
  var hudStatus = document.getElementById("hud-status");
  var btnClear = document.getElementById("btn-clear");
  var btnReset = document.getElementById("btn-reset");

  if (!root || !canvas || !window.Matter) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    reducedEl.hidden = false;
    return;
  }

  activeEl.hidden = false;

  var Matter = window.Matter;
  var Engine = Matter.Engine;
  var Render = Matter.Render;
  var Runner = Matter.Runner;
  var Bodies = Matter.Bodies;
  var Composite = Matter.Composite;
  var Body = Matter.Body;
  var Events = Matter.Events;

  /** @type {Matter.Engine} */
  var engine;
  /** @type {Matter.Render} */
  var render;
  /** @type {Matter.Runner} */
  var runner;
  /** @type {Matter.Body[]} */
  var anchorBodies = [];

  var levelIndex = 0;
  var levelWon = false;
  var winTimer = null;
  var resizeTimer = null;
  var catches = 0;
  var lastSpawnMs = 0;
  var MAX_BALLS = 42;

  var drawStart = null;
  /** Current end point for in-progress line preview (world px). */
  var previewEnd = null;
  var pointerDownPos = null;
  var movedWhileDown = false;

  var WALL = 44;
  var BALL_R = 8;
  var RAMP_H = 9;
  var MIN_RAMP_LEN = 28;
  var MOVE_THRESHOLD = 6;

  /**
   * bucket.opening = fraction of width (inner opening).
   * bucket.depthPx = inner wall height in px.
   * obstacles: { cx, cy, w, h } in 0–1 fractions of width/height for center and size.
   */
  var LEVELS = [
    {
      maxRamps: 7,
      spawnX: 0.5,
      bucket: { cx: 0.5, opening: 0.26, depthPx: 112 },
      gx: 0,
      ballsToWin: 8,
      spawnMs: 480,
    },
    {
      maxRamps: 6,
      spawnX: 0.4,
      bucket: { cx: 0.62, opening: 0.22, depthPx: 106 },
      gx: 0,
      obstacles: [{ cx: 0.52, cy: 0.36, w: 0.26, h: 0.016 }],
      ballsToWin: 10,
      spawnMs: 440,
    },
    {
      maxRamps: 5,
      spawnX: 0.72,
      bucket: { cx: 0.36, opening: 0.2, depthPx: 102 },
      gx: 0,
      obstacles: [
        { cx: 0.5, cy: 0.4, w: 0.22, h: 0.018 },
        { cx: 0.22, cy: 0.52, w: 0.14, h: 0.022 },
      ],
      ballsToWin: 12,
      spawnMs: 400,
    },
    {
      maxRamps: 4,
      spawnX: 0.5,
      bucket: { cx: 0.5, opening: 0.17, depthPx: 118 },
      gx: 0.09,
      ballsToWin: 14,
      spawnMs: 380,
    },
    {
      maxRamps: 4,
      spawnX: 0.26,
      bucket: { cx: 0.74, opening: 0.15, depthPx: 122 },
      gx: 0.14,
      obstacles: [{ cx: 0.46, cy: 0.32, w: 0.34, h: 0.014 }],
      ballsToWin: 16,
      spawnMs: 340,
    },
  ];

  function ballsNeeded() {
    return LEVELS[levelIndex].ballsToWin || 10;
  }

  function spawnIntervalMs() {
    return LEVELS[levelIndex].spawnMs || 400;
  }

  function ballCount() {
    return Composite.allBodies(engine.world).filter(function (b) {
      return b.label === "ball";
    }).length;
  }

  function clearAllBalls() {
    Composite.allBodies(engine.world)
      .filter(function (b) {
        return b.label === "ball";
      })
      .forEach(function (b) {
        Composite.remove(engine.world, b);
      });
  }

  function shouldSpawn() {
    if (winTimer) return false;
    if (levelWon && levelIndex < LEVELS.length - 1) return false;
    if (levelWon && levelIndex === LEVELS.length - 1 && catches >= ballsNeeded()) return false;
    return true;
  }

  function spawnBall() {
    if (!shouldSpawn()) return;
    if (ballCount() >= MAX_BALLS) return;
    var w = vw();
    var h = vh();
    var spec = LEVELS[levelIndex];
    var x = spec.spawnX * w;
    x = Math.max(BALL_R + 8, Math.min(w - BALL_R - 8, x));
    var y = Math.max(36, Math.min(80, h * 0.065));
    var b = Bodies.circle(x, y, BALL_R, {
      label: "ball",
      restitution: 0.62,
      friction: 0.008,
      frictionAir: 0.004,
      density: 0.032,
      plugin: { scored: false },
    });
    Body.setVelocity(b, { x: 0, y: 0 });
    Body.setAngularVelocity(b, 0);
    styleBody(b, "#e8e8f4", "#b8b8cc");
    Composite.add(engine.world, b);
  }

  /** World / render size = playfield (canvas), not full window — keeps HUD from covering the bucket. */
  function vw() {
    var el = canvas.parentElement || canvas;
    var cw = el.clientWidth;
    return cw > 0 ? cw : window.innerWidth;
  }
  function vh() {
    var el = canvas.parentElement || canvas;
    var ch = el.clientHeight;
    return ch > 0 ? ch : window.innerHeight;
  }

  function styleBody(b, fill, stroke) {
    b.render.fillStyle = fill;
    b.render.strokeStyle = stroke || "transparent";
    b.render.lineWidth = stroke ? 1 : 0;
  }

  function clearAnchors() {
    while (anchorBodies.length) {
      var b = anchorBodies.pop();
      Composite.remove(engine.world, b);
    }
  }

  function removeAllUserRamps() {
    Composite.allBodies(engine.world)
      .filter(function (body) {
        return body.label === "userRamp";
      })
      .forEach(function (body) {
        Composite.remove(engine.world, body);
      });
  }

  function rampCount() {
    return Composite.allBodies(engine.world).filter(function (b) {
      return b.label === "userRamp";
    }).length;
  }

  function clientToWorld(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function clampToStage(p) {
    var w = vw();
    var h = vh();
    return {
      x: Math.max(0, Math.min(w, p.x)),
      y: Math.max(0, Math.min(h, p.y)),
    };
  }

  function buildAnchors() {
    clearAnchors();
    var w = vw();
    var h = vh();
    var spec = LEVELS[levelIndex];
    var floor = Bodies.rectangle(w / 2, h + WALL / 2, w + WALL * 4, WALL, {
      isStatic: true,
      label: "floor",
    });
    var left = Bodies.rectangle(-WALL / 2, h / 2, WALL, h * 2 + WALL * 2, { isStatic: true, label: "wallL" });
    var right = Bodies.rectangle(w + WALL / 2, h / 2, WALL, h * 2 + WALL * 2, {
      isStatic: true,
      label: "wallR",
    });
    styleBody(floor, "#14141c");
    styleBody(left, "#14141c");
    styleBody(right, "#14141c");
    anchorBodies.push(floor, left, right);
    Composite.add(engine.world, floor);
    Composite.add(engine.world, left);
    Composite.add(engine.world, right);

    var bx = spec.bucket.cx * w;
    var openW = Math.max(88, spec.bucket.opening * w);
    var depth = spec.bucket.depthPx;
    var wallT = 11;
    var floorY = h - 52;

    var innerLeft = bx - openW / 2;
    var innerRight = bx + openW / 2;

    var cupBottom = Bodies.rectangle(bx, floorY, openW + wallT * 2 + 8, wallT, {
      isStatic: true,
      label: "cupFloor",
      restitution: 0.4,
    });
    var cupL = Bodies.rectangle(innerLeft - wallT / 2, floorY - depth / 2 - wallT / 2, wallT, depth + wallT, {
      isStatic: true,
      label: "cupL",
      restitution: 0.4,
    });
    var cupR = Bodies.rectangle(innerRight + wallT / 2, floorY - depth / 2 - wallT / 2, wallT, depth + wallT, {
      isStatic: true,
      label: "cupR",
      restitution: 0.4,
    });
    styleBody(cupBottom, "#252532", "#3d3d52");
    styleBody(cupL, "#252532", "#3d3d52");
    styleBody(cupR, "#252532", "#3d3d52");
    anchorBodies.push(cupBottom, cupL, cupR);
    Composite.add(engine.world, cupBottom);
    Composite.add(engine.world, cupL);
    Composite.add(engine.world, cupR);

    var sensor = Bodies.rectangle(bx, floorY - wallT * 1.2, openW * 0.72, wallT * 1.8, {
      isStatic: true,
      isSensor: true,
      label: "goalSensor",
    });
    sensor.render.opacity = 0;
    anchorBodies.push(sensor);
    Composite.add(engine.world, sensor);

    if (spec.obstacles) {
      for (var oi = 0; oi < spec.obstacles.length; oi++) {
        var o = spec.obstacles[oi];
        var ow = Math.max(40, o.w * w);
        var oh = Math.max(8, o.h * h);
        var ob = Bodies.rectangle(o.cx * w, o.cy * h, ow, oh, {
          isStatic: true,
          label: "obstacle",
          angle: o.angle || 0,
        });
        styleBody(ob, "#32324a", "#4a4a64");
        anchorBodies.push(ob);
        Composite.add(engine.world, ob);
      }
    }

    engine.world.gravity.x = spec.gx;
    engine.world.gravity.y = 1;
  }

  function syncHud() {
    var spec = LEVELS[levelIndex];
    hudLevel.textContent =
      "Level " +
      (levelIndex + 1) +
      " / " +
      LEVELS.length +
      " · In bucket " +
      catches +
      " / " +
      ballsNeeded();
    hudRamps.textContent = "Lines " + rampCount() + " / " + spec.maxRamps;
  }

  function setStatus(msg) {
    hudStatus.textContent = msg || "";
  }

  function teardownWinTimer() {
    if (winTimer) {
      clearTimeout(winTimer);
      winTimer = null;
    }
  }

  function goNextLevel() {
    teardownWinTimer();
    levelWon = false;
    catches = 0;
    clearAllBalls();
    if (levelIndex < LEVELS.length - 1) {
      levelIndex++;
      removeAllUserRamps();
      buildAnchors();
      lastSpawnMs = performance.now() - spawnIntervalMs();
      setStatus("Level " + (levelIndex + 1) + ". Balls keep falling — steer them into the bucket.");
    } else {
      setStatus("You cleared every level. Use Reset level to play again from level 1.");
    }
    syncHud();
  }

  function handleLevelComplete() {
    if (levelWon) return;
    levelWon = true;
    if (levelIndex >= LEVELS.length - 1) {
      clearAllBalls();
      setStatus("Bucket filled! Final level complete.");
      syncHud();
      return;
    }
    clearAllBalls();
    setStatus("Quota met! Next level…");
    syncHud();
    winTimer = setTimeout(goNextLevel, 1600);
  }

  function registerCatch(ballBody) {
    if (!ballBody || ballBody.label !== "ball") return;
    if (ballBody.plugin && ballBody.plugin.scored) return;
    if (levelWon && levelIndex === LEVELS.length - 1) {
      Composite.remove(engine.world, ballBody);
      return;
    }
    if (!ballBody.plugin) ballBody.plugin = {};
    ballBody.plugin.scored = true;
    Composite.remove(engine.world, ballBody);
    if (levelWon) return;
    catches++;
    setStatus("");
    if (catches >= ballsNeeded()) {
      handleLevelComplete();
    }
    syncHud();
  }

  function clearLines() {
    removeAllUserRamps();
    setStatus("Lines cleared.");
    syncHud();
  }

  function resetLevel() {
    teardownWinTimer();
    levelWon = false;
    catches = 0;
    clearAllBalls();
    removeAllUserRamps();
    buildAnchors();
    lastSpawnMs = performance.now() - spawnIntervalMs();
    setStatus("Level reset. Balls fall continuously — shape their path with lines.");
    syncHud();
  }

  function layout() {
    var w = vw();
    var h = vh();
    if (typeof Render.setSize === "function") {
      Render.setSize(render, w, h);
    } else {
      render.options.width = w;
      render.options.height = h;
      render.canvas.width = w;
      render.canvas.height = h;
    }
    render.bounds.min.x = 0;
    render.bounds.min.y = 0;
    render.bounds.max.x = w;
    render.bounds.max.y = h;
    removeAllUserRamps();
    buildAnchors();
    catches = 0;
    clearAllBalls();
    lastSpawnMs = performance.now() - spawnIntervalMs();
    syncHud();
    setStatus("Viewport changed — lines were cleared.");
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  }

  function tryAddRamp(x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < MIN_RAMP_LEN) return;
    var spec = LEVELS[levelIndex];
    if (rampCount() >= spec.maxRamps) {
      setStatus("Max lines for this level (" + spec.maxRamps + "). Clear one or reset.");
      return;
    }
    var midX = (x1 + x2) / 2;
    var midY = (y1 + y2) / 2;
    var angle = Math.atan2(dy, dx);
    var ramp = Bodies.rectangle(midX, midY, len, RAMP_H, {
      isStatic: true,
      friction: 0.45,
      restitution: 0.42,
      angle: angle,
      label: "userRamp",
      chamfer: { radius: 2 },
    });
    styleBody(ramp, "rgba(124, 140, 255, 0.92)", "rgba(200, 206, 255, 0.35)");
    Composite.add(engine.world, ramp);
    setStatus("");
    syncHud();
  }

  function onCollisionStart(event) {
    for (var i = 0; i < event.pairs.length; i++) {
      var pair = event.pairs[i];
      var a = pair.bodyA;
      var b = pair.bodyB;
      if (a.label === "ball" && b.label === "goalSensor") {
        registerCatch(a);
        continue;
      }
      if (b.label === "ball" && a.label === "goalSensor") {
        registerCatch(b);
      }
    }
  }

  function beforeUpdate() {
    var now = performance.now();
    if (shouldSpawn() && now - lastSpawnMs >= spawnIntervalMs()) {
      lastSpawnMs = now;
      spawnBall();
    }
    var h = vh();
    var toCull = [];
    Composite.allBodies(engine.world).forEach(function (b) {
      if (b.label === "ball" && b.position.y > h + 120) toCull.push(b);
    });
    for (var ci = 0; ci < toCull.length; ci++) {
      Composite.remove(engine.world, toCull[ci]);
    }
  }

  function onPointerDown(ev) {
    if (levelWon && levelIndex < LEVELS.length - 1) return;
    var p = clampToStage(clientToWorld(ev.clientX, ev.clientY));
    pointerDownPos = { x: p.x, y: p.y };
    drawStart = { x: p.x, y: p.y };
    previewEnd = { x: p.x, y: p.y };
    movedWhileDown = false;
    try {
      if (typeof canvas.setPointerCapture === "function") {
        canvas.setPointerCapture(ev.pointerId);
      }
    } catch (ignore) {}
  }

  function onPointerMove(ev) {
    if (!pointerDownPos || !drawStart) return;
    var p = clampToStage(clientToWorld(ev.clientX, ev.clientY));
    previewEnd = { x: p.x, y: p.y };
    var d = Math.hypot(p.x - pointerDownPos.x, p.y - pointerDownPos.y);
    if (d > MOVE_THRESHOLD) movedWhileDown = true;
  }

  function onPointerUp(ev) {
    try {
      if (
        typeof canvas.releasePointerCapture === "function" &&
        typeof canvas.hasPointerCapture === "function" &&
        canvas.hasPointerCapture(ev.pointerId)
      ) {
        canvas.releasePointerCapture(ev.pointerId);
      }
    } catch (ignore) {}
    var p = clampToStage(clientToWorld(ev.clientX, ev.clientY));
    previewEnd = null;
    if (drawStart) {
      var wasTap = pointerDownPos && !movedWhileDown;
      var dist = Math.hypot(p.x - drawStart.x, p.y - drawStart.y);
      if (!wasTap && dist >= MIN_RAMP_LEN) {
        tryAddRamp(drawStart.x, drawStart.y, p.x, p.y);
      }
      drawStart = null;
    }
    pointerDownPos = null;
  }

  function drawLinePreview() {
    if (!drawStart || !previewEnd) return;
    var ctx = render.context;
    var len = Math.hypot(previewEnd.x - drawStart.x, previewEnd.y - drawStart.y);
    if (len < 2) return;
    ctx.save();
    ctx.strokeStyle = "rgba(124, 140, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(drawStart.x, drawStart.y);
    ctx.lineTo(previewEnd.x, previewEnd.y);
    ctx.stroke();
    ctx.restore();
  }

  void activeEl.offsetHeight;

  engine = Engine.create({ enableSleeping: true });
  engine.world.gravity.scale = 0.0011;

  render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
      width: vw(),
      height: vh(),
      wireframes: false,
      background: "#0a0a0f",
      pixelRatio: 1,
    },
  });

  runner = Runner.create();
  buildAnchors();
  catches = 0;
  lastSpawnMs = performance.now() - spawnIntervalMs();

  Events.on(engine, "collisionStart", onCollisionStart);
  Events.on(engine, "beforeUpdate", beforeUpdate);
  Events.on(render, "afterRender", drawLinePreview);

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  btnClear.addEventListener("click", clearLines);
  btnReset.addEventListener("click", resetLevel);
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      Runner.stop(runner);
      Render.stop(render);
    } else {
      Runner.run(runner, engine);
      Render.run(render);
    }
  });

  Runner.run(runner, engine);
  Render.run(render);

  syncHud();
  setStatus(
    "Balls fall from the top. Drag on empty space — a line follows the pointer; release to place it. Lines stay put; use Clear lines to remove them."
  );
})();
