document.addEventListener("DOMContentLoaded", () => {
  const wavingHand = document.getElementById("waving-hand");

  if (wavingHand) {
    function removeWave() {
      wavingHand.classList.remove("wave");
    }

    // Remove the wave animation after 15 seconds
    setTimeout(removeWave, 15000);

    // Remove the wave animation when hovered over
    wavingHand.addEventListener("mouseover", removeWave);
  } else {
    console.error('Element with id "waving-hand" not found');
  }
});
