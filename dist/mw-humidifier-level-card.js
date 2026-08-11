/* mw-ha-humidifier-level-card — custom:mw-humidifier-level-card
 *
 * Uma linha: ícone · rótulo · seletor. Para o nível de névoa do umidificador
 * (e para qualquer outro `select` dele: countdown, modo, velocidade).
 * Papel/neumórfico da família MW, com os quatro estados desenhados.
 *
 * Aponte o dispositivo e escolha a entidade — o resto (ícone, rótulo, opções)
 * o card descobre sozinho.
 *
 * Arquivo único, sem build: este arquivo é fonte e artefato. JS puro +
 * <ha-form> do HA, sem dependências.
 * Repo: https://github.com/visaodeempresa/mw-ha-humidifier-level-card
 *
 * Três lições da família já embutidas, todas com verificação no probe:
 *  · `line-height` SEM unidade — o frontend do HA define um valor absoluto no
 *    body e ele herda para dentro do shadow DOM;
 *  · `:host{display:block}` — elemento custom nasce inline;
 *  · DOM montado uma vez e atualizado em custom properties: reconstruir o
 *    <select> a cada `hass` fecharia o menu nativo no dedo do usuário.
 */
(() => {
  "use strict";

  const VERSION = "0.3.1";

  const DEFAULTS = {
    entity: "",
    device: "",              // só o editor usa, para filtrar
    name: "",                // vazio = papel da entidade (Nível, Timer…)
    icon: "",                // vazio = ícone do papel
    option_labels: null,     // { "LEVEL 1": "Baixo", … }
    show_icon: true,
    show_name: true,
    haptic: true,
    height: 48,              // altura da linha, px
    radius: 14,
    paper_color: "paper",
    level_scheme: "none",    // rampa predefinida: agua, semaforo, calor…
    level_paint: "card",     // onde a cor do nível pousa: card | select | both
    level_colors: null,      // { "LEVEL 1": "blue-2" } ou ["blue-2", …] — vence o esquema
    // cores por estado
    color_on_name: "#1a1a1a",
    color_off_name: "rgba(255, 255, 255, 0.78)",
    color_off_bg: "rgba(0, 0, 0, 0.45)",
    color_on_border: "rgba(180, 180, 180, 0.55)",
    color_off_border: "rgba(255, 255, 255, 0.08)",
    color_unavail_bg: "rgba(80, 0, 0, 0.6)",
    color_unavail_border: "rgba(255, 80, 80, 0.3)",
    color_dead: "#f5c518",
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // >>> paper-palette v1 — fonte canônica: /Volumes/SSD-T1-01/CLAUDE-SSD/IA/lib/paper-palette/paper-palette.js
  // 49 papéis encardidos: 7 matizes do arco-íris × 7 tons (1 = quase branco,
  // 7 = mais encardido). Saturação baixa de propósito — papel descansa a vista.
  const PAPER_HUES = [
    ["red", "Vermelho", 6], ["orange", "Laranja", 27], ["yellow", "Amarelo", 47],
    ["green", "Verde", 96], ["blue", "Azul", 203], ["indigo", "Anil", 236],
    ["violet", "Violeta", 283],
  ];
  const PAPER_TONES = [[97, 6], [96, 9], [94, 12], [92, 15], [90, 18], [88, 21], [85, 24]];
  const PAPER_DEFAULT = "linear-gradient(145deg, #fdfaf3, #e8e3d8)";
  const paperGradient = (key) => {
    const m = /^([a-z]+)-([1-7])$/.exec(String(key || "").trim());
    if (!m) return PAPER_DEFAULT;
    const hue = PAPER_HUES.find((h) => h[0] === m[1]);
    if (!hue) return PAPER_DEFAULT;
    const [l, s] = PAPER_TONES[+m[2] - 1];
    return `linear-gradient(145deg, hsl(${hue[2]}, ${s}%, ${l}%), hsl(${hue[2]}, ${s + 4}%, ${l - 7}%))`;
  };
  const paperOptions = () => [{ value: "paper", label: "Papel original (creme)" }].concat(
    ...PAPER_HUES.map((h) => PAPER_TONES.map((t, i) => ({
      value: `${h[0]}-${i + 1}`,
      label: `${h[1]} · tom ${i + 1}${i === 0 ? " (mais claro)" : i === 6 ? " (mais encardido)" : ""}`,
    }))));
  // <<< paper-palette v1

  /* ---------------------- cor: leitura e derivação ----------------------
   * parseColor devolve null quando não reconhece o texto — é assim que uma
   * cor nomeada do CSS ("tomato") sobrevive: não dá para calcular contraste
   * nem escurecer, então ela é usada crua, do jeito que veio. */
  const parseColor = (str) => {
    const s = String(str || "").trim();
    let m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$/i);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    m = s.match(/^#([0-9a-f]{6})$/i);
    if (m) { const n = parseInt(m[1], 16); return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 }; }
    m = s.match(/^#([0-9a-f]{3})$/i);
    if (m) { const [r, g, b] = m[1].split("").map((ch) => parseInt(ch + ch, 16)); return { r, g, b, a: 1 }; }
    return null;
  };
  const parseColorOr = (str, fb = { r: 128, g: 128, b: 128, a: 1 }) => parseColor(str) || fb;
  const toHex = ({ r, g, b }) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  const toRgba = ({ r, g, b, a }) => `rgba(${r}, ${g}, ${b}, ${a})`;
  const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const shade = ({ r, g, b, a }, f) =>
    `rgba(${clamp255(r * f)}, ${clamp255(g * f)}, ${clamp255(b * f)}, ${a === undefined ? 1 : a})`;
  // luminância perceptual simples (sRGB ponderado) — só decide claro/escuro
  const luma = ({ r, g, b }) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  /* ------------------------- COR POR NÍVEL -------------------------
   * A rampa é amostrada pela POSIÇÃO da opção: serve para 3 níveis de névoa
   * e para um countdown de 9 horas sem uma linha de configuração.
   *
   * Por que cor própria e não a paleta de papel: papel encardido é de
   * saturação baixa DE PROPÓSITO (descansa a vista num card que fica ligado
   * o dia todo) — e três tons dele lado a lado ficam indistinguíveis, que é
   * justamente o contrário do que uma cor por nível serve para fazer. Estas
   * são cartolinas coloridas: saturação média, nunca néon, e o relevo de
   * papel continua sendo desenhado por cima. Quem quiser o sussurro tem os
   * esquemas «névoa» e «encardido», feitos com as chaves da paleta.
   *
   * As de matiz único vão do claro (nível baixo) ao fundo (nível alto). */
  const LEVEL_SCHEMES = [
    ["none", "— cor única (sem cor por nível) —", []],
    ["agua", "Água · azul claro → azul fundo", ["#e3f1fb", "#a8d4f0", "#5aa9dd", "#1d6fa8"]],
    ["verde", "Verde · broto → mata", ["#e2f0dc", "#b5dcaa", "#79bd6f", "#33793a"]],
    ["mare", "Maré · verde-água → anil", ["#dff1e6", "#a9dcc4", "#56b4a4", "#1f6f8c"]],
    ["semaforo", "Semáforo · verde → amarelo → vermelho", ["#bfe3b5", "#f2e08a", "#f0b46a", "#d1604c"]],
    ["calor", "Calor · amarelo → laranja → vermelho", ["#f7e6a8", "#f1b96b", "#e2794f", "#b8342a"]],
    ["arco-iris", "Arco-íris · violeta → vermelho",
      ["#cdbde3", "#a9b6e0", "#8fc3e2", "#a8d8b0", "#f0e199", "#f0b877", "#e0806f"]],
    ["noite", "Noite · anil claro → noite fechada", ["#cfd6ec", "#8f9dc9", "#5b5f96", "#2f2f57"]],
    ["nevoa", "Névoa · sussurro de papel (creme → azul)", ["paper", "blue-2", "blue-4", "blue-6"]],
    ["encardido", "Encardido · sussurro de papel (creme → papel velho)",
      ["paper", "yellow-3", "orange-4", "orange-6"]],
  ];
  const schemeColors = (key) => (LEVEL_SCHEMES.find((s) => s[0] === String(key || "none")) || [])[2] || [];
  const schemeOptions = () => LEVEL_SCHEMES.map(([value, label]) => ({ value, label }));

  // onde a cor pousa. `select` é o discreto: a parede segue de papel e só o
  // controle muda de cor — bom para uma coluna de umidificadores lado a lado.
  const PAINT_OPTIONS = [
    { value: "card", label: "O card inteiro (papel colorido)" },
    { value: "select", label: "Só o seletor (a pílula)" },
    { value: "both", label: "Os dois" },
  ];

  // amostra a rampa pela posição: o primeiro nível pega a primeira cor, o
  // último pega a última, e o meio se distribui — vale para 2 ou 9 opções
  const rampAt = (list, i, n) => {
    if (!list.length) return null;
    if (n <= 1 || list.length === 1) return list[list.length - 1];
    return list[Math.round((i * (list.length - 1)) / (n - 1))];
  };

  const isPaperKey = (v) => v === "paper" || /^[a-z]+-[1-7]$/.test(String(v || "").trim());
  const isRawCss = (v) => /^(linear|radial|conic|repeating-linear|repeating-radial)-gradient\(|^var\(/i
    .test(String(v || "").trim());

  /* Texto do usuário → o que o card precisa: um fundo pronto e se ele é
   * escuro (aí o texto preto de papel deixa de servir). Aceita chave da
   * paleta, hex, rgb/rgba, gradiente inteiro e nome de cor do CSS. */
  const levelBackground = (value) => {
    const v = String(value ?? "").trim();
    if (!v) return null;
    if (isPaperKey(v)) return { bg: paperGradient(v), dark: false };
    if (isRawCss(v)) return { bg: v, dark: false };
    const c = parseColor(v);
    if (!c) return { bg: v, dark: false };   // nome do CSS: usa cru
    return { bg: `linear-gradient(145deg, ${shade(c, 1.06)}, ${shade(c, 0.86)})`, dark: luma(c) < 0.55 };
  };

  // vibração: o app companion escuta "haptic" na window; fora dele, o
  // navigator.vibrate (Chrome do Android; o Safari do iPhone não vibra)
  const VIBRATE_MS = { selection: 5, light: 10, medium: 20 };
  const inCompanionApp = () =>
    !!(window.externalApp || window.webkit?.messageHandlers?.externalBus);
  const haptic = (kind) => {
    try {
      window.dispatchEvent(new CustomEvent("haptic",
        { bubbles: true, composed: true, detail: kind }));
      if (!inCompanionApp() && navigator.vibrate) navigator.vibrate(VIBRATE_MS[kind] ?? 10);
    } catch (e) { /* vibração é enfeite: nunca pode derrubar o toque */ }
  };

  /* Papel da entidade, decidido pelo FIM do object_id — cópia consciente do
   * mw-ha-humidifier-card (ADR 0002). Testar o id inteiro não funciona:
   * `select.suite_umidificador_da_suite_local_spraying_level` tem
   * "umidificador" no meio e casaria com qualquer regra genérica de umidade. */
  const ROLES = [
    // rótulos em CAIXA ALTA de propósito: é como a família desenha o texto de
    // controle, e é o que sai sem uma linha de configuração
    { re: /(spray|mist|nevoa|nebuliz|vapor|level|nivel)/, icon: "mdi:water", label: "NÍVEL" },
    { re: /(countdown|timer|temporiz|desliga)/, icon: "mdi:timer-outline", label: "TIMER" },
    { re: /(speed|velocid|fan)/, icon: "mdi:fan", label: "VELOCIDADE" },
    { re: /(mode|modo|preset)/, icon: "mdi:tune-variant", label: "MODO" },
    { re: /(light|luz|led|indicad)/, icon: "mdi:led-strip-variant", label: "LED" },
    { re: /(umidific|humidif|vaporiz|difusor)/, icon: "mdi:air-humidifier", label: "UMIDIFICADOR" },
  ];
  const tail = (id) => String(id || "").split(".")[1]?.split("_").slice(-3).join("_") || "";
  const roleOf = (id) => ROLES.find((r) => r.re.test(tail(id)))
    || { icon: "mdi:format-list-bulleted", label: "" };

  const isDead = (st) => !st || st.state === "unavailable" || st.state === "unknown";
  const OFF_OPTIONS = ["cancel", "off", "none", "desligado", "desligada", "nenhum", "0"];
  const isOffOption = (v) => OFF_OPTIONS.includes(String(v ?? "").toLowerCase());

  const SELECT_DOMAINS = ["select", "input_select"];
  const HUMID_RE = /umidific|humidif|vaporiz|difusor|diffuser/i;
  const LEVEL_RE = /(spray|mist|nevoa|nebuliz|vapor|level|nivel)/i;

  const CSS = `
:host{display:block;}
ha-card{background:none;border:none;box-shadow:none;padding:0;overflow:visible;}
/* line-height SEM unidade: o frontend do HA define
   --paper-font-body1_-_line-height em px no body e line-height é herdado —
   atravessa o shadow DOM e trava a altura das linhas de texto do card. */
.row{display:flex;align-items:center;gap:12px;box-sizing:border-box;
  height:var(--mw-h,48px);padding:0 14px;border-radius:var(--mw-r,14px);
  font-family:'Graphik',sans-serif;line-height:1.15;
  background:var(--mw-bg,transparent);border:1px solid var(--mw-border,transparent);
  box-shadow:var(--mw-shadow,none);color:var(--mw-fg,#fff);
  transition:background .26s ease,border-color .26s ease,box-shadow .26s ease,color .26s ease;}
.ico{flex:none;display:flex;align-items:center;justify-content:center;
  --mdc-icon-size:var(--mw-icon,22px);width:var(--mw-icon,22px);height:var(--mw-icon,22px);
  color:var(--mw-icon-color,inherit);filter:var(--mw-icon-filter,none);
  transition:color .26s ease;}
.nm{flex:1 1 auto;min-width:0;font-size:14px;font-weight:600;letter-spacing:.02em;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  text-decoration:var(--mw-strike,none);text-shadow:var(--mw-glow,none);}
/* margin-left:auto: escondendo o rótulo, o seletor continua encostado à
   direita em vez de escorregar para o começo da linha */
/* color própria (e não herdada da linha): com level_paint em "select" a cor
   do nível pousa aqui, e o texto de dentro precisa de contraste contra ELA,
   não contra o papel do card. Sem --mw-pill-fg, herda como sempre herdou.
   (Nada de crase dentro deste CSS: ele mora num template literal.) */
.pill{flex:none;margin-left:auto;position:relative;display:flex;align-items:center;
  border-radius:999px;background:var(--mw-pill,rgba(0,0,0,0.06));
  border:1px solid var(--mw-pill-border,rgba(0,0,0,0.16));
  box-shadow:var(--mw-pill-shadow,none);color:var(--mw-pill-fg,inherit);
  transition:background .26s ease,border-color .26s ease,color .26s ease;}
/* o <select> é nativo de propósito: o menu que abre é o do sistema — o mesmo
   que o usuário já conhece no celular — e vem com teclado e leitor de tela
   de graça. Só a aparência fechada é nossa. */
select{appearance:none;-webkit-appearance:none;background:none;border:none;
  font:inherit;font-size:13px;font-weight:600;color:inherit;
  padding:7px 30px 7px 14px;border-radius:999px;cursor:pointer;outline:none;
  max-width:var(--mw-pill-max,46vw);text-overflow:ellipsis;}
select:disabled{cursor:not-allowed;opacity:.55;}
select:focus-visible{box-shadow:0 0 0 2px var(--mw-focus,rgba(0,0,0,.35));}
.caret{position:absolute;right:11px;top:50%;width:9px;height:9px;
  pointer-events:none;transform:translateY(-65%) rotate(45deg);
  border-right:2px solid currentColor;border-bottom:2px solid currentColor;
  opacity:.65;border-radius:1px;}
@media (prefers-reduced-motion:reduce){.row,.ico,.pill{transition:none;}}`;

  let SHEET;
  const sharedSheet = () => {
    if (SHEET !== undefined) return SHEET;
    try {
      const s = new CSSStyleSheet();
      s.replaceSync(CSS);
      SHEET = s;
    } catch (e) { SHEET = null; }
    return SHEET;
  };

  class MwHumidifierLevelCard extends HTMLElement {
    static getConfigElement() {
      return document.createElement("mw-humidifier-level-card-editor");
    }

    // no modo «sections» o card já nasce ocupando a linha inteira, que é como
    // uma linha de controle se comporta bem
    getGridOptions() { return { rows: 1, columns: "full", min_rows: 1, min_columns: 6 }; }

    static getStubConfig(hass) {
      const states = hass?.states || {};
      const pick = Object.keys(states).find((e) =>
        SELECT_DOMAINS.includes(e.split(".")[0]) && HUMID_RE.test(e) && LEVEL_RE.test(tail(e)));
      return { entity: pick || Object.keys(states).find((e) => e.startsWith("select.")) || "" };
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._props = {};
      this._built = false;
    }

    setConfig(config) {
      if (!config || !config.entity) {
        throw new Error("mw-humidifier-level-card: defina 'entity' (um select do umidificador)");
      }
      const domain = String(config.entity).split(".")[0];
      if (!SELECT_DOMAINS.includes(domain)) {
        throw new Error("mw-humidifier-level-card: 'entity' precisa ser select ou input_select, não " + domain);
      }
      this._config = { ...DEFAULTS, ...config };
      this._props = {};
      this._st = undefined;
      this._optionsKey = null;
      this._update();
    }

    getCardSize() { return 1; }

    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      if (!this._config) return;
      const st = hass && hass.states[this._config.entity];
      // caminho rápido: o HA empurra `hass` a cada mudança de QUALQUER
      // entidade da casa; se o state object é o mesmo, não há nada a fazer
      if (!first && st === this._st) return;
      this._st = st;
      this._update();
    }

    get hass() { return this._hass; }

    _build() {
      const root = this.shadowRoot;
      const sheet = sharedSheet();
      if (sheet && "adoptedStyleSheets" in root) root.adoptedStyleSheets = [sheet];
      else {
        const st = document.createElement("style");
        st.textContent = CSS;
        root.appendChild(st);
      }
      const card = document.createElement("ha-card");
      const row = document.createElement("div");
      row.className = "row";
      this._ico = document.createElement("ha-icon");
      this._ico.className = "ico";
      this._nm = document.createElement("div");
      this._nm.className = "nm";
      const pill = document.createElement("div");
      pill.className = "pill";
      this._sel = document.createElement("select");
      const caret = document.createElement("div");
      caret.className = "caret";
      pill.append(this._sel, caret);
      row.append(this._ico, this._nm, pill);
      card.appendChild(row);
      root.appendChild(card);

      this._sel.addEventListener("change", () => {
        const value = this._sel.value;
        if (!this._hass || value === undefined) return;
        if (this._config.haptic !== false) haptic("selection");
        const [dom] = this._config.entity.split(".");
        this._hass.callService(dom, "select_option",
          { entity_id: this._config.entity, option: value });
      });
      // toque longo no rótulo abre os detalhes — o mesmo gesto do resto da família
      let timer = null;
      const clear = () => { clearTimeout(timer); timer = null; };
      row.addEventListener("pointerdown", (ev) => {
        if (ev.target === this._sel) return;
        timer = setTimeout(() => {
          clear();
          if (this._config.haptic !== false) haptic("medium");
          this.dispatchEvent(new CustomEvent("hass-more-info",
            { bubbles: true, composed: true, detail: { entityId: this._config.entity } }));
        }, 480);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach((t) =>
        row.addEventListener(t, clear));
      this._built = true;
    }

    // só escreve o que mudou — custom property que já vale não vira repaint
    _set(prop, val) {
      const v = val === null || val === undefined ? "" : String(val);
      if (this._props[prop] === v) return;
      this._props[prop] = v;
      if (v === "") this.style.removeProperty(prop);
      else this.style.setProperty(prop, v);
    }

    _label(option) {
      const map = this._config.option_labels;
      if (map && typeof map === "object" && map[option] !== undefined) return String(map[option]);
      return String(option);
    }

    _syncOptions(st, dead) {
      const options = (!dead && Array.isArray(st?.attributes?.options)) ? st.attributes.options : [];
      // reconstruir a lista a cada `hass` fecharia o menu nativo no dedo do
      // usuário — só se mexe quando as opções (ou os rótulos) mudam de fato
      const key = JSON.stringify([options, this._config.option_labels]);
      if (key !== this._optionsKey) {
        this._optionsKey = key;
        this._sel.innerHTML = "";
        if (!options.length) {
          const o = document.createElement("option");
          o.value = "";
          o.textContent = dead ? "—" : "";
          this._sel.appendChild(o);
        }
        options.forEach((opt) => {
          const o = document.createElement("option");
          o.value = opt;
          o.textContent = this._label(opt);
          this._sel.appendChild(o);
        });
      }
      const want = dead ? "" : String(st.state);
      if (this._sel.value !== want) this._sel.value = want;
      this._sel.disabled = dead || !options.length;
    }

    /* A cor do nível atual, em ordem de precedência:
     *   1) `level_colors` apontando a opção pelo nome (ou pelo índice, se for
     *      lista) — é a palavra final do dono, vale até na opção de desligado;
     *   2) a rampa do `level_scheme`, amostrada pela posição;
     *   3) nada — o card volta para o `paper_color` de sempre.
     * As opções de desligado (`cancel`, `off`…) ficam FORA da conta da rampa:
     * no countdown elas moram no fim da lista e puxariam a rampa inteira. */
    _levelColor(st) {
      const c = this._config;
      const state = String(st?.state ?? "");
      if (!state) return null;
      const map = c.level_colors;
      const options = Array.isArray(st?.attributes?.options) ? st.attributes.options : [];
      const live = options.filter((o) => !isOffOption(o));
      const i = live.indexOf(state);

      let raw = null;
      if (Array.isArray(map)) { if (i >= 0) raw = map[i]; }
      else if (map && typeof map === "object") raw = map[state];
      if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
        const explicit = levelBackground(raw);
        if (explicit) return { ...explicit, explicit: true };
      }

      const list = schemeColors(c.level_scheme);
      if (!list.length || i < 0) return null;
      const bg = levelBackground(rampAt(list, i, live.length));
      return bg && { ...bg, explicit: false };
    }

    _update() {
      const c = this._config;
      if (!c || !this._hass) return;
      if (!this._built) this._build();

      const st = this._st;
      const dead = isDead(st);
      const lvl = dead ? null : this._levelColor(st);
      // onde a cor do nível pousa: no papel do card, na pílula do seletor, ou
      // nos dois. Pintar só o seletor é o jeito discreto — a parede continua
      // de papel e só o controle muda de cor.
      const paint = ["card", "select", "both"].includes(c.level_paint) ? c.level_paint : "card";
      const paintsCard = paint !== "select";
      const paintsPill = paint !== "card";
      // uma cor escolhida a dedo para a opção de desligado é um pedido, não um
      // acidente: o card a mostra como papel, sem deixar de ser mode=off. Mas
      // só quando é o CARD que se pinta — acender o papel para pintar apenas a
      // pílula diria «ligado» com todas as letras, e não está.
      const on = !dead && (!isOffOption(st.state) || !!(paintsCard && lvl && lvl.explicit));
      const mode = dead ? "dead" : (!isOffOption(st?.state) ? "on" : "off");
      if (this.getAttribute("mode") !== mode) this.setAttribute("mode", mode);

      const cardLvl = (on && paintsCard) ? lvl : null;
      const paper = cardLvl ? cardLvl.bg : paperGradient(c.paper_color);
      const darkPaper = !!(cardLvl && cardLvl.dark);
      // no papel escuro o preto de sempre some; o creme da família toma o lugar
      const fgOn = c.color_on_name !== DEFAULTS.color_on_name ? c.color_on_name
        : (darkPaper ? "#fdfaf3" : DEFAULTS.color_on_name);
      const borderOn = c.color_on_border !== DEFAULTS.color_on_border ? c.color_on_border
        : (darkPaper ? "rgba(255, 255, 255, 0.20)" : DEFAULTS.color_on_border);
      this._set("--mw-h", `${Number(c.height) || 48}px`);
      this._set("--mw-r", `${Number(c.radius) || 14}px`);
      this._set("--mw-icon", `${Math.round((Number(c.height) || 48) * 0.46)}px`);

      if (dead) {
        this._set("--mw-bg", c.color_unavail_bg);
        this._set("--mw-border", c.color_unavail_border);
        this._set("--mw-shadow", "none");
        this._set("--mw-fg", c.color_dead);
        this._set("--mw-icon-color", c.color_dead);
        this._set("--mw-icon-filter",
          "drop-shadow(0 0 2px rgba(200,0,0,1.0)) drop-shadow(0 0 8px rgba(220,0,0,0.95)) drop-shadow(0 0 18px rgba(200,0,0,0.80))");
        this._set("--mw-strike", "line-through");
        this._set("--mw-glow",
          "0 0 2px rgba(200,0,0,1.0), 0 0 8px rgba(220,0,0,0.95), 0 0 18px rgba(200,0,0,0.80)");
        this._set("--mw-pill", "rgba(255,255,255,0.06)");
        this._set("--mw-pill-border", "rgba(255,255,255,0.12)");
        this._set("--mw-pill-shadow", "none");
        this._set("--mw-focus", "rgba(255,255,255,.5)");
      } else if (on) {
        this._set("--mw-bg", paper);
        this._set("--mw-border", borderOn);
        // o relevo de papel é luz vinda de cima à esquerda; num papel escuro a
        // luz creme vira mancha, então o realce interno encolhe junto
        this._set("--mw-shadow", darkPaper
          ? "0 2px 6px rgba(0,0,0,0.30),0 6px 16px rgba(0,0,0,0.20),inset 2px 2px 5px rgba(255,255,255,0.16),inset -2px -2px 5px rgba(0,0,0,0.30)"
          : "0 2px 6px rgba(0,0,0,0.18),0 6px 16px rgba(0,0,0,0.12),inset 2px 2px 5px rgba(255,252,240,0.85),inset -2px -2px 5px rgba(0,0,0,0.10)");
        this._set("--mw-fg", fgOn);
        this._set("--mw-icon-color", fgOn);
        this._set("--mw-icon-filter", darkPaper
          ? "drop-shadow(0 1px 2px rgba(0,0,0,0.55))"
          : "drop-shadow(1px 2px 2px rgba(0,0,0,0.45)) drop-shadow(3px 5px 7px rgba(0,0,0,0.22))");
        this._set("--mw-strike", "none");
        this._set("--mw-glow", "none");
        this._set("--mw-pill", darkPaper ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.055)");
        this._set("--mw-pill-border", darkPaper ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.16)");
        // pílula rebaixada no papel: o inverso do relevo do card
        this._set("--mw-pill-shadow", darkPaper
          ? "inset 1px 1px 3px rgba(0,0,0,0.45), inset -1px -1px 2px rgba(255,255,255,0.12)"
          : "inset 1px 1px 3px rgba(0,0,0,0.18), inset -1px -1px 2px rgba(255,255,255,0.75)");
        this._set("--mw-focus", darkPaper ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.35)");
      } else {
        this._set("--mw-bg", c.color_off_bg);
        this._set("--mw-border", c.color_off_border);
        this._set("--mw-shadow",
          "inset 2px 2px 5px rgba(0,0,0,0.35), inset -1px -1px 3px rgba(255,255,255,0.04)");
        this._set("--mw-fg", c.color_off_name);
        this._set("--mw-icon-color", c.color_off_name);
        this._set("--mw-icon-filter", "none");
        this._set("--mw-strike", "none");
        this._set("--mw-glow", "none");
        this._set("--mw-pill", "rgba(255,255,255,0.10)");
        this._set("--mw-pill-border", "rgba(255,255,255,0.14)");
        this._set("--mw-pill-shadow", "none");
        this._set("--mw-focus", "rgba(255,255,255,.5)");
      }

      /* A pílula pintada vem DEPOIS dos três estados, por cima: assim ela
       * funciona mesmo quando o card está no visual de desligado — que é o
       * caso interessante de `level_paint: select` num countdown. */
      const lit = !dead && !!lvl && (!isOffOption(st.state) || lvl.explicit);
      const pillLvl = (paintsPill && lit) ? lvl : null;
      if (pillLvl) {
        this._set("--mw-pill", pillLvl.bg);
        this._set("--mw-pill-fg", pillLvl.dark ? "#fdfaf3" : "#1a1a1a");
        this._set("--mw-pill-border", pillLvl.dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.20)");
        // pintada, a pílula ganha relevo próprio em vez do rebaixo de papel —
        // é ela que vira o objeto colorido da linha
        this._set("--mw-pill-shadow", pillLvl.dark
          ? "0 1px 3px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.14)"
          : "0 1px 3px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.65)");
        this._set("--mw-focus", pillLvl.dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.4)");
      } else {
        this._set("--mw-pill-fg", "");
      }

      const role = roleOf(c.entity);
      const icon = dead ? "mdi:cancel" : (c.icon || st?.attributes?.icon || role.icon);
      if (c.show_icon === false) this._ico.style.display = "none";
      else {
        this._ico.style.display = "";
        if (this._ico.getAttribute("icon") !== icon) this._ico.setAttribute("icon", icon);
      }

      // nome: o do YAML, senão o papel da entidade, senão o fim do friendly_name
      const name = c.name || role.label ||
        (st?.attributes?.friendly_name || c.entity).split(" ").slice(-1)[0];
      const shown = c.show_name === false ? "" : name;
      if (this._nm.textContent !== shown) this._nm.textContent = shown;
      this._nm.style.display = c.show_name === false ? "none" : "";

      this._syncOptions(st, dead);
      const title = c.name || st?.attributes?.friendly_name || c.entity;
      if (this.title !== title) this.title = title;
    }
  }

  /* ------------------------------- EDITOR ------------------------------- */

  const LABELS = {
    device: "Dispositivo (umidificador)",
    entity: "Entidade do seletor",
    name: "Rótulo (vazio = o papel da entidade)",
    icon: "Ícone (vazio = o do papel)",
    show_icon: "Mostrar o ícone",
    show_name: "Mostrar o rótulo",
    haptic: "Vibrar ao escolher",
    height: "Altura da linha",
    radius: "Arredondamento",
    paper_color: "Cor do papel (ligado)",
    level_scheme: "Esquema de cores por nível",
    level_paint: "Onde a cor do nível pousa",
    option_labels: "Renomear as opções ({ \"LEVEL 1\": \"Baixo\" })",
    color_on_name: "Ligado: texto e ícone",
    color_on_border: "Ligado: borda",
    color_off_bg: "Desligado: fundo",
    color_off_border: "Desligado: borda",
    color_off_name: "Desligado: texto",
    color_unavail_bg: "Sem resposta: fundo",
    color_unavail_border: "Sem resposta: borda",
    color_dead: "Sem resposta: texto e ícone",
  };

  const COLOR_FIELDS = [
    "color_on_name", "color_on_border", "color_off_bg", "color_off_border",
    "color_off_name", "color_unavail_bg", "color_unavail_border", "color_dead",
  ];

  const ALL = "__all__";
  const deviceOf = (hass, id) => hass?.entities?.[id]?.device_id || "";
  const entitiesOfDevice = (hass, devId) => (devId && hass?.entities
    ? Object.keys(hass.entities).filter((id) => hass.entities[id].device_id === devId)
    : []);

  /* Dispositivos candidatos, em cascata — nunca devolve lista vazia:
   *   1) os que casam com "umidific/humidif/vaporiz/difusor" e têm select
   *   2) qualquer dispositivo com pelo menos um select
   * Mais «— todos —», para quem não quiser filtro nenhum. */
  const humidifierDevices = (hass, keep) => {
    if (!hass?.devices || !hass?.entities) return [];
    const byDev = {};
    for (const [id, meta] of Object.entries(hass.entities)) {
      if (!meta.device_id || !SELECT_DOMAINS.includes(id.split(".")[0])) continue;
      (byDev[meta.device_id] = byDev[meta.device_id] || []).push(id);
    }
    const label = (d) => hass.devices[d]?.name_by_user || hass.devices[d]?.name || d;
    let list = Object.keys(byDev).filter((d) =>
      HUMID_RE.test(label(d)) || byDev[d].some((id) => HUMID_RE.test(id)));
    if (!list.length) list = Object.keys(byDev);
    if (keep && keep !== ALL && !list.includes(keep) && hass.devices[keep]) list = list.concat([keep]);
    return [{ value: ALL, label: "— todos os dispositivos —" }].concat(
      list.map((d) => ({ value: d, label: label(d) }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")));
  };

  /* Seletores candidatos, em cascata:
   *   1) os do dispositivo escolhido
   *   2) os que parecem de nível/névoa em qualquer umidificador
   *   3) todos os selects da casa */
  const selectOptionsFor = (hass, devId) => {
    if (!hass?.states) return [];
    const all = Object.keys(hass.states).filter((id) => SELECT_DOMAINS.includes(id.split(".")[0]));
    const label = (id) => ({ value: id, label: hass.states[id]?.attributes?.friendly_name || id });
    if (devId && devId !== ALL) {
      const own = entitiesOfDevice(hass, devId).filter((id) => hass.states[id] && SELECT_DOMAINS.includes(id.split(".")[0]));
      if (own.length) return own.map(label);
    }
    const nice = all.filter((id) => HUMID_RE.test(id) && LEVEL_RE.test(tail(id)));
    return (nice.length ? nice : all).map(label);
  };

  // ao escolher o dispositivo, já aponta para o seletor de nível dele
  const levelOf = (hass, devId) => {
    const own = entitiesOfDevice(hass, devId)
      .filter((id) => SELECT_DOMAINS.includes(id.split(".")[0]) && hass.states[id]);
    return own.find((id) => LEVEL_RE.test(tail(id))) || own[0] || "";
  };

  class MwHumidifierLevelCardEditor extends HTMLElement {
    setConfig(config) { this._config = { ...config }; this._renderForm(); }
    set hass(hass) {
      this._hass = hass;
      // o filtro dos selects depende do hass: sem reconstruir o esquema aqui,
      // um hass que chegue depois do setConfig deixaria a lista sem filtro
      if (this._form) { this._form.hass = hass; this._form.schema = this._schema(); }
      // as opções da entidade só existem quando o hass chega — e ele chega
      // depois do setConfig; a key interna evita redesenhar à toa
      if (this._levelsEl) this._renderLevels();
    }

    _schema() {
      const cfg = { ...DEFAULTS, ...(this._config || {}) };
      const hass = this._hass;
      const sel = (options) => ({ select: { mode: "dropdown", options } });
      const num = (min, max, unit) => ({ number: { min, max, step: 1, mode: "box", unit_of_measurement: unit } });
      if (!hass) return [{ name: "entity", required: true, selector: { entity: { domain: SELECT_DOMAINS } } }];
      const devices = humidifierDevices(hass, cfg.device);
      const entities = selectOptionsFor(hass, cfg.device);
      return [
        ...(devices.length > 1 ? [{ name: "device", selector: sel(devices) }] : []),
        {
          name: "entity", required: true,
          selector: entities.length ? sel(entities) : { entity: { domain: SELECT_DOMAINS } },
        },
        { name: "name", selector: { text: {} } },
        { name: "icon", selector: { icon: {} } },
        {
          name: "", type: "expandable", title: "Aparência", schema: [
            { name: "paper_color", selector: sel(paperOptions()) },
            { name: "height", selector: num(28, 96, "px") },
            { name: "radius", selector: num(0, 40, "px") },
            { name: "show_icon", selector: { boolean: {} } },
            { name: "show_name", selector: { boolean: {} } },
            { name: "haptic", selector: { boolean: {} } },
          ],
        },
        {
          name: "", type: "expandable", title: "Cor por nível", schema: [
            { name: "level_scheme", selector: sel(schemeOptions()) },
            { name: "level_paint", selector: sel(PAINT_OPTIONS) },
          ],
        },
        {
          name: "", type: "expandable", title: "Renomear as opções", schema: [
            { name: "option_labels", selector: { object: {} } },
          ],
        },
      ];
    }

    _renderForm() {
      if (!this._form) {
        this._form = document.createElement("ha-form");
        this._form.computeLabel = (f) => LABELS[f.name] || f.name;
        this._form.addEventListener("value-changed", (ev) => this._onChange(ev));
        this.appendChild(this._form);
      }
      this._form.hass = this._hass;
      this._form.schema = this._schema();
      const data = { ...DEFAULTS, ...this._config };
      for (const k of Object.keys(data)) if (data[k] === "" || data[k] === null) delete data[k];
      this._form.data = data;
      this._renderLevels();
      this._renderColors();
    }

    // rótulo mostrado ao lado de cada opção — o mesmo que o card desenha
    _optionLabel(opt) {
      const map = this._config?.option_labels;
      return (map && typeof map === "object" && map[opt] !== undefined) ? String(map[opt]) : String(opt);
    }

    _levelOptions() {
      const st = this._hass?.states?.[this._config?.entity];
      return Array.isArray(st?.attributes?.options) ? st.attributes.options : [];
    }

    /* Uma linha por opção da entidade: escolher um papel da paleta, uma cor
     * livre, ou deixar por conta do esquema. É o «configurar outras cores»
     * sem precisar escrever o mapa `level_colors` à mão no YAML. */
    _renderLevels() {
      if (!this._levelsEl) {
        this._levelsEl = document.createElement("details");
        this._levelsEl.style.cssText =
          "margin-top:16px;border:1px solid var(--divider-color);border-radius:8px;padding:8px 12px;";
        this.appendChild(this._levelsEl);
      }
      const options = this._levelOptions();
      const map = (this._config.level_colors && typeof this._config.level_colors === "object"
        && !Array.isArray(this._config.level_colors)) ? this._config.level_colors : {};
      // o HA empurra `hass` a cada mudança de qualquer entidade da casa:
      // redesenhar sempre roubaria o foco do seletor aberto no editor
      const key = JSON.stringify([this._config.entity, options, map,
        this._config.level_scheme, this._config.option_labels]);
      if (key === this._levelsKey) return;
      this._levelsKey = key;

      const FREE = "__free__";
      const list = schemeColors(this._config.level_scheme);
      const live = options.filter((o) => !isOffOption(o));
      const paperItems = paperOptions();
      const rows = options.map((opt) => {
        const cur = map[opt];
        const i = live.indexOf(opt);
        const fromScheme = (list.length && i >= 0) ? rampAt(list, i, live.length) : null;
        const eff = levelBackground(cur || fromScheme);
        const isPaper = isPaperKey(cur);
        const picked = cur === undefined || cur === "" ? "" : (isPaper ? String(cur).trim() : FREE);
        const swatch = eff ? eff.bg : PAPER_DEFAULT;
        const opts = [`<option value=""${picked === "" ? " selected" : ""}>— do esquema —</option>`]
          .concat(paperItems.map((p) =>
            `<option value="${esc(p.value)}"${picked === p.value ? " selected" : ""}>${esc(p.label)}</option>`))
          .concat([`<option value="${FREE}"${picked === FREE ? " selected" : ""}>Cor livre (a do quadradinho)</option>`])
          .join("");
        return `<div class="mhl-lrow" data-opt="${esc(opt)}">
          <span class="lbl">${esc(this._optionLabel(opt))}${isOffOption(opt) ? " <em>(desligado)</em>" : ""}</span>
          <span class="sw" style="background:${esc(swatch)}"></span>
          <select>${opts}</select>
          <input type="color" value="${toHex(parseColorOr(isPaper || !cur ? "#7fc7d9" : cur))}" title="cor livre">
          <code>${esc(cur || (fromScheme ? fromScheme + " (esquema)" : "—"))}</code>
        </div>`;
      }).join("");

      this._levelsEl.innerHTML = `
        <summary style="cursor:pointer;font-weight:500;">Cor de cada opção (vence o esquema)</summary>
        <style>
          .mhl-lrow{display:grid;grid-template-columns:1fr 26px minmax(150px,1.2fr) 44px minmax(90px,.8fr);
            gap:10px;align-items:center;padding:6px 0;}
          .mhl-lrow .lbl{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
          .mhl-lrow .lbl em{opacity:.5;font-size:11px;}
          .mhl-lrow .sw{width:26px;height:22px;border-radius:5px;border:1px solid var(--divider-color);}
          .mhl-lrow input[type=color]{width:40px;height:28px;border:none;background:none;cursor:pointer;padding:0;}
          .mhl-lrow code{font-size:11px;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
          .mhl-hint{font-size:12px;opacity:.65;padding:6px 0;}
        </style>
        ${options.length ? rows
          : `<div class="mhl-hint">Escolha primeiro uma entidade com opções — elas aparecem aqui uma a uma.</div>`}`;

      this._levelsEl.querySelectorAll(".mhl-lrow").forEach((rowEl) => {
        const opt = rowEl.dataset.opt;
        const write = (value) => {
          const clean = { ...this._config };
          const next = { ...map };
          if (!value) delete next[opt]; else next[opt] = value;
          if (Object.keys(next).length) clean.level_colors = next; else delete clean.level_colors;
          this._config = clean;
          this.dispatchEvent(new CustomEvent("config-changed",
            { bubbles: true, composed: true, detail: { config: clean } }));
          this._renderForm();
        };
        rowEl.querySelector("select").addEventListener("change", (ev) => {
          const v = ev.target.value;
          write(v === FREE ? rowEl.querySelector("input[type=color]").value : v);
        });
        rowEl.querySelector("input[type=color]").addEventListener("change", (ev) => write(ev.target.value));
      });
    }

    _renderColors() {
      if (!this._colorsEl) {
        this._colorsEl = document.createElement("details");
        this._colorsEl.style.cssText =
          "margin-top:16px;border:1px solid var(--divider-color);border-radius:8px;padding:8px 12px;";
        this.appendChild(this._colorsEl);
      }
      const rows = COLOR_FIELDS.map((name) => {
        const cur = this._config[name] ?? DEFAULTS[name] ?? "";
        const c = parseColorOr(cur);
        return `<div class="mhl-crow" data-name="${name}">
          <span class="lbl">${LABELS[name] || name}</span>
          <input type="color" value="${toHex(c)}" title="cor">
          <input type="range" min="0" max="1" step="0.01" value="${c.a}" title="transparência (alfa)">
          <code>${esc(cur) || "—"}</code>
        </div>`;
      }).join("");
      this._colorsEl.innerHTML = `
        <summary style="cursor:pointer;font-weight:500;">Cores (cor + transparência)</summary>
        <style>
          .mhl-crow{display:grid;grid-template-columns:1fr 44px 110px minmax(120px,1fr);gap:10px;
            align-items:center;padding:6px 0;}
          .mhl-crow .lbl{font-size:13px;}
          .mhl-crow input[type=color]{width:40px;height:28px;border:none;background:none;cursor:pointer;padding:0;}
          .mhl-crow code{font-size:11px;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        </style>${rows}`;
      this._colorsEl.querySelectorAll(".mhl-crow").forEach((rowEl) => {
        const name = rowEl.dataset.name;
        const apply = () => {
          const hex = rowEl.querySelector("input[type=color]").value;
          const a = parseFloat(rowEl.querySelector("input[type=range]").value);
          const { r, g, b } = parseColorOr(hex);
          const value = a >= 1 ? hex : toRgba({ r, g, b, a });
          const clean = { ...this._config };
          if (value === DEFAULTS[name]) delete clean[name]; else clean[name] = value;
          this._config = clean;
          rowEl.querySelector("code").textContent = clean[name] || "—";
          this.dispatchEvent(new CustomEvent("config-changed",
            { bubbles: true, composed: true, detail: { config: clean } }));
        };
        rowEl.querySelector("input[type=color]").addEventListener("input", apply);
        rowEl.querySelector("input[type=range]").addEventListener("input", apply);
      });
    }

    _onChange(ev) {
      ev.stopPropagation();
      const v = { ...ev.detail.value };
      const clean = {};
      for (const [k, val] of Object.entries(v)) {
        if (val === undefined || val === null || val === "") continue;
        if (k === "entity" || k === "device" || val !== DEFAULTS[k]) clean[k] = val;
      }
      // trocar de dispositivo invalida a entidade do antigo — e já traz a do novo
      if (clean.device && clean.device !== this._config.device && clean.device !== ALL) {
        if (!clean.entity || deviceOf(this._hass, clean.entity) !== clean.device) {
          const next = levelOf(this._hass, clean.device);
          if (next) clean.entity = next; else delete clean.entity;
        }
      }
      // campo que o esquema escondeu não vem no evento — sem isto sumiria do YAML
      for (const [k, val] of Object.entries(this._config)) {
        if (!(k in v) && !COLOR_FIELDS.includes(k) && clean[k] === undefined) clean[k] = val;
      }
      for (const k of COLOR_FIELDS) {
        if (this._config[k] !== undefined) clean[k] = this._config[k];
      }
      this._config = clean;
      this.dispatchEvent(new CustomEvent("config-changed",
        { bubbles: true, composed: true, detail: { config: clean } }));
      this._renderForm();
    }
  }

  if (!customElements.get("mw-humidifier-level-card")) {
    customElements.define("mw-humidifier-level-card", MwHumidifierLevelCard);
  }
  if (!customElements.get("mw-humidifier-level-card-editor")) {
    customElements.define("mw-humidifier-level-card-editor", MwHumidifierLevelCardEditor);
  }

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "mw-humidifier-level-card",
    name: "MW Humidifier Level Card",
    description: "Uma linha de papel com o seletor de nível de névoa do umidificador (ou qualquer outro select dele).",
    preview: true,
    documentationURL: "https://github.com/visaodeempresa/mw-ha-humidifier-level-card",
  });

  console.info(`%c MW-HUMIDIFIER-LEVEL-CARD %c ${VERSION} `,
    "background:#1a1a1a;color:#fdfaf3;font-weight:700;",
    "background:#7fc7d9;color:#1a1a1a;font-weight:700;");
})();
