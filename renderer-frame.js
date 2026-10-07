(() => {
  "use strict";

  const canvas = document.getElementById("captions");
  let renderer = null;
  let currentTime = 0;
  let parentOrigin = "https://www.crunchyroll.com";

  function report(kind, detail) {
    window.parent.postMessage({ channel: "cr-caption-frame", kind, detail }, parentOrigin);
  }

  function resize(width, height) {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(width * ratio));
    const h = Math.max(1, Math.round(height * ratio));
    if (canvas.width === w && canvas.height === h) return;
    if (renderer) {
      renderer.resize(w, h);
      renderer.setCurrentTime(currentTime);
    } else {
      canvas.width = w;
      canvas.height = h;
    }
  }

  const FONT_ROOT = chrome.runtime.getURL("vendor/fonts/");

  function load(content, width, height, fonts) {
    renderer?.dispose();
    renderer = null;
    resize(width, height);
    try {
      renderer = new SubtitlesOctopus({
        canvas,
        subContent: content,
        workerUrl: chrome.runtime.getURL("vendor/libass-wasm/subtitles-octopus-worker.js"),
        legacyWorkerUrl: chrome.runtime.getURL("vendor/libass-wasm/subtitles-octopus-worker-legacy.js"),
        fallbackFont: chrome.runtime.getURL("vendor/libass-wasm/default.woff2"),
        fonts,
        onReady: () => {
          renderer?.setCurrentTime(currentTime);
          report("rendering");
        },
        onError: (error) => report("error", String(error?.message || error))
      });
    } catch (error) {
      report("error", String(error?.message || error));
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.origin !== "https://www.crunchyroll.com") return;
    const message = event.data;
    if (message?.channel !== "cr-caption-parent") return;
    parentOrigin = event.origin;
    if (message.kind === "load" && typeof message.content === "string") {
      // Só aceita fontes empacotadas na própria extensão.
      const fonts = Array.isArray(message.fonts)
        ? message.fonts.filter((url) => typeof url === "string" && url.startsWith(FONT_ROOT) && !url.includes(".."))
        : [];
      load(message.content, Number(message.width) || 1, Number(message.height) || 1, fonts);
    } else if (message.kind === "resize") {
      resize(Number(message.width) || 1, Number(message.height) || 1);
    } else if (message.kind === "time") {
      currentTime = Number(message.time) || 0;
      renderer?.setCurrentTime(currentTime);
    } else if (message.kind === "clear") {
      renderer?.dispose();
      renderer = null;
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    }
  });

  report("ready");
})();
