document.addEventListener("DOMContentLoaded", () => {
  const wavingHand = document.getElementById("waving-hand");
  const helloElement = document.querySelector("h1");

  const hellos = ["Hello", "Welcome", "Good to see you!", "Sup", "Yo", "Hola"];
  let currentHelloIndex = 0;

  function changeHello() {
    currentHelloIndex = (currentHelloIndex + 1) % hellos.length;
    helloElement.innerHTML = `<span class="wave" id="waving-hand">👋🏾</span> ${hellos[currentHelloIndex]}`;
  }

  function removeWave() {
    wavingHand.classList.remove("wave");
  }

  // Change the hello word every 1 seconds
  // const helloInterval = setInterval(changeHello, 1000);

  // Remove the wave animation after 15 seconds
  const removeWaveTimeout = setTimeout(() => {
    removeWave();
    // clearInterval(helloInterval); // Stop changing hello words after 15 seconds
  }, 15000);

  // Remove the wave animation when hovered over
  wavingHand.addEventListener("mouseover", () => {
    removeWave();
    // clearInterval(helloInterval); // Stop changing hello words when hovered over
    clearTimeout(removeWaveTimeout); // Clear the timeout to avoid removing the wave again
  });
});

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
