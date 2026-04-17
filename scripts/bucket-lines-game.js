(function () {
  "use strict";

  var embed = !!document.getElementById("site-game-canvas");
  var canvas = document.getElementById(embed ? "site-game-canvas" : "game-canvas");
  var root = embed ? null : document.getElementById("game-root");
  var reducedEl = embed ? null : document.getElementById("bucket-game-reduced");
  var activeEl = embed ? null : document.getElementById("bucket-game-active");
  var hudMain = embed ? null : document.getElementById("hud-level");
  var hudMeta = embed ? null : document.getElementById("hud-ramps");
  var hudStatus = embed ? null : document.getElementById("hud-status");
  var btnPause = embed ? null : document.getElementById("btn-clear");
  var btnReset = embed ? null : document.getElementById("btn-reset");

  if (!canvas) return;
  if (!embed && (!root || !reducedEl || !activeEl)) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (!embed && reducedEl) reducedEl.hidden = false;
    return;
  }

  if (!embed && activeEl) activeEl.hidden = false;

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var rafId = 0;
  var resizeTimer = null;
  var paused = false;
  var autoPilot = embed;
  var keyState = Object.create(null);

  var state = {
    car: null,
    track: null,
    lapProgress: 0,
    laps: 0,
    bestLapMs: null,
    lapStartAt: 0,
    offTrack: false,
  };

  function viewportWidth() {
    var el = canvas.parentElement || canvas;
    return el.clientWidth > 0 ? el.clientWidth : window.innerWidth;
  }

  function viewportHeight() {
    var el = canvas.parentElement || canvas;
    return el.clientHeight > 0 ? el.clientHeight : window.innerHeight;
  }

  function setStatus(msg) {
    if (hudStatus) hudStatus.textContent = msg || "";
  }

  function syncHud() {
    if (!hudMain || !hudMeta || !state.car) return;
    var mph = Math.abs(state.car.speed) * 16;
    var lapText = "Lap " + (state.laps + 1);
    if (state.bestLapMs != null) lapText += " · Best " + (state.bestLapMs / 1000).toFixed(2) + "s";
    hudMain.textContent = lapText;
    hudMeta.textContent = "Speed " + mph.toFixed(0) + " mph";
  }

  function viewportWidth() {
    var el = canvas.parentElement || canvas;
    return el.clientWidth > 0 ? el.clientWidth : window.innerWidth;
  }

  function viewportHeight() {
    var el = canvas.parentElement || canvas;
    return el.clientHeight > 0 ? el.clientHeight : window.innerHeight;
  }

  function resizeCanvas() {
    var w = viewportWidth();
    var h = viewportHeight();
    canvas.width = w;
    canvas.height = h;
  }

  function normalizeAngle(value) {
    var a = value;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function buildTrack() {
    var w = canvas.width;
    var h = canvas.height;
    var padding = embed ? 36 : 50;
    var outerRx = Math.max(130, (w - padding * 2) * 0.5);
    var outerRy = Math.max(100, (h - padding * 2) * 0.42);
    var laneWidth = Math.max(42, Math.min(outerRx, outerRy) * 0.24);
    var innerRx = Math.max(40, outerRx - laneWidth);
    var innerRy = Math.max(34, outerRy - laneWidth);
    return {
      cx: w * 0.5,
      cy: h * 0.5,
      outerRx: outerRx,
      outerRy: outerRy,
      innerRx: innerRx,
      innerRy: innerRy,
      laneWidth: laneWidth,
    };
  }

  function defaultCar() {
    var t = state.track;
    return {
      x: t.cx + (t.innerRx + t.outerRx) * 0.5,
      y: t.cy,
      angle: Math.PI / 2,
      speed: 0,
    };
  }

  function resetGame(keepStatus) {
    resizeCanvas();
    state.track = buildTrack();
    state.car = defaultCar();
    state.laps = 0;
    state.lapProgress = 0;
    state.bestLapMs = null;
    state.offTrack = false;
    state._prevTheta = null;
    state.lapStartAt = performance.now();
    paused = false;
    autoPilot = embed;
    keyState = Object.create(null);
    syncHud();
    if (!keepStatus && !embed) {
      setStatus("Drive with arrows or WASD. Stay on the track and chase clean laps.");
    }
  }

  function carTrackAngle(car) {
    var t = state.track;
    return Math.atan2((car.y - t.cy) / t.outerRy, (car.x - t.cx) / t.outerRx);
  }

  function trackDistanceNorm(x, y, rx, ry, cx, cy) {
    var dx = x - cx;
    var dy = y - cy;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  }

  function carOnTrack(car) {
    var t = state.track;
    var outer = trackDistanceNorm(car.x, car.y, t.outerRx, t.outerRy, t.cx, t.cy);
    var inner = trackDistanceNorm(car.x, car.y, t.innerRx, t.innerRy, t.cx, t.cy);
    return outer <= 1.02 && inner >= 0.98;
  }

  function autoControls() {
    var c = state.car;
    var theta = carTrackAngle(c);
    var desired = theta + Math.PI / 2;
    var diff = normalizeAngle(desired - c.angle);
    return {
      throttle: true,
      brake: false,
      left: diff < -0.06,
      right: diff > 0.06,
    };
  }

  function readManualControls() {
    return {
      throttle: !!(keyState.arrowup || keyState.w),
      brake: !!(keyState.arrowdown || keyState.s),
      left: !!(keyState.arrowleft || keyState.a),
      right: !!(keyState.arrowright || keyState.d),
    };
  }

  function applyCarPhysics(dt, controls) {
    var c = state.car;
    var steerPower = 2.5;
    var accel = 220;
    var brake = 260;
    var drag = 0.985;
    var maxSpeed = controls.brake ? 210 : 260;

    if (controls.throttle) c.speed += accel * dt;
    if (controls.brake) c.speed -= brake * dt;
    if (!controls.throttle && !controls.brake) c.speed *= Math.pow(drag, dt * 60);

    if (c.speed > maxSpeed) c.speed = maxSpeed;
    if (c.speed < -95) c.speed = -95;

    var steer = 0;
    if (controls.left) steer -= 1;
    if (controls.right) steer += 1;
    c.angle += steer * steerPower * dt * Math.min(1.2, Math.abs(c.speed) / 110 + 0.15);

    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
  }

  function containCar() {
    var c = state.car;
    c.x = Math.max(0, Math.min(canvas.width, c.x));
    c.y = Math.max(0, Math.min(canvas.height, c.y));
  }

  function updateLaps(dt) {
    if (!state.car || state.car.speed < 30) return;
    if (state.offTrack) return;
    var prevTheta = state._prevTheta;
    var theta = carTrackAngle(state.car);
    if (typeof prevTheta === "number") {
      var dTheta = normalizeAngle(theta - prevTheta);
      state.lapProgress += dTheta;
      if (state.lapProgress >= Math.PI * 2) {
        state.lapProgress -= Math.PI * 2;
        state.laps += 1;
        var now = performance.now();
        var lapMs = now - state.lapStartAt;
        state.lapStartAt = now;
        if (lapMs > 1200) {
          if (state.bestLapMs == null || lapMs < state.bestLapMs) state.bestLapMs = lapMs;
          if (!embed) setStatus("Lap " + state.laps + " complete in " + (lapMs / 1000).toFixed(2) + "s");
        }
      }
    }
    state._prevTheta = theta;
  }

  function update(dt) {
    if (!state.car || paused) return;

    var controls = autoPilot ? autoControls() : readManualControls();
    applyCarPhysics(dt, controls);
    containCar();

    var onTrack = carOnTrack(state.car);
    state.offTrack = !onTrack;
    if (state.offTrack) {
      state.car.speed *= 0.96;
      if (!embed) setStatus("Off track — ease back into the lane.");
    } else if (!embed && hudStatus && hudStatus.textContent.indexOf("Off track") === 0) {
      setStatus("");
    }

    updateLaps(dt);
    syncHud();
  }

  function drawTrack() {
    var t = state.track;
    if (!t) return;
    ctx.save();

    ctx.fillStyle = embed ? "rgba(14, 20, 38, 0.35)" : "#0b1221";
    ctx.beginPath();
    ctx.ellipse(t.cx, t.cy, t.outerRx, t.outerRy, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(t.cx, t.cy, t.innerRx, t.innerRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    ctx.strokeStyle = embed ? "rgba(166, 184, 255, 0.22)" : "rgba(169, 190, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    var midRx = (t.innerRx + t.outerRx) * 0.5;
    var midRy = (t.innerRy + t.outerRy) * 0.5;
    ctx.beginPath();
    ctx.ellipse(t.cx, t.cy, midRx, midRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(210, 220, 255, 0.7)";
    ctx.lineWidth = 4;
    var gateX = t.cx + midRx;
    ctx.beginPath();
    ctx.moveTo(gateX, t.cy - 24);
    ctx.lineTo(gateX, t.cy + 24);
    ctx.stroke();

    ctx.restore();
  }

  function drawCar() {
    if (!state.car) return;
    var c = state.car;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = state.offTrack ? "#ff8a8a" : embed ? "rgba(140, 168, 255, 0.95)" : "#9eb8ff";
    ctx.strokeStyle = embed ? "rgba(223, 233, 255, 0.55)" : "#d7e2ff";
    ctx.lineWidth = 1.2;
    ctx.fillRect(-10, -6, 20, 12);
    ctx.strokeRect(-10, -6, 20, 12);
    ctx.fillStyle = "rgba(12, 16, 34, 0.95)";
    ctx.fillRect(1, -4, 6, 8);
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!embed) {
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    drawTrack();
    drawCar();
  }

  function onKeyDown(ev) {
    var key = (ev.key || "").toLowerCase();
    var handled = false;
    if (key === " ") {
      paused = !paused;
      if (!embed) setStatus(paused ? "Paused." : "");
      handled = true;
    } else if (key === "r") {
      resetGame(true);
      if (!embed) setStatus("Reset car position and lap timer.");
      handled = true;
    } else if (
      key === "arrowup" ||
      key === "arrowdown" ||
      key === "arrowleft" ||
      key === "arrowright" ||
      key === "w" ||
      key === "a" ||
      key === "s" ||
      key === "d"
    ) {
      keyState[key] = true;
      autoPilot = false;
      handled = true;
    }
    if (handled) ev.preventDefault();
  }

  function onKeyUp(ev) {
    var key = (ev.key || "").toLowerCase();
    if (Object.prototype.hasOwnProperty.call(keyState, key)) keyState[key] = false;
  }

  var lastFrameAt = 0;
  function frame(ts) {
    if (!lastFrameAt) lastFrameAt = ts;
    var dt = (ts - lastFrameAt) / 1000;
    if (dt > 0.05) dt = 0.05;
    lastFrameAt = ts;
    update(dt);
    render();
    rafId = window.requestAnimationFrame(frame);
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resetGame(true);
      if (!embed) setStatus("Viewport resized, track rebuilt.");
    }, 120);
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
      lastFrameAt = 0;
    } else if (!rafId) {
      rafId = window.requestAnimationFrame(frame);
    }
  }

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  document.addEventListener("visibilitychange", onVisibilityChange);

  if (btnPause) {
    btnPause.addEventListener("click", function () {
      paused = !paused;
      if (!embed) setStatus(paused ? "Paused." : "");
      syncHud();
    });
  }

  if (btnReset) {
    btnReset.addEventListener("click", function () {
      resetGame(true);
      if (!embed) setStatus("Reset car position and lap timer.");
    });
  }

  resetGame(false);
  rafId = window.requestAnimationFrame(frame);
})();
