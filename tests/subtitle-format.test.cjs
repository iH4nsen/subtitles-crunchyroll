const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runScript } = require("./run-script.cjs");

const context = {};
context.globalThis = context;
const { scaleAss, styleAss, vttToAss } = runScript("subtitle-format.js", context).CrSubtitleFormat;

const ass = "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour\nStyle: Default,Arial,40,&H00FFFFFF\n[Events]\nDialogue: 0,0:00:01.00,0:00:02.00,Default,{\\fs30}Olá";
const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nOlá, mundo!\n\n00:00:03.000 --> 00:00:04.000\nSegunda linha\ncontinuação";
const styled = [
  "[V4+ Styles]",
  "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
  "Style: Main,Trebuchet MS,40,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1",
  "Style: Signs,Arial,30,&H0000FFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,8,10,10,10,1",
  "",
  "[Events]",
  "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  "Dialogue: 0,0:00:01.00,0:00:02.00,Main,,0,0,0,,{\\fnComic Sans\\c&H0000FF&\\bord4\\i1}Olá, mundo",
  "Dialogue: 0,0:00:03.00,0:00:04.00,Main,,0,0,0,,Tudo bem?",
  "Dialogue: 0,0:00:03.00,0:00:04.00,Signs,,0,0,0,,{\\fnImpact\\c&H00FF00&}PLACA"
].join("\n");
const customStyle = { color: "#FFE14D", font: "Atkinson Hyperlegible", background: "#000000", backgroundTransparency: 40 };

test("scaleAss aumenta o tamanho dos estilos e das marcações \\fs", () => {
  assert.match(scaleAss(ass, 150), /Style: Default,Arial,60,/);
  assert.match(scaleAss(ass, 150), /\{\\fs45\}Olá/);
});

test("scaleAss em 100% não altera a legenda", () => {
  assert.equal(scaleAss(ass, 100), ass);
});

test("vttToAss converte tempos e quebras de linha", () => {
  const converted = vttToAss(vtt);
  assert.match(converted, /Dialogue: 0,0:00:01\.00,0:00:02\.50,Default,,0,0,0,,Olá, mundo!/);
  assert.match(converted, /Segunda linha\\Ncontinuação/);
  assert.match(scaleAss(converted, 200), /Style: Default,Arial,96,/);
});

test("styleAss aplica cor, fonte e fundo às falas", () => {
  assert.match(styleAss(styled, customStyle), /Style: Main,Atkinson Hyperlegible,40,&H004DE1FF,&H000000FF,&H66000000,&H66000000,-1,0,0,0,100,100,0,0,3,6,0,2,/);
  assert.match(styleAss(vttToAss(vtt), { font: "Lato" }), /Style: Default,Lato,48,/);
});

test("styleAss remove das falas as marcações de cor, fonte e contorno", () => {
  assert.match(styleAss(styled, customStyle), /Main,,0,0,0,,\{\\i1\}Olá, mundo/);
});

test("styleAss preserva estilo e marcações das placas", () => {
  const out = styleAss(styled, customStyle);
  assert.match(out, /Style: Signs,Arial,30,&H0000FFFF,/);
  assert.match(out, /\{\\fnImpact\\c&H00FF00&\}PLACA/);
});

test("styleAss sem opções não altera a legenda", () => {
  assert.equal(styleAss(styled, {}), styled);
});

test("styleAss muda só a cor quando o fundo é o original", () => {
  assert.match(styleAss(styled, { color: "#FFFFFF" }), /Style: Main,Trebuchet MS,40,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,1,/);
});
