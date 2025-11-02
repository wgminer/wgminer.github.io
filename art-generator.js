// Abstracted Art Generation functionality
(function() {
  // Tune these to your taste
  const KEYWORDS = ["etching","engraving","print","woodcut","lithograph"];
  const PICK = (arr) => arr[Math.floor(Math.random() * arr.length)];
  
  let instanceCounter = 0;

  async function getMetRandom() {
    const q = encodeURIComponent(PICK(KEYWORDS));
    const searchURL = `https://collectionapi.metmuseum.org/public/collection/v1/search?isPublicDomain=true&hasImages=true&q=${q}`;
    const search = await fetch(searchURL).then(r => r.json());
    if (!search?.objectIDs?.length) throw new Error("No Met results");
    // Try up to 10 random IDs to avoid occasional empties
    for (let i = 0; i < 10; i++) {
      const id = PICK(search.objectIDs);
      const obj = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`).then(r => r.json());
      const img = obj.primaryImageSmall || obj.primaryImage;
      if (img) {
        return {
          src: img,
          title: obj.title || "Untitled",
          maker: obj.artistDisplayName || "Unknown",
          date: obj.objectDate || "",
          credit: "The Metropolitan Museum of Art",
          link: obj.objectURL || "https://www.metmuseum.org/",
          provider: "met"
        };
      }
    }
    throw new Error("Met objects lacked images");
  }

  async function getClevelandRandom() {
    const q = encodeURIComponent(PICK(KEYWORDS));
    // cc0=1 for open images, has_image=1 ensures imagery
    const url = `https://openaccess-api.clevelandart.org/api/artworks?cc0=1&has_image=1&q=${q}&limit=100`;
    const data = await fetch(url).then(r => r.json());
    const items = data?.data?.filter(d => d?.images?.web?.url);
    if (!items?.length) throw new Error("No Cleveland results");
    const obj = PICK(items);
    return {
      src: obj.images.web.url,
      title: obj.title || "Untitled",
      maker: obj.creators?.[0]?.description || obj.creator || "Unknown",
      date: obj.creation_date || obj.date_text || "",
      credit: "Cleveland Museum of Art",
      link: obj.url || "https://www.clevelandart.org/art/collection",
      provider: "cma"
    };
  }

  async function loadRandom(imgEl, metaEl) {
    try {
      let art;
      try {
        art = await getMetRandom();  // no key, fast
      } catch {
        art = await getClevelandRandom();  // strong fallback
      }

      // Render
      imgEl.innerHTML = "";
      const img = new Image();
      img.loading = "lazy";
      img.decoding = "async";
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.src = art.src;
      img.alt = `${art.title} by ${art.maker} ${art.date ? "(" + art.date + ")" : ""}`;
      imgEl.appendChild(img);

      metaEl.innerHTML = `
        <strong>${art.title}</strong>${art.date ? ", " + art.date : ""}<br>
        ${art.maker}<br>
        <a href="${art.link}" target="_blank" rel="noopener" style="color:#fff; text-decoration:underline;">Source: ${art.credit}</a>
      `;
    } catch (e) {
      imgEl.textContent = "Could not load an image right now.";
      metaEl.textContent = "";
      console.error(e);
    }
  }

  // Initialize art generation for a container element
  async function initArtGeneration(container) {
    const instanceId = instanceCounter++;
    const containerId = `random-art-${instanceId}`;
    const imgId = `art-img-${instanceId}`;
    const metaId = `art-meta-${instanceId}`;
    
    container.id = containerId;
    container.style.maxWidth = "720px";
    container.style.margin = "24px auto";
    container.style.font = "14px/1.5 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    container.style.position = "relative";
    container.setAttribute("role", "button");
    container.setAttribute("aria-label", "Load a new piece of artwork");
    container.tabIndex = 0;
    
    container.innerHTML = `
      <div id="${imgId}" style="aspect-ratio: 3/2; background:#F5F5F7; display:flex; align-items:center; justify-content:center; color:#777; cursor:pointer; position:relative;">Loading…</div>
      <div id="${metaId}" style="position:absolute; bottom:12px; left:12px; right:12px; background:rgba(0,0,0,0.8); color:#fff; padding:12px; border-radius:6px; opacity:0; transition:opacity 0.2s ease-in-out; z-index:10;"></div>
    `;
    
    const imgEl = document.getElementById(imgId);
    const metaEl = document.getElementById(metaId);
    
    // Show tooltip on hover, hide on mouse leave
    const showMeta = () => {
      metaEl.style.opacity = "1";
    };
    const hideMeta = () => {
      metaEl.style.opacity = "0";
    };
    container.addEventListener("mouseenter", showMeta);
    container.addEventListener("mouseleave", hideMeta);
    container.addEventListener("focus", showMeta);
    container.addEventListener("blur", hideMeta);
    
    // Click to refresh (only when clicking on image area, not tooltip links)
    const refreshArt = () => loadRandom(imgEl, metaEl);
    container.addEventListener("click", (e) => {
      // Don't refresh if clicking on a link or within the tooltip
      if (e.target.tagName === "A" || metaEl.contains(e.target)) return;
      refreshArt();
    });
    container.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        refreshArt();
      }
    });
    await refreshArt();
  }
  
  // Initialize all art containers when DOM is ready
  async function initAllArtContainers() {
    const containers = document.querySelectorAll('.random-art-container');
    for (const container of containers) {
      await initArtGeneration(container);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllArtContainers);
  } else {
    // DOM already loaded, initialize immediately
    initAllArtContainers();
  }
})();
