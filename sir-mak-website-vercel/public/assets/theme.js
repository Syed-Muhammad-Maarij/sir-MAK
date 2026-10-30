// Runs before the page paints (loaded without defer) so a saved light theme never flashes dark.
// Navy-black is the default; the header switch stores the visitor's choice on this device only.
(function () {
  try {
    if (localStorage.getItem("theme") === "light") document.documentElement.dataset.theme = "light";
  } catch (e) { /* storage blocked: keep the default */ }
})();
