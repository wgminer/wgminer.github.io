(function () {
  "use strict";

  var STORAGE_KEY = "willminer-theme-panel-v1";

  /** @type {{ id: string, label: string, google?: string }} */
  var FONTS = [
    { id: "default", label: "Default (system fonts)" },
    { id: "Newsreader", label: "Newsreader", google: "Newsreader:opsz,wght@6..72,400;6..72,600" },
    { id: "EB Garamond", label: "EB Garamond", google: "EB+Garamond:ital,wght@0,400;0,600;1,400" },
    { id: "Literata", label: "Literata", google: "Literata:opsz,wght@7..72,400;7..72,600" },
    { id: "Lora", label: "Lora", google: "Lora:ital,wght@0,400;0,600;1,400" },
    { id: "Crimson Pro", label: "Crimson Pro", google: "Crimson+Pro:ital,wght@0,400;0,600;1,400" },
    { id: "Source Serif 4", label: "Source Serif 4", google: "Source+Serif+4:opsz,wght@8..60,400;8..60,600" },
    { id: "Spectral", label: "Spectral", google: "Spectral:ital,wght@0,400;0,600;1,400" },
    { id: "IBM Plex Serif", label: "IBM Plex Serif", google: "IBM+Plex+Serif:ital,wght@0,400;0,600;1,400" },
    { id: "Instrument Serif", label: "Instrument Serif", google: "Instrument+Serif:ital@0;1" },
    { id: "Fraunces", label: "Fraunces", google: "Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400" },
    { id: "DM Sans", label: "DM Sans", google: "DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;1,9..40,400" },
    { id: "Figtree", label: "Figtree", google: "Figtree:ital,wght@0,300;0,400;0,600;1,400" },
    { id: "Manrope", label: "Manrope", google: "Manrope:wght@300;400;600" },
    { id: "Outfit", label: "Outfit", google: "Outfit:wght@300;400;600" },
    { id: "Syne", label: "Syne", google: "Syne:wght@400;600;700" },
    { id: "Atkinson Hyperlegible", label: "Atkinson Hyperlegible", google: "Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400" },
    { id: "JetBrains Mono", label: "JetBrains Mono", google: "JetBrains+Mono:ital,wght@0,400;0,600;1,400" },
    { id: "Bricolage Grotesque", label: "Bricolage Grotesque", google: "Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600" },
    { id: "UnifrakturMaguntia", label: "Unifraktur Maguntia", google: "UnifrakturMaguntia" },
    { id: "Playfair Display", label: "Playfair Display", google: "Playfair+Display:ital,wght@0,400;0,600;1,400" },
    { id: "Libre Baskerville", label: "Libre Baskerville", google: "Libre+Baskerville:ital,wght@0,400;0,700;1,400" },
    { id: "Nunito", label: "Nunito", google: "Nunito:ital,wght@0,300;0,400;0,600;1,400" },
    { id: "Raleway", label: "Raleway", google: "Raleway:ital,wght@0,300;0,500;0,600;1,400" },
    { id: "Work Sans", label: "Work Sans", google: "Work+Sans:ital,wght@0,300;0,400;0,600;1,400" },
    { id: "Geist", label: "Geist", google: "Geist:wght@300;400;600" },
    { id: "Sora", label: "Sora", google: "Sora:wght@300;400;600" },
  ];

  var SYSTEM_STACK =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  /** Display faces where we avoid synthesizing a heavy H1 weight. */
  var DISPLAY_SINGLE_WEIGHT_IDS = ["UnifrakturMaguntia", "Instrument Serif"];

  function isSingleWeightDisplay(id) {
    return DISPLAY_SINGLE_WEIGHT_IDS.indexOf(id) !== -1;
  }

  function findFont(id) {
    for (var i = 0; i < FONTS.length; i++) {
      if (FONTS[i].id === id) return FONTS[i];
    }
    return FONTS[0];
  }

  function defaultState() {
    return {
      open: false,
      bodyFontId: "default",
      displayFontId: "default",
      lineHeight: 1.5,
      hierarchy: {
        strongH2: false,
        openSections: false,
        spaciousLists: false,
        largeLinkTitles: false,
      },
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      var base = defaultState();
      if (typeof parsed.lineHeight === "number") base.lineHeight = parsed.lineHeight;
      if (typeof parsed.bodyFontId === "string") base.bodyFontId = parsed.bodyFontId;
      if (typeof parsed.displayFontId === "string") base.displayFontId = parsed.displayFontId;
      if (parsed.hierarchy && typeof parsed.hierarchy === "object") {
        base.hierarchy.strongH2 = !!parsed.hierarchy.strongH2;
        base.hierarchy.openSections = !!parsed.hierarchy.openSections;
        base.hierarchy.spaciousLists = !!parsed.hierarchy.spaciousLists;
        base.hierarchy.largeLinkTitles = !!parsed.hierarchy.largeLinkTitles;
      }
      return base;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          bodyFontId: state.bodyFontId,
          displayFontId: state.displayFontId,
          lineHeight: state.lineHeight,
          hierarchy: state.hierarchy,
        })
      );
    } catch (e) {}
  }

  var fontLinkEl = null;
  function ensureFontLink() {
    if (fontLinkEl) return fontLinkEl;
    fontLinkEl = document.getElementById("theme-google-fonts");
    if (!fontLinkEl) {
      fontLinkEl = document.createElement("link");
      fontLinkEl.id = "theme-google-fonts";
      fontLinkEl.rel = "stylesheet";
      document.head.appendChild(fontLinkEl);
    }
    return fontLinkEl;
  }

  function buildGoogleUrl(googleSpecs) {
    var unique = [];
    var seen = {};
    for (var i = 0; i < googleSpecs.length; i++) {
      var s = googleSpecs[i];
      if (!s || seen[s]) continue;
      seen[s] = true;
      unique.push(s);
    }
    if (!unique.length) return "";
    return (
      "https://fonts.googleapis.com/css2?" +
      unique.map(function (spec) {
        return "family=" + spec;
      }).join("&") +
      "&display=swap"
    );
  }

  function collectGoogleSpecs(state) {
    var specs = [];
    var b = findFont(state.bodyFontId);
    var d = findFont(state.displayFontId);
    if (b.google) specs.push(b.google);
    if (d.google && d.google !== b.google) specs.push(d.google);
    return specs;
  }

  function applyFonts(state) {
    var root = document.documentElement;
    var b = findFont(state.bodyFontId);
    var d = findFont(state.displayFontId);

    if (b.id === "default") {
      root.style.setProperty("--theme-font-body", SYSTEM_STACK);
    } else {
      root.style.setProperty("--theme-font-body", '"' + b.id + '", ' + SYSTEM_STACK);
    }

    if (d.id === "default") {
      var displayStack =
        b.id === "default"
          ? SYSTEM_STACK
          : '"' + b.id + '", ' + SYSTEM_STACK;
      root.style.setProperty("--theme-font-display", displayStack);
      root.removeAttribute("data-theme-display-single");
    } else {
      root.style.setProperty("--theme-font-display", '"' + d.id + '", ' + SYSTEM_STACK);
      root.dataset.themeDisplaySingle = isSingleWeightDisplay(d.id) ? "1" : "0";
    }

    var specs = collectGoogleSpecs(state);
    var url = buildGoogleUrl(specs);
    var link = ensureFontLink();
    if (url) {
      if (link.getAttribute("href") !== url) link.setAttribute("href", url);
    } else {
      link.removeAttribute("href");
    }
  }

  function applyLineHeight(state) {
    document.documentElement.style.setProperty("--theme-line-height", String(state.lineHeight));
  }

  function applyHierarchy(state) {
    var h = state.hierarchy;
    var root = document.documentElement;
    root.toggleAttribute("data-theme-strong-h2", h.strongH2);
    root.toggleAttribute("data-theme-open-sections", h.openSections);
    root.toggleAttribute("data-theme-spacious-lists", h.spaciousLists);
    root.toggleAttribute("data-theme-large-link-titles", h.largeLinkTitles);
  }

  function populateSelect(select) {
    FONTS.forEach(function (f) {
      var opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.label;
      select.appendChild(opt);
    });
  }

  function init() {
    var layout = document.querySelector(".theme-layout");
    var panel = document.getElementById("theme-panel");
    var fab = document.getElementById("theme-panel-toggle");
    var bodySel = document.getElementById("theme-font-body");
    var displaySel = document.getElementById("theme-font-display");
    var lhRange = document.getElementById("theme-line-height");
    var lhOut = document.getElementById("theme-line-height-value");
    if (!layout || !panel || !fab || !bodySel || !displaySel || !lhRange || !lhOut) return;

    populateSelect(bodySel);
    populateSelect(displaySel);

    var state = loadState();

    bodySel.value = state.bodyFontId;
    displaySel.value = state.displayFontId;
    lhRange.value = String(state.lineHeight);
    lhOut.textContent = state.lineHeight.toFixed(2);

    var toggles = {
      strongH2: document.getElementById("theme-h-strong-h2"),
      openSections: document.getElementById("theme-h-open-sections"),
      spaciousLists: document.getElementById("theme-h-spacious-lists"),
      largeLinkTitles: document.getElementById("theme-h-large-link-titles"),
    };

    for (var key in toggles) {
      if (toggles[key]) toggles[key].checked = !!state.hierarchy[key];
    }

    function syncAll() {
      applyFonts(state);
      applyLineHeight(state);
      applyHierarchy(state);
      saveState(state);
    }

    syncAll();

    function setOpen(open) {
      state.open = open;
      fab.setAttribute("aria-expanded", open ? "true" : "false");
      panel.hidden = !open;
      document.body.classList.toggle("theme-panel-open", open);
    }

    setOpen(false);

    fab.addEventListener("click", function () {
      setOpen(panel.hidden);
    });

    var closeBtn = document.getElementById("theme-panel-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        setOpen(false);
        fab.focus();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) {
        setOpen(false);
        fab.focus();
      }
    });

    bodySel.addEventListener("change", function () {
      state.bodyFontId = bodySel.value;
      syncAll();
    });

    displaySel.addEventListener("change", function () {
      state.displayFontId = displaySel.value;
      syncAll();
    });

    lhRange.addEventListener("input", function () {
      state.lineHeight = parseFloat(lhRange.value);
      lhOut.textContent = state.lineHeight.toFixed(2);
      applyLineHeight(state);
      saveState(state);
    });

    for (var k in toggles) {
      if (!toggles[k]) continue;
      (function (key) {
        toggles[key].addEventListener("change", function () {
          state.hierarchy[key] = toggles[key].checked;
          applyHierarchy(state);
          saveState(state);
        });
      })(k);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
