(() => {
  "use strict";

  const EVENT = "cr-independent-playback";
  const EXTENSION_ORIGIN = chrome.runtime.getURL("").replace(/\/$/, "");
  // Fontes empacotadas em vendor/fonts; o nome precisa ser o da família gravada no arquivo.
  const FONTS = {
    "atkinson-hyperlegible": { family: "Atkinson Hyperlegible", files: ["AtkinsonHyperlegible-Regular.ttf", "AtkinsonHyperlegible-Bold.ttf"] },
    lato: { family: "Lato", files: ["Lato-Regular.ttf", "Lato-Bold.ttf"] },
    "varela-round": { family: "Varela Round", files: ["VarelaRound-Regular.ttf"] },
    "pt-serif": { family: "PT Serif", files: ["PTSerif-Regular.ttf", "PTSerif-Bold.ttf"] }
  };
  const APPEARANCE_DEFAULTS = {
    subtitleColor: "original",
    subtitleFont: "original",
    subtitleBackground: "original",
    subtitleBackgroundTransparency: 0
  };
  const state = {
    language: "auto",
    scale: 100,
    appearance: { ...APPEARANCE_DEFAULTS },
    playback: null,
    rawSubtitle: null,
    format: null,
    video: null,
    frame: null,
    frameReady: false,
    fetchSerial: 0,
    needsLoad: false,
    lastGeometry: "",
    lastTimeSent: -1
  };
  let currentStatus = "";

  function setStatus(value) {
    if (value === currentStatus) return;
    currentStatus = value;
    document.documentElement?.setAttribute("data-cr-independent-status", value);
  }

  function configurePage() {
    window.dispatchEvent(new CustomEvent("cr-independent-config", {
      detail: JSON.stringify({ enabled: true, language: state.language })
    }));
  }

  function sendToFrame(kind, detail = {}) {
    if (!state.frameReady || !state.frame?.contentWindow) return;
    state.frame.contentWindow.postMessage({ channel: "cr-caption-parent", kind, ...detail }, EXTENSION_ORIGIN);
  }

  function ensureFrame() {
    if (state.frame) return;
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", ensureFrame, { once: true });
      return;
    }
    const frame = document.createElement("iframe");
    frame.src = chrome.runtime.getURL("renderer.html");
    frame.title = chrome.i18n.getMessage("rendererFrameTitle");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:absolute;pointer-events:none;border:0;background:transparent;z-index:auto;display:none;";
    frame.addEventListener("load", () => {
      state.frameReady = true;
      state.needsLoad = Boolean(state.rawSubtitle);
      state.lastGeometry = "";
      loadFrame();
    });
    state.frame = frame;
  }

  function topLevelChild(host, element) {
    while (element && element.parentElement !== host) element = element.parentElement;
    return element || null;
  }

  // Elementos sem posição são pintados antes de um iframe posicionado, mesmo vindo depois
  // dele no DOM. Os controles que cobrem o player inteiro passam a ser posicionados para
  // ficarem à frente da legenda, sem mudar o bloco de referência dos filhos.
  function raiseOverFrame(host) {
    const hostRect = host.getBoundingClientRect();
    for (let node = state.frame.nextElementSibling; node; node = node.nextElementSibling) {
      if (node.dataset.crRaised || getComputedStyle(node).position !== "static") continue;
      const rect = node.getBoundingClientRect();
      if (Math.abs(rect.left - hostRect.left) > 1 || Math.abs(rect.top - hostRect.top) > 1 ||
          Math.abs(rect.width - hostRect.width) > 1 || Math.abs(rect.height - hostRect.height) > 1) continue;
      node.dataset.crRaised = "";
      node.style.position = "relative";
    }
  }

  function framePlacement() {
    const player = state.video?.closest(".player-container");
    const fullscreen = document.fullscreenElement;
    const host = !fullscreen || fullscreen.contains(player)
      ? player
      : (player?.contains(fullscreen) && fullscreen.contains(state.video) ? fullscreen : null);
    if (host) {
      // Prefere a raiz dos controles; senão, entra logo depois do bloco que contém o vídeo.
      const controls = topLevelChild(host, host.querySelector('[data-testid="player-controls-root"]'));
      const before = controls || topLevelChild(host, state.video)?.nextElementSibling || null;
      return { host, before, insidePlayer: true };
    }
    return {
      host: document.fullscreenElement || document.body,
      before: null,
      insidePlayer: false
    };
  }

  function chooseVideo() {
    const videos = [...document.querySelectorAll("video")];
    return videos.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return br.width * br.height - ar.width * ar.height;
    })[0] || null;
  }

  function preparedSubtitle() {
    if (!state.rawSubtitle) return null;
    const ass = /^(vtt|webvtt)$/i.test(state.format)
      ? CrSubtitleFormat.vttToAss(state.rawSubtitle)
      : state.rawSubtitle;
    const { subtitleColor, subtitleFont, subtitleBackground, subtitleBackgroundTransparency } = state.appearance;
    return CrSubtitleFormat.styleAss(CrSubtitleFormat.scaleAss(ass, state.scale), {
      color: subtitleColor,
      font: FONTS[subtitleFont]?.family,
      background: subtitleBackground,
      backgroundTransparency: subtitleBackgroundTransparency
    });
  }

  function fontUrls() {
    const font = FONTS[state.appearance.subtitleFont];
    return font ? font.files.map((file) => chrome.runtime.getURL(`vendor/fonts/${state.appearance.subtitleFont}/${file}`)) : [];
  }

  function loadFrame() {
    if (!state.frameReady || !state.rawSubtitle || !state.video || !state.needsLoad) return;
    const rect = state.video.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    sendToFrame("load", {
      content: preparedSubtitle(),
      fonts: fontUrls(),
      width: rect.width,
      height: rect.height
    });
    state.needsLoad = false;
    sendToFrame("time", { time: state.video.currentTime || 0 });
    setStatus("loading-renderer");
  }

  function updateFrame() {
    if (!state.rawSubtitle) return;
    if (!state.video?.isConnected) state.video = chooseVideo();
    if (!state.video) return;
    ensureFrame();
    if (!state.frame) return;
    const { host, before, insidePlayer } = framePlacement();
    if (!host) return;
    state.frame.style.position = insidePlayer ? "absolute" : "fixed";
    state.frame.style.zIndex = insidePlayer ? "auto" : "2147483646";
    if (state.frame.parentElement !== host ||
        (before && (state.frame.compareDocumentPosition(before) & Node.DOCUMENT_POSITION_PRECEDING))) {
      state.frameReady = false;
      host.insertBefore(state.frame, before);
    }
    if (insidePlayer) raiseOverFrame(host);
    const rect = state.video.getBoundingClientRect();
    const hostRect = insidePlayer ? host.getBoundingClientRect() : null;
    if (rect.width < 10 || rect.height < 10) {
      state.frame.style.display = "none";
      return;
    }
    state.frame.style.display = "block";
    state.frame.style.left = `${rect.left - (hostRect?.left || 0)}px`;
    state.frame.style.top = `${rect.top - (hostRect?.top || 0)}px`;
    state.frame.style.width = `${rect.width}px`;
    state.frame.style.height = `${rect.height}px`;
    const geometry = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
    if (geometry !== state.lastGeometry) {
      state.lastGeometry = geometry;
      sendToFrame("resize", { width: rect.width, height: rect.height });
    }
    loadFrame();
    const time = state.video.currentTime || 0;
    if (Math.abs(time - state.lastTimeSent) > 0.05 || state.video.paused) {
      state.lastTimeSent = time;
      sendToFrame("time", { time });
    }
  }

  async function fetchSubtitle(rawUrl) {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !(
      host === "crunchyroll.com" || host.endsWith(".crunchyroll.com") ||
      host === "crunchyrollcdn.com" || host.endsWith(".crunchyrollcdn.com") ||
      host === "vrv.co" || host.endsWith(".vrv.co")
    )) throw new Error("Endereço da legenda não permitido.");
    const response = await fetch(url.href, { credentials: "omit" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > 5_000_000) throw new Error("Legenda muito grande.");
    const body = await response.text();
    if (body.length > 5_000_000) throw new Error("Legenda muito grande.");
    return body;
  }

  async function handlePlayback(playback) {
    state.playback = playback;
    state.rawSubtitle = null;
    state.format = null;
    state.needsLoad = false;
    state.lastGeometry = "";
    state.fetchSerial += 1;
    const serial = state.fetchSerial;
    sendToFrame("clear");
    if (!playback.selected) {
      setStatus("no-track");
      return;
    }
    if ((playback.burnedIn || playback.hardSubAvailable) && !playback.cleanApplied) {
      setStatus(playback.cleanAvailable ? "reload-required" : "no-clean-video");
      return;
    }
    setStatus("loading-track");
    try {
      const body = await fetchSubtitle(playback.selected.url);
      if (serial !== state.fetchSerial) return;
      state.rawSubtitle = body;
      state.format = playback.selected.format;
      state.needsLoad = true;
      state.video = chooseVideo();
      ensureFrame();
      setStatus("track-loaded");
      loadFrame();
    } catch (error) {
      if (serial !== state.fetchSerial) return;
      console.warn("Não foi possível carregar a legenda independente:", error);
      setStatus("track-error");
    }
  }

  window.addEventListener(EVENT, (event) => {
    try { handlePlayback(JSON.parse(event.detail)); }
    catch (_error) { setStatus("playback-error"); }
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== EXTENSION_ORIGIN || event.source !== state.frame?.contentWindow) return;
    if (event.data?.channel !== "cr-caption-frame") return;
    if (event.data.kind === "rendering") {
      setStatus("rendering");
    } else if (event.data.kind === "error") {
      console.warn("Renderizador de legendas:", event.data.detail);
      setStatus("renderer-error");
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "getSubtitleStatus") return false;
    sendResponse({ status: currentStatus });
    return false;
  });

  chrome.storage.sync.get({ subtitleLanguage: "auto", subtitleScale: 100, ...APPEARANCE_DEFAULTS }, (saved) => {
    state.language = typeof saved.subtitleLanguage === "string" ? saved.subtitleLanguage : "auto";
    state.scale = Number(saved.subtitleScale) || 100;
    for (const key of Object.keys(APPEARANCE_DEFAULTS)) state.appearance[key] = saved[key];
    configurePage();
    setStatus("waiting-playback");
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.subtitleLanguage) {
      state.language = String(changes.subtitleLanguage.newValue || "auto");
      configurePage();
      setStatus("reload-required");
    }
    let restyle = false;
    if (changes.subtitleScale) {
      state.scale = Number(changes.subtitleScale.newValue) || 100;
      restyle = true;
    }
    for (const key of Object.keys(APPEARANCE_DEFAULTS)) {
      if (!changes[key]) continue;
      state.appearance[key] = changes[key].newValue ?? APPEARANCE_DEFAULTS[key];
      restyle = true;
    }
    if (restyle) {
      state.needsLoad = true;
      loadFrame();
    }
  });

  setInterval(updateFrame, 100);
})();
