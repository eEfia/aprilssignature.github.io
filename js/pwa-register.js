"use strict";
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = new URL("sw.js", window.location.href);
    navigator.serviceWorker.register(swUrl, {scope: "/"}).catch(error => console.warn("Offline access could not be enabled:", error));
  });
}
