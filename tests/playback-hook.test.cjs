const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runScript } = require("./run-script.cjs");

const PLAY_URL = "https://www.crunchyroll.com/playback/v3/x/web/edge/play";
const CLEAN_URL = "https://v.vrv.co/clean/manifest.mpd";
const BURNED_IN_URL = "https://v.vrv.co/pt/manifest.mpd";
const ENABLED = { enabled: true, language: "pt-BR" };
const DISABLED = { enabled: false, language: "auto" };

const playback = {
  assetId: "episode-1",
  burnedInLocale: "",
  hardSubs: {
    none: { url: CLEAN_URL },
    "pt-BR": { url: BURNED_IN_URL, hlang: "pt-BR" }
  },
  subtitles: {
    "pt-BR": { language: "pt-BR", format: "ass", url: "https://vod-fy-mod.crunchyrollcdn.com/pt/subtitle.ass" }
  }
};

function loadHook(body, config) {
  const listeners = new Map();
  const events = [];
  class FakeXHR {
    open() {}
    get responseText() { return JSON.stringify(body); }
    get response() { return body; }
  }
  class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  const window = {
    addEventListener(name, handler) { listeners.set(name, handler); },
    dispatchEvent(event) { events.push(event); listeners.get(event.type)?.(event); },
    async fetch() { return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }); }
  };
  runScript("playback-hook.js", {
    window,
    document: { documentElement: { lang: "pt-BR" } },
    navigator: { language: "pt-BR" },
    location: { href: "https://www.crunchyroll.com/pt-br/watch/x", origin: "https://www.crunchyroll.com" },
    XMLHttpRequest: FakeXHR, Request, Response, Headers, URL, CustomEvent, setTimeout
  });
  window.dispatchEvent({ type: "cr-independent-config", detail: config });
  return { window, events, FakeXHR };
}

async function fetchPlayback(hook) {
  return (await hook.window.fetch(PLAY_URL)).json();
}

test("fetch troca o fluxo com legenda embutida pelo fluxo limpo", async () => {
  const body = await fetchPlayback(loadHook(playback, ENABLED));
  assert.equal(body.hardSubs["pt-BR"].url, CLEAN_URL);
});

test("avisa a página sobre a legenda escolhida", async () => {
  const hook = loadHook(playback, ENABLED);
  await fetchPlayback(hook);
  const notice = JSON.parse(hook.events.find((event) => event.type === "cr-independent-playback").detail);
  assert.equal(notice.selected.language, "pt-BR");
  assert.equal(notice.cleanApplied, true);
});

test("XHR troca o fluxo com legenda embutida pelo fluxo limpo", () => {
  const xhr = new (loadHook(playback, ENABLED).FakeXHR)();
  xhr.readyState = 4;
  xhr.status = 200;
  xhr.open("GET", PLAY_URL);
  assert.equal(xhr.response.hardSubs["pt-BR"].url, CLEAN_URL);
});

test("mantém a resposta original quando o modo está desativado", async () => {
  const body = await fetchPlayback(loadHook(playback, DISABLED));
  assert.equal(body.hardSubs["pt-BR"].url, BURNED_IN_URL);
});

test("mantém a resposta original quando não existe fluxo limpo", async () => {
  const withoutClean = { ...playback, hardSubs: { "pt-BR": playback.hardSubs["pt-BR"] } };
  const body = await fetchPlayback(loadHook(withoutClean, ENABLED));
  assert.equal(body.hardSubs["pt-BR"].url, BURNED_IN_URL);
});
