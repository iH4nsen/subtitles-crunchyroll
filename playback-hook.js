(() => {
  "use strict";

  const PLAYBACK_PATH = /\/playback\/v3\/[^/]+\/web\/[^/]+\/play(?:[?#]|$)/i;
  const EVENT = "cr-independent-playback";
  let enabled = false;
  let preferredLanguage = "auto";
  let configurationReceived = false;
  let releaseConfiguration;
  const configurationReady = new Promise((resolve) => { releaseConfiguration = resolve; });

  window.addEventListener("cr-independent-config", (event) => {
    let next = event.detail || {};
    if (typeof next === "string") {
      try { next = JSON.parse(next); } catch (_error) { next = {}; }
    }
    enabled = next.enabled === true;
    preferredLanguage = typeof next.language === "string" ? next.language : "auto";
    if (!configurationReceived) {
      configurationReceived = true;
      releaseConfiguration();
    }
  });

  function isPlaybackRequest(input) {
    try {
      const raw = input instanceof Request ? input.url : String(input);
      const url = new URL(raw, location.href);
      return url.origin === location.origin && PLAYBACK_PATH.test(url.pathname);
    } catch (_error) {
      return false;
    }
  }

  function languageMatch(left, right) {
    return String(left).toLowerCase() === String(right).toLowerCase();
  }

  function availableTracks(playback) {
    const tracks = [];
    for (const group of [playback?.subtitles, playback?.captions]) {
      if (!group || typeof group !== "object") continue;
      for (const [key, track] of Object.entries(group)) {
        if (!track || typeof track.url !== "string") continue;
        try {
          if (new URL(track.url).protocol !== "https:") continue;
        } catch (_error) {
          continue;
        }
        const language = track.language || key;
        const format = String(track.format || "").toLowerCase();
        if (!/^(ass|ssa|vtt|webvtt)$/.test(format)) continue;
        tracks.push({ language, format, url: track.url });
      }
    }
    return tracks;
  }

  function chooseTrack(playback, tracks) {
    if (!tracks.length) return null;
    if (preferredLanguage !== "auto") {
      return tracks.find((track) => languageMatch(track.language, preferredLanguage)) || null;
    }
    const candidates = [playback.burnedInLocale, navigator.language, document.documentElement?.lang];
    for (const candidate of candidates) {
      const found = tracks.find((track) => languageMatch(track.language, candidate));
      if (found) return found;
    }
    return tracks[0];
  }

  function inspectPlayback(playback) {
    if (!playback || typeof playback !== "object") return { body: playback, changed: false };
    const tracks = availableTracks(playback);
    const selected = chooseTrack(playback, tracks);
    const cleanUrl = playback.hardSubs?.none?.url;
    const burnedIn = Boolean(playback.burnedInLocale);
    let changed = false;
    let cleanApplied = false;
    let body = playback;

    if (enabled && selected && typeof cleanUrl === "string" && cleanUrl.startsWith("https://")) {
      body = JSON.parse(JSON.stringify(playback));
      for (const [language, stream] of Object.entries(body.hardSubs || {})) {
        if (language === "none" || !stream || typeof stream.url !== "string") continue;
        if (stream.url !== cleanUrl) {
          stream.url = cleanUrl;
          stream.hlang = "none";
          changed = true;
        }
      }
      if (body.burnedInLocale) {
        body.burnedInLocale = "";
        changed = true;
      }
      cleanApplied = true;
    }

    window.dispatchEvent(new CustomEvent(EVENT, {
      detail: JSON.stringify({
        tracks,
        selected,
        burnedIn,
        hardSubAvailable: Object.keys(playback.hardSubs || {}).some((language) => language !== "none"),
        cleanAvailable: typeof cleanUrl === "string" && cleanUrl.startsWith("https://"),
        cleanApplied,
        assetId: playback.assetId || null
      })
    }));
    return { body, changed };
  }

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    if (!isPlaybackRequest(args[0])) return originalFetch.apply(this, args);
    if (!configurationReceived) {
      await Promise.race([configurationReady, new Promise((resolve) => setTimeout(resolve, 500))]);
    }
    const response = await originalFetch.apply(this, args);
    if (!response.ok) return response;
    try {
      const playback = await response.clone().json();
      const result = inspectPlayback(playback);
      if (!result.changed) return response;
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.set("content-type", "application/json");
      return new Response(JSON.stringify(result.body), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (_error) {
      return response;
    }
  };

  const xhrOpen = XMLHttpRequest.prototype.open;
  const textGetter = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, "responseText")?.get;
  const responseGetter = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, "response")?.get;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (isPlaybackRequest(url) && textGetter && responseGetter) {
      let cached;
      const read = (original) => {
        if (this.readyState !== 4 || this.status < 200 || this.status >= 300) return original;
        if (!cached) {
          try {
            const playback = typeof original === "string" ? JSON.parse(original) : original;
            const result = inspectPlayback(playback);
            cached = { text: result.changed ? JSON.stringify(result.body) : null, body: result.changed ? result.body : null };
          } catch (_error) {
            cached = { text: null, body: null };
          }
        }
        return typeof original === "string" ? (cached.text ?? original) : (cached.body ?? original);
      };
      try {
        Object.defineProperty(this, "responseText", {
          configurable: true,
          get: () => read(textGetter.call(this))
        });
        Object.defineProperty(this, "response", {
          configurable: true,
          get: () => read(responseGetter.call(this))
        });
      } catch (_error) {
        // Keep the native XHR response if this browser does not allow overriding it.
      }
    }
    return xhrOpen.call(this, method, url, ...rest);
  };
})();
