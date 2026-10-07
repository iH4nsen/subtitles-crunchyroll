(() => {
  "use strict";

  const TEXT_SETTING = "subtitleScale";
  const DEFAULT_SCALE = 100;
  const MIN_SCALE = 100;
  const MAX_SCALE = 250;

  function clampScale(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, number))
      : DEFAULT_SCALE;
  }

  function applyTextScale(value) {
    const scale = clampScale(value);
    if (!document.documentElement) {
      document.addEventListener("DOMContentLoaded", () => applyTextScale(scale), { once: true });
      return;
    }
    if (scale === DEFAULT_SCALE) {
      document.documentElement.removeAttribute("data-cr-subtitle-scale");
      document.documentElement.style.removeProperty("--cr-subtitle-scale");
      document.documentElement.style.removeProperty("--cr-subtitle-size");
      return;
    }
    document.documentElement.setAttribute("data-cr-subtitle-scale", "");
    document.documentElement.style.setProperty("--cr-subtitle-scale", String(scale / 100));
    document.documentElement.style.setProperty("--cr-subtitle-size", `${scale}%`);
  }

  chrome.storage.sync.get({ [TEXT_SETTING]: DEFAULT_SCALE }, (result) => {
    applyTextScale(result[TEXT_SETTING]);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes[TEXT_SETTING]) applyTextScale(changes[TEXT_SETTING].newValue);
  });
})();
