(() => {
  "use strict";

  const DEFAULTS = {
    subtitleScale: 100,
    subtitleLanguage: "auto",
    subtitleColor: "original",
    subtitleFont: "original",
    subtitleBackground: "original",
    subtitleBackgroundTransparency: 0
  };

  const t = (key) => chrome.i18n.getMessage(key);

  // Troca os textos pelo idioma do navegador antes de montar as listas, que copiam o texto das opções.
  function localize() {
    document.documentElement.lang = chrome.i18n.getUILanguage();
    for (const element of document.querySelectorAll("[data-i18n]")) {
      element.textContent = t(element.dataset.i18n);
    }
    for (const element of document.querySelectorAll("[data-i18n-title]")) {
      element.title = t(element.dataset.i18nTitle);
    }
  }

  localize();

  const slider = document.getElementById("scale");
  const value = document.getElementById("scale-value");
  const transparency = document.getElementById("transparency");
  const transparencyValue = document.getElementById("transparency-value");
  const language = document.getElementById("language");
  const languageDropdown = enhanceSelect(language);
  const font = document.getElementById("font");
  const fontDropdown = enhanceSelect(font);
  const colorInputs = [...document.querySelectorAll('input[name="color"]')];
  const backgroundInputs = [...document.querySelectorAll('input[name="background"]')];
  const reset = document.getElementById("reset");
  const status = document.getElementById("status");
  const playbackStatus = document.getElementById("playback-status");

  const statusMessages = {
    "no-track": t("statusNoTrack"),
    "no-clean-video": t("statusNoCleanVideo"),
    "reload-required": t("statusReloadRequired"),
    "track-error": t("statusTrackError"),
    "renderer-error": t("statusRendererError")
  };

  function updatePlaybackStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = chrome.runtime.lastError ? null : tabs?.[0]?.id;
      if (tabId == null) {
        playbackStatus.textContent = "";
        return;
      }
      chrome.tabs.sendMessage(tabId, { type: "getSubtitleStatus" }, (result) => {
        // Só mostra avisos que pedem ação; o estado normal fica em silêncio.
        playbackStatus.textContent = chrome.runtime.lastError ? "" : statusMessages[result?.status] || "";
      });
    });
  }

  function clamp(number, control) {
    const min = Number(control.min);
    const max = Number(control.max);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min;
  }

  function showRange(control, output, number) {
    const current = clamp(Number(number), control);
    control.value = String(current);
    output.textContent = `${current}%`;
    // Preenche a trilha até o valor atual.
    const fill = ((current - Number(control.min)) / (Number(control.max) - Number(control.min))) * 100;
    control.style.setProperty("--fill", `${fill}%`);
  }

  function checkRadio(inputs, selected) {
    const match = inputs.find((input) => input.value === selected) || inputs[0];
    match.checked = true;
  }

  function selectOption(select, dropdown, selected) {
    select.value = [...select.options].some((option) => option.value === selected) ? selected : select.options[0].value;
    dropdown.sync();
  }

  // A transparência só vale para um fundo em caixa.
  function updateTransparencyState() {
    const original = backgroundInputs.find((input) => input.checked)?.value === "original";
    transparency.disabled = original;
    transparency.closest("section").classList.toggle("no-background", original);
  }

  function apply(settings) {
    showRange(slider, value, settings.subtitleScale);
    showRange(transparency, transparencyValue, settings.subtitleBackgroundTransparency);
    selectOption(language, languageDropdown, settings.subtitleLanguage);
    selectOption(font, fontDropdown, settings.subtitleFont);
    checkRadio(colorInputs, settings.subtitleColor);
    checkRadio(backgroundInputs, settings.subtitleBackground);
    updateTransparencyState();
  }

  function save(changes, message = "") {
    chrome.storage.sync.set(changes, () => {
      status.textContent = chrome.runtime.lastError
        ? t("saveError")
        : message;
    });
  }

  chrome.storage.sync.get(DEFAULTS, apply);

  slider.addEventListener("input", () => showRange(slider, value, slider.value));
  slider.addEventListener("change", () => save({ subtitleScale: Number(slider.value) }));
  transparency.addEventListener("input", () => showRange(transparency, transparencyValue, transparency.value));
  transparency.addEventListener("change", () => save({ subtitleBackgroundTransparency: Number(transparency.value) }));
  language.addEventListener("change", () => save({ subtitleLanguage: language.value }, t("statusReloadRequired")));
  font.addEventListener("change", () => save({ subtitleFont: font.value }));
  for (const input of colorInputs) {
    input.addEventListener("change", () => save({ subtitleColor: input.value }));
  }
  for (const input of backgroundInputs) {
    input.addEventListener("change", () => {
      updateTransparencyState();
      save({ subtitleBackground: input.value });
    });
  }
  reset.addEventListener("click", () => {
    // Restaura a aparência; o idioma escolhido continua.
    const { subtitleLanguage: _language, ...appearance } = DEFAULTS;
    apply({ ...DEFAULTS, subtitleLanguage: language.value });
    save(appearance);
  });
  updatePlaybackStatus();
  setInterval(updatePlaybackStatus, 1500);
})();
