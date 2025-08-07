document.addEventListener("DOMContentLoaded", () => {
  // Initialize click emoji functionality
  initializeClickEmojis();
  
  // Apply loading animations to content sections
  initializeLoadingAnimations();
  
  // Location-based greeting functionality
  const wavingHand = document.getElementById("waving-hand");
  const helloElement = document.querySelector("h1");

  // Greetings mapped by region/language
  const greetings = {
    "en-US": {
      TX: "Howdy",
      NY: "Hey there",
      HI: "Aloha",
      default: "Hello",
    },
    fr: {
      default: "Bonjour",
    },
    es: {
      default: "¡Hola!",
    },
    it: {
      default: "Ciao",
    },
    de: {
      default: "Hallo",
    },
    ja: {
      default: "こんにちは",
    },
    default: "Hello",
  };

  function getGreeting(locale, region) {
    const language = locale.split("-")[0];
    const languageGreetings =
      greetings[locale] || greetings[language] || greetings.default;
    return (
      (region && languageGreetings[region]) ||
      languageGreetings.default ||
      greetings.default
    );
  }

  // Get user's location and language
  const userLocale = navigator.language;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const region = timeZone.split("/")[1]?.slice(0, 2);

  const greeting = getGreeting(userLocale, region);
  helloElement.innerHTML = `<span class="wave" id="waving-hand">👋🏾</span> ${greeting}!`;

  // Wave animation functionality
  function removeWave() {
    wavingHand.classList.remove("wave");
  }

  const removeWaveTimeout = setTimeout(removeWave, 15000);

  wavingHand.addEventListener("mouseover", () => {
    removeWave();
    clearTimeout(removeWaveTimeout);
  });

  // Dropdown functionality (restored from original)
  document.querySelectorAll(".section-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const isExpanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", !isExpanded);
      const content = document.getElementById(
        button.getAttribute("aria-controls")
      );
      content.classList.toggle("hidden");
    });
  });
});

// Click emoji system
function initializeClickEmojis() {
  const emojis = ['✨', '🎉', '🌟', '💫', '⭐', '🎊', '🔥', '💥', '🌈', '🦋', '🌺', '🎈', '🎯', '🚀', '💎', '🎪', '🎭', '🎨', '🎵', '🎸'];
  let lastTrailTime = 0;
  const trailThrottle = 100; // Milliseconds between trail emojis
  
  // Click emoji functionality
  document.addEventListener('click', (e) => {
    // Don't add emoji clicks on interactive elements
    if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('button')) {
      return;
    }
    
    createEmoji(e.clientX, e.clientY, 'click-emoji');
  });
  
  // Cursor trail functionality
  document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastTrailTime > trailThrottle) {
      createEmoji(e.clientX, e.clientY, 'trail-emoji');
      lastTrailTime = now;
    }
  });
  
  function createEmoji(x, y, className) {
    const emoji = document.createElement('div');
    emoji.className = className;
    emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    
    // Position at coordinates
    emoji.style.left = x + 'px';
    emoji.style.top = y + 'px';
    emoji.style.transform = 'translate(-50%, -50%)';
    
    document.body.appendChild(emoji);
    
    // Clean up after animation completes
    setTimeout(() => {
      if (emoji.parentNode) {
        emoji.parentNode.removeChild(emoji);
      }
    }, 3000);
  }
}

// Loading animation system
function initializeLoadingAnimations() {
  // Add fade-in animation to sections with staggered delays
  const sections = document.querySelectorAll('section');
  sections.forEach((section, index) => {
    section.style.animationDelay = (index * 0.2) + 's';
    section.classList.add('fade-in');
  });
  
  // Add slide-in animation to list items
  const listItems = document.querySelectorAll('.link-list li');
  listItems.forEach((item, index) => {
    item.style.animationDelay = (index * 0.1 + 1) + 's';
    item.classList.add('slide-in');
  });
  
  // Add loading spinner to any future dynamic content
  window.showLoadingSpinner = function(element) {
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    element.appendChild(spinner);
    return spinner;
  };
  
  window.hideLoadingSpinner = function(spinner) {
    if (spinner && spinner.parentNode) {
      spinner.parentNode.removeChild(spinner);
    }
  };
}

