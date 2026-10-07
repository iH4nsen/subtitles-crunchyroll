[English](#english) · [Português](#português)

---

## English

# Subtitle Adjuster for Crunchyroll 

Local extension for Chrome and Edge. It automatically displays separate subtitles using its own renderer.

### Installation

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `crunchyroll-legendas` folder. If the extension is already loaded, click **Reload** on its card.
4. Open an episode and adjust the controls from the extension icon.

### How it works

The extension watches the playback response the player already requests, looks for an ASS or VTT track in the chosen language and, when Crunchyroll offers a stream without burned-in subtitles, uses that stream to avoid duplicate subtitles. The track is drawn over the video by a local renderer. **Size** ranges from 100% to 250%. You can also choose the **Text color**, the **Font** (Easy reading, Modern, Rounded or Serif), a boxed **Background** (black, gray or navy blue) and the **Background transparency**. Everything can be changed during playback; **Restore defaults** brings back the original look without changing the language.

Color, font and background apply to dialogue. Signs and on-screen text keep their original color and outline.

After changing the language, reload the episode so the player selects the correct track. If there is no separate track or no stream without burned-in subtitles, the original video remains available.

The subtitle is placed between the video and the player controls, so the playback bar and buttons appear in front of the text when shown.

### Limitations and troubleshooting

- Availability of tracks and of a clean stream varies by episode, language and region. The extension does not create editable text from subtitles burned into the image.
- The ASS renderer uses `libass-wasm` bundled with the extension. For VTT, the extension converts the lines to ASS; advanced VTT formatting may not be preserved.
- The extension depends on the structure of Crunchyroll's `/playback/v3` response. Changes to the site may require an update.
- Capturing and switching the stream happens when the page loads. If the response is not captured, the original video remains available; separate mode will have no effect until a compatible version is released.
- To troubleshoot, inspect the `data-cr-independent-status` attribute of the page's `<html>` element. Values such as `no-track`, `no-clean-video`, `track-error` and `renderer-error` indicate which step failed.
- On October 6, 2026, separate mode was tested in Edge on episode `GE00384327JAJP`: the player requested the clean stream, the Portuguese ASS subtitle appeared over the video, 150% scaling was applied and the subtitle stayed visible when entering and leaving full screen. Other episodes, languages and browsers still need validation.

The extension only acts on the Crunchyroll website in the browser. There is no data collection, no ads and no server of its own. The only declared permission, `storage`, keeps your preferences. Tracks are loaded directly by the page when the subtitle server allows that access.

### Credits

The [`libass-wasm` 4.1.0](https://github.com/libass/JavascriptSubtitlesOctopus) renderer is included in `vendor/libass-wasm/` with its original license and copyright notices.

The fonts [Atkinson Hyperlegible](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegible), [Lato](https://github.com/google/fonts/tree/main/ofl/lato), [Varela Round](https://github.com/google/fonts/tree/main/ofl/varelaround) and [PT Serif](https://github.com/google/fonts/tree/main/ofl/ptserif) are in `vendor/fonts/`, each with its SIL Open Font License (`OFL.txt`).

---

## Português

# Ajustar legendas para Crunchyroll

Extensão local para Chrome e Edge. Exibe automaticamente legendas separadas com um renderizador próprio.

### Instalação

1. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta `crunchyroll-legendas`. Se a extensão já estiver carregada, clique em **Atualizar** no cartão dela.
4. Abra um episódio e ajuste os controles no ícone da extensão.

### Como funciona

A extensão observa a resposta de reprodução já solicitada pelo player, procura uma faixa ASS ou VTT no idioma escolhido e, quando a Crunchyroll oferece um fluxo sem legenda incorporada, usa esse fluxo para evitar legendas duplicadas. A faixa é desenhada sobre o vídeo por um renderizador local. **Tamanho** vai de 100% a 250%. Também é possível escolher a **cor do texto**, a **fonte** (Leitura fácil, Moderna, Arredondada ou Serifada), um **fundo** em caixa (preto, cinza ou azul-marinho) e a **transparência do fundo**. Tudo pode ser mudado durante a reprodução; **Restaurar padrão** volta à aparência original sem trocar o idioma.

Cor, fonte e fundo valem para as falas. Placas e letreiros mantêm a cor e o contorno originais.

Depois de trocar o idioma, recarregue o episódio para que o player selecione a faixa correta. Se não houver faixa separada ou fluxo sem legenda incorporada, o vídeo original continua disponível.

A legenda é colocada entre o vídeo e os controles do player. Assim, a barra de reprodução e os botões aparecem à frente do texto quando são exibidos.

### Limites e diagnóstico

- A disponibilidade de faixas e de um fluxo limpo varia conforme o episódio, idioma e região. A extensão não cria um texto editável a partir de uma legenda gravada na imagem.
- O renderizador ASS usa `libass-wasm` empacotado na extensão. Para VTT, a extensão converte as falas para ASS; formatações avançadas de VTT podem não ser preservadas.
- A extensão depende da estrutura da resposta `/playback/v3` da Crunchyroll. Mudanças no site podem exigir atualização.
- A captura e a troca do fluxo acontecem no carregamento da página. Se a resposta não for capturada, o vídeo original continua disponível; o modo separado não terá efeito até uma versão compatível.
- Para diagnosticar, inspecione o atributo `data-cr-independent-status` do elemento `<html>` na página. Valores como `no-track`, `no-clean-video`, `track-error` e `renderer-error` indicam a etapa que falhou.
- Em 6 de outubro de 2026, o modo separado foi testado no Edge no episódio `GE00384327JAJP`: o player solicitou o fluxo limpo, a legenda ASS em português apareceu sobre o vídeo, a escala de 150% foi aplicada e a legenda continuou visível ao entrar e sair da tela cheia. Outros episódios, idiomas e navegadores ainda dependem de validação.

A extensão atua apenas no site da Crunchyroll no navegador. Não há coleta de dados, anúncios ou servidor próprio. A única permissão declarada, `storage`, guarda suas preferências. As faixas são carregadas diretamente pela página quando o servidor de legendas permite esse acesso.

### Créditos

O renderizador [`libass-wasm` 4.1.0](https://github.com/libass/JavascriptSubtitlesOctopus) está incluído em `vendor/libass-wasm/` com os avisos de licença e direitos autorais originais.

As fontes [Atkinson Hyperlegible](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegible), [Lato](https://github.com/google/fonts/tree/main/ofl/lato), [Varela Round](https://github.com/google/fonts/tree/main/ofl/varelaround) e [PT Serif](https://github.com/google/fonts/tree/main/ofl/ptserif) estão em `vendor/fonts/`, cada uma com sua licença SIL Open Font License (`OFL.txt`).
