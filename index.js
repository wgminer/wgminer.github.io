document.addEventListener("DOMContentLoaded", () => {
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

  // Get region from timezone as a fallback method
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const region = timeZone.split("/")[1]?.slice(0, 2);

  const greeting = getGreeting(userLocale, region);
  helloElement.innerHTML = `<span class="wave" id="waving-hand">👋🏾</span> ${greeting}!`;

  // Rest of the existing wave animation code
  function removeWave() {
    wavingHand.classList.remove("wave");
  }

  const removeWaveTimeout = setTimeout(removeWave, 15000);

  wavingHand.addEventListener("mouseover", () => {
    removeWave();
    clearTimeout(removeWaveTimeout);
  });
});
