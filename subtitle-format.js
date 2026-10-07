(() => {
  "use strict";

  function scaleAss(content, percent) {
    const scale = Math.min(250, Math.max(100, Number(percent) || 100));
    if (scale === 100 || typeof content !== "string") return content;
    let inStyles = false;
    let fontSizeIndex = -1;
    const lines = content.split(/(\r?\n)/);
    for (let index = 0; index < lines.length; index += 2) {
      const line = lines[index];
      const section = /^\s*\[([^\]]+)\]/.exec(line);
      if (section) {
        inStyles = /^V4\+? Styles$/i.test(section[1]);
        fontSizeIndex = -1;
        continue;
      }
      if (inStyles && /^\s*Format\s*:/i.test(line)) {
        fontSizeIndex = line.replace(/^\s*Format\s*:/i, "")
          .split(",")
          .findIndex((field) => field.trim().toLowerCase() === "fontsize");
        continue;
      }
      if (inStyles && fontSizeIndex >= 0 && /^\s*Style\s*:/i.test(line)) {
        const match = /^(\s*Style\s*:\s*)(.*)$/i.exec(line);
        if (!match) continue;
        const fields = match[2].split(",");
        if (fields.length > fontSizeIndex && /^\s*\d+(?:\.\d+)?\s*$/.test(fields[fontSizeIndex])) {
          fields[fontSizeIndex] = String(Math.round(Number(fields[fontSizeIndex]) * scale / 10) / 10);
          lines[index] = match[1] + fields.join(",");
        }
      }
    }
    return lines.join("").replace(/\\fs(\d+(?:\.\d+)?)/gi, (_, size) =>
      `\\fs${Math.round(Number(size) * scale / 10) / 10}`);
  }

  // "#RRGGBB" + transparência (0 = opaco, 100 = invisível) → "&HAABBGGRR" do ASS.
  function assColor(hex, transparency = 0) {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
    if (!match) return null;
    const alpha = Math.round(Math.min(100, Math.max(0, Number(transparency) || 0)) * 2.55);
    return `&H${[alpha.toString(16).padStart(2, "0"), match[3], match[2], match[1]].join("").toUpperCase()}`;
  }

  // Estilos de fala: os que têm nome de diálogo e o mais usado pelos eventos.
  // Placas, músicas e letreiros mantêm a aparência original do episódio.
  const DIALOGUE_STYLE = /default|main|dialog|italic|flashback|top|overlap|internal|narrat|thought|alt/i;
  const NON_DIALOGUE_STYLE = /sign|song|karaoke|title|typeset|note|lyric|\bop\b|\bed\b/i;

  function styleAss(content, options = {}) {
    if (typeof content !== "string") return content;
    const color = assColor(options.color);
    const font = typeof options.font === "string" && options.font ? options.font.replace(/[,{}\\]/g, "") : null;
    const background = assColor(options.background, options.backgroundTransparency);
    if (!color && !font && !background) return content;

    const lines = content.split(/(\r?\n)/);
    let section = "";
    let styleFormat = null;
    let eventFormat = null;
    const usage = new Map();
    const styleLines = [];
    const eventLines = [];
    for (let index = 0; index < lines.length; index += 2) {
      const line = lines[index];
      const header = /^\s*\[([^\]]+)\]/.exec(line);
      if (header) {
        section = /^V4\+? Styles$/i.test(header[1]) ? "styles" : /^Events$/i.test(header[1]) ? "events" : "";
        continue;
      }
      const format = /^\s*Format\s*:(.*)$/i.exec(line);
      if (format && section) {
        const fields = format[1].split(",").map((field) => field.trim().toLowerCase());
        if (section === "styles") styleFormat = fields; else eventFormat = fields;
        continue;
      }
      if (section === "styles" && /^\s*Style\s*:/i.test(line)) styleLines.push(index);
      if (section === "events" && eventFormat && /^\s*Dialogue\s*:/i.test(line)) {
        const fields = line.replace(/^\s*Dialogue\s*:\s*/i, "").split(",");
        const style = (fields[eventFormat.indexOf("style")] || "").trim().replace(/^\*/, "");
        usage.set(style, (usage.get(style) || 0) + 1);
        eventLines.push({ index, style });
      }
    }
    if (!styleFormat) return content;

    const mostUsed = [...usage].sort((a, b) => b[1] - a[1])[0]?.[0];
    const targets = new Set();
    const column = (name) => styleFormat.indexOf(name);
    for (const index of styleLines) {
      const match = /^(\s*Style\s*:\s*)(.*)$/i.exec(lines[index]);
      const fields = match[2].split(",");
      const name = (fields[column("name")] || "").trim();
      if (name !== mostUsed && (!DIALOGUE_STYLE.test(name) || NON_DIALOGUE_STYLE.test(name))) continue;
      targets.add(name);
      const set = (key, value) => { if (column(key) >= 0 && column(key) < fields.length) fields[column(key)] = value; };
      if (font) set("fontname", font);
      if (color) set("primarycolour", color);
      if (background) {
        // BorderStyle 3 desenha uma caixa atrás do texto com a cor de contorno;
        // a espessura do contorno vira o respiro da caixa.
        const size = Number(fields[column("fontsize")]) || 48;
        set("borderstyle", "3");
        set("outlinecolour", background);
        set("backcolour", background);
        set("outline", String(Math.max(2, Math.round(size * 0.15))));
        set("shadow", "0");
      }
      lines[index] = match[1] + fields.join(",");
    }

    // Remove marcações da própria fala que desfariam a escolha (só nos estilos alterados).
    const removed = [];
    if (font) removed.push("fn[^\\\\}]*");
    if (color) removed.push("1?c&H[0-9a-f]+&?", "1a&H[0-9a-f]+&?");
    if (background) removed.push("[34]c&H[0-9a-f]+&?", "[34]a&H[0-9a-f]+&?", "[xy]?bord[\\d.]+", "[xy]?shad[\\d.-]+");
    const tags = new RegExp(`\\\\(?:${removed.join("|")})`, "gi");
    const textColumn = eventFormat ? eventFormat.length - 1 : -1;
    for (const { index, style } of eventLines) {
      if (!targets.has(style) || textColumn < 0) continue;
      const prefix = /^\s*Dialogue\s*:\s*/i.exec(lines[index])[0];
      const fields = lines[index].slice(prefix.length).split(",");
      const head = fields.slice(0, textColumn);
      const text = fields.slice(textColumn).join(",").replace(/\{[^}]*\}/g, (block) => block.replace(tags, ""));
      lines[index] = prefix + [...head, text].join(",");
    }
    return lines.join("");
  }

  function assTime(timestamp) {
    const parts = timestamp.trim().replace(",", ".").split(":");
    if (parts.length < 2 || parts.length > 3) return null;
    const seconds = Number(parts.pop());
    const minutes = Number(parts.pop());
    const hours = parts.length ? Number(parts.pop()) : 0;
    if (![hours, minutes, seconds].every(Number.isFinite)) return null;
    const total = hours * 3600 + minutes * 60 + seconds;
    const centiseconds = Math.round(total * 100);
    return `${Math.floor(centiseconds / 360000)}:${String(Math.floor(centiseconds / 6000) % 60).padStart(2, "0")}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
  }

  function vttToAss(vtt) {
    const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,3,1,2,40,40,50,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
    const events = [];
    for (const block of String(vtt).replace(/^\uFEFF/, "").replace(/\r/g, "").split(/\n\s*\n/)) {
      const lines = block.split("\n");
      const timingIndex = lines.findIndex((line) => line.includes(" --> "));
      if (timingIndex < 0) continue;
      const [rawStart, rawEnd] = lines[timingIndex].split(/\s+-->\s+/);
      const start = assTime(rawStart);
      const end = assTime(rawEnd.split(/\s+/)[0]);
      if (!start || !end) continue;
      const text = lines.slice(timingIndex + 1)
        .map((line) => line.replace(/<[^>]*>/g, "")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/[{}]/g, ""))
        .join("\\N");
      if (text) events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`);
    }
    return header + events.join("\n") + "\n";
  }

  globalThis.CrSubtitleFormat = { scaleAss, styleAss, vttToAss };
})();
