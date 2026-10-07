const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readProjectFile } = require("./run-script.cjs");

const LOCALES = ["en", "pt_BR", "es_419", "es", "fr", "de", "it", "ja"];
const LANGUAGE_OPTION = /<option value="[a-z]{2}-[A-Z0-9]+">[^<]*<\/option>/g;
const TRANSLATED_ELEMENT = /<[^>]+data-i18n="[^"]+"[^>]*>[^<]*</g;
const TAG = /<[^>]+>/g;
const NUMBER = /[\d%]+/g;

const manifest = JSON.parse(readProjectFile("manifest.json"));
const popupHtml = readProjectFile("popup.html");
const messages = Object.fromEntries(
  LOCALES.map((locale) => [locale, JSON.parse(readProjectFile(`_locales/${locale}/messages.json`))])
);

function usedKeys() {
  const keys = new Set();
  for (const match of popupHtml.matchAll(/data-i18n(?:-title)?="([^"]+)"/g)) keys.add(match[1]);
  for (const file of ["popup.js", "independent-subtitles.js"]) {
    for (const match of readProjectFile(file).matchAll(/(?:getMessage|\bt)\("([^"]+)"/g)) keys.add(match[1]);
  }
  for (const match of JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)) keys.add(match[1]);
  return keys;
}

test("o idioma padrão é inglês", () => {
  assert.equal(manifest.default_locale, "en");
});

test("todos os idiomas têm as mesmas chaves do inglês, sem textos vazios", () => {
  const baseKeys = Object.keys(messages.en).sort();
  for (const locale of LOCALES) {
    assert.deepEqual(Object.keys(messages[locale]).sort(), baseKeys, `chaves diferentes em ${locale}`);
    for (const [key, entry] of Object.entries(messages[locale])) {
      assert.ok(typeof entry.message === "string" && entry.message.trim(), `${locale}.${key} vazio`);
    }
  }
});

test("toda chave usada no código existe em inglês", () => {
  const keys = usedKeys();
  assert.ok(keys.size > 20, "poucas chaves encontradas; o teste perdeu o padrão de busca");
  for (const key of keys) {
    assert.ok(messages.en[key], `chave "${key}" usada mas ausente em _locales/en`);
  }
});

test("o popup não tem texto fixo sem tradução", () => {
  const visibleText = popupHtml
    .replace(LANGUAGE_OPTION, "")
    .replace(TRANSLATED_ELEMENT, "<")
    .replace(TAG, " ")
    .replace(NUMBER, " ")
    .replace(/\s+/g, " ")
    .trim();
  assert.equal(visibleText, "", `texto sem tradução no popup: "${visibleText}"`);
});
