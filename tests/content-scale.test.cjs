const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runScript } = require("./run-script.cjs");

function loadContentScript(stored) {
  const attributes = new Set();
  const properties = new Map();
  let onChanged;
  const documentElement = {
    setAttribute(name) { attributes.add(name); },
    removeAttribute(name) { attributes.delete(name); },
    style: {
      setProperty(name, value) { properties.set(name, value); },
      removeProperty(name) { properties.delete(name); }
    }
  };
  const chrome = {
    storage: {
      sync: { get(_defaults, callback) { callback(stored); } },
      onChanged: { addListener(listener) { onChanged = listener; } }
    }
  };
  runScript("content.js", { chrome, document: { documentElement } });
  return { attributes, properties, changeSettings: (changes) => onChanged(changes, "sync") };
}

test("aplica a escala de texto salva", () => {
  const { attributes, properties } = loadContentScript({ subtitleScale: 150 });
  assert.ok(attributes.has("data-cr-subtitle-scale"));
  assert.equal(properties.get("--cr-subtitle-scale"), "1.5");
});

test("remove a escala quando volta para 100%", () => {
  const { attributes, properties, changeSettings } = loadContentScript({ subtitleScale: 150 });
  changeSettings({ subtitleScale: { newValue: 100 } });
  assert.ok(!attributes.has("data-cr-subtitle-scale"));
  assert.ok(!properties.has("--cr-subtitle-scale"));
});

test("ignora o zoom de vídeo legado", () => {
  const { attributes, changeSettings } = loadContentScript({ subtitleScale: 150, videoZoom: 130 });
  changeSettings({ videoZoom: { newValue: 150 } });
  assert.ok(!attributes.has("data-cr-video-zoom"));
});
