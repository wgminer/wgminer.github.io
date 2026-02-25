(function () {
  let drawingEnabled = false;
  let lastX = null;
  let lastY = null;
  let canvas, ctx;

  function createCanvas() {
    canvas = document.createElement("canvas");
    canvas.id = "cursor-draw-canvas";
    canvas.style.cssText =
      "position:absolute;top:0;left:0;z-index:0;pointer-events:none;";
    document.body.prepend(canvas);
    ctx = canvas.getContext("2d");
    resizeCanvas();
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = document.body.scrollWidth;
    const h = document.body.scrollHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function getAccentColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#2563eb";
  }

  function toCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function drawLine(x, y) {
    if (lastX !== null && lastY !== null) {
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = getAccentColor();
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    lastX = x;
    lastY = y;
  }

  function onMouseMove(e) {
    if (!drawingEnabled || !ctx) return;
    const { x, y } = toCanvasCoords(e.clientX, e.clientY);
    drawLine(x, y);
  }

  function onMouseLeave() {
    lastX = null;
    lastY = null;
  }

  function onClick(e) {
    if (e.target.closest("a") || e.target.closest("button")) return;
    drawingEnabled = !drawingEnabled;
    if (!drawingEnabled) {
      lastX = null;
      lastY = null;
    }
  }

  function init() {
    createCanvas();
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("click", onClick);
    window.addEventListener("resize", function () {
      resizeCanvas();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
