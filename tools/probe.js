/* Probe headless — instancia o card e o editor fora do navegador.
 * Roda no CI e antes de qualquer PR:  node tools/probe.js
 *
 * Entidades reais da casa (os quatro umidificadores Tuya locais). Probe com
 * dado de mentira não pega regra que só quebra com o nome de verdade.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const listeners = new Map();
class Node {
  constructor(tag) {
    this.tagName = String(tag || "div").toUpperCase();
    this.children = [];
    this.attrs = {};
    this._text = "";
    this.style = {
      _p: {},
      setProperty(k, v) { this._p[k] = String(v); },
      removeProperty(k) { delete this._p[k]; },
      getPropertyValue(k) { return this._p[k] || ""; },
      set cssText(v) { this._css = v; },
      get cssText() { return this._css || ""; },
    };
  }
  appendChild(n) { this.children.push(n); n.parent = this; return n; }
  append(...n) { n.forEach((x) => this.appendChild(x)); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, fn) {
    const m = listeners.get(this) || {};
    (m[t] = m[t] || []).push(fn);
    listeners.set(this, m);
  }
  dispatchEvent(ev) { (listeners.get(this)?.[ev.type] || []).forEach((f) => f(ev)); return true; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  get innerHTML() { return this._html || ""; }
  set innerHTML(v) { this._html = v; if (v === "") this.children = []; }
}
global.HTMLElement = class extends Node {
  constructor() { super("div"); }
  attachShadow() { this.shadowRoot = new Node("shadow"); return this.shadowRoot; }
};
const reg = {};
global.customElements = { define: (n, c) => { reg[n] = c; }, get: (n) => reg[n] };
global.document = { createElement: (t) => (reg[t] ? new reg[t]() : new Node(t)) };
global.window = { addEventListener() {}, dispatchEvent() {} };
global.CustomEvent = class { constructor(t, d) { this.type = t; Object.assign(this, d); } };
global.CSSStyleSheet = function () { throw new Error("sem adoptedStyleSheets no Node"); };
console.info = () => {};

const SRC = path.join(__dirname, "..", "dist", "mw-humidifier-level-card.js");
const SOURCE = fs.readFileSync(SRC, "utf8");
eval(SOURCE);

const S = (state, attributes = {}) => ({ state, attributes });
const LEVELS = ["LEVEL 1", "LEVEL 2", "LEVEL 3"];
const COUNTDOWN = ["1 Hour", "2 Hours", "3 Hours", "cancel"];
const states = {
  "select.escritorio_umidificador_escritorio_local_spraying_level":
    S("LEVEL 3", { options: LEVELS, friendly_name: "⬛️🔌💧 UMIDIFICADOR ESCRITÓRIO (LOCAL) Spraying level" }),
  "select.escritorio_umidificador_escritorio_local_countdown":
    S("cancel", { options: COUNTDOWN, friendly_name: "⬛️🔌💧 UMIDIFICADOR ESCRITÓRIO (LOCAL) Countdown" }),
  "select.suite_umidificador_da_suite_local_spraying_level":
    S("LEVEL 1", { options: LEVELS, friendly_name: "🟪💧 UMIDIFICADOR DA SUÍTE (LOCAL) Spraying level" }),
  "select.umidificador_da_sala_spraying_level":
    S("unavailable", { friendly_name: "🟧💧 UMIDIFICADOR DA SALA (LOCAL) Spraying level" }),
  "select.zigbee2mqtt_bridge_log_level":
    S("warning", { options: ["error", "warning", "info"], friendly_name: "Zigbee2MQTT log level" }),
  "switch.escritorio_umidificador_escritorio_local_led": S("on", { friendly_name: "LED" }),
};
const calls = [];
const hass = {
  states,
  entities: {
    "select.escritorio_umidificador_escritorio_local_spraying_level": { device_id: "esc" },
    "select.escritorio_umidificador_escritorio_local_countdown": { device_id: "esc" },
    "switch.escritorio_umidificador_escritorio_local_led": { device_id: "esc" },
    "select.suite_umidificador_da_suite_local_spraying_level": { device_id: "sui" },
    "select.umidificador_da_sala_spraying_level": { device_id: "sal" },
    "select.zigbee2mqtt_bridge_log_level": { device_id: "z2m" },
  },
  devices: {
    esc: { name: "UMIDIFICADOR ESCRITÓRIO" },
    sui: { name: "UMIDIFICADOR DA SUÍTE" },
    sal: { name: "UMIDIFICADOR DA SALA" },
    z2m: { name: "Zigbee2MQTT Bridge" },
  },
  callService(...a) { calls.push(a); },
};

let fails = 0;
const check = (label, cond, extra = "") => {
  if (cond) { console.log(`  ok   ${label}`); return; }
  fails += 1;
  console.log(`  FAIL ${label}${extra ? " — " + extra : ""}`);
};
const mk = (cfg, over) => {
  const el = new reg["mw-humidifier-level-card"]();
  el.setConfig(cfg);
  el.hass = over ? { ...hass, states: { ...states, ...over } } : hass;
  return el;
};
const prop = (el, p) => el.style.getPropertyValue(p);
const opts = (el) => el._sel.children.map((o) => ({ v: o.value, t: o.textContent }));

const ESC = "select.escritorio_umidificador_escritorio_local_spraying_level";

console.log("o mínimo — só apontar a entidade:");
const a = mk({ entity: ESC });
check("rótulo deduzido do fim do entity_id", a._nm.textContent === "NÍVEL", a._nm.textContent);
check("ícone deduzido do papel", a._ico.getAttribute("icon") === "mdi:water");
check("as opções vêm da entidade", opts(a).map((o) => o.v).join("|") === LEVELS.join("|"));
check("o valor atual fica selecionado", a._sel.value === "LEVEL 3");
check("seletor habilitado", a._sel.disabled === false);
check("papel creme no estado ligado", prop(a, "--mw-bg") === "linear-gradient(145deg, #fdfaf3, #e8e3d8)");
check("modo=on", a.getAttribute("mode") === "on");

console.log("os quatro estados:");
const off = mk({ entity: "select.escritorio_umidificador_escritorio_local_countdown" });
check("opção de desligado (cancel) conta como desligado", off.getAttribute("mode") === "off");
check("desligado usa o fundo escuro", prop(off, "--mw-bg") === "rgba(0, 0, 0, 0.45)");
check("mesmo desligado o seletor continua utilizável", off._sel.disabled === false);

const dead = mk({ entity: "select.umidificador_da_sala_spraying_level" });
check("sem resposta marca mode=dead", dead.getAttribute("mode") === "dead");
check("sem resposta vira mdi:cancel", dead._ico.getAttribute("icon") === "mdi:cancel");
check("sem resposta fica âmbar", prop(dead, "--mw-fg") === "#f5c518");
check("sem resposta risca o rótulo", prop(dead, "--mw-strike") === "line-through");
check("sem resposta desabilita o seletor", dead._sel.disabled === true);
check("sem resposta mostra travessão no lugar das opções",
  opts(dead).length === 1 && opts(dead)[0].t === "—");

const gone = mk({ entity: "select.nao_existe" });
check("entidade inexistente é 'sem resposta', não erro de render",
  gone.getAttribute("mode") === "dead");

console.log("interação:");
calls.length = 0;
a._sel.value = "LEVEL 2";
a._sel.dispatchEvent({ type: "change" });
check("escolher uma opção chama select.select_option",
  calls[0]?.[0] === "select" && calls[0]?.[1] === "select_option" &&
  calls[0]?.[2]?.option === "LEVEL 2", JSON.stringify(calls[0]));

console.log("não reconstruir o <select> à toa:");
const live = mk({ entity: ESC });
const antes = live._sel.children;
live.hass = { ...hass, states: { ...states, [ESC]: S("LEVEL 1", { options: LEVELS }) } };
check("mudar só o valor NÃO recria as opções (o menu nativo não fecha no dedo)",
  live._sel.children === antes && live._sel.value === "LEVEL 1");
live.hass = { ...hass, states: { ...states, [ESC]: S("LEVEL 1", { options: ["A", "B"] }) } };
check("mudar as opções recria a lista", live._sel.children !== antes &&
  opts(live).map((o) => o.v).join("|") === "A|B");

console.log("rótulos das opções:");
const pt = mk({ entity: ESC, option_labels: { "LEVEL 1": "Baixo", "LEVEL 2": "Médio", "LEVEL 3": "Alto" } });
check("option_labels renomeia o que aparece",
  opts(pt).map((o) => o.t).join("|") === "Baixo|Médio|Alto");
check("option_labels não mexe no valor enviado ao HA",
  opts(pt).map((o) => o.v).join("|") === LEVELS.join("|"));

console.log("cor por nível:");
const atLevel = (lvl, cfg) => mk({ entity: ESC, ...cfg },
  { [ESC]: S(lvl, { options: LEVELS, friendly_name: "Spraying level" }) });
const bgAt = (lvl, cfg) => prop(atLevel(lvl, cfg), "--mw-bg");

// primeiro stop do gradiente derivado, em números — dá para comparar cor
const rgbAt = (lvl, cfg) => {
  const m = /rgba\((\d+), (\d+), (\d+)/.exec(bgAt(lvl, cfg));
  return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
};
const agua = LEVELS.map((l) => bgAt(l, { level_scheme: "agua" }));
check("cada nível ganha um azul diferente com o esquema 'agua'",
  new Set(agua).size === 3 &&
  LEVELS.every((l) => { const c = rgbAt(l, { level_scheme: "agua" }); return c && c.b > c.r; }),
  JSON.stringify(agua));
check("a rampa vai do claro ao fundo, sem passar por um meio mais claro que a ponta",
  (() => {
    const l = LEVELS.map((x) => rgbAt(x, { level_scheme: "agua" }).r);
    return l[0] > l[1] && l[1] > l[2];
  })());
check("a diferença entre níveis vizinhos é visível, não um sussurro",
  (() => {
    const c = LEVELS.map((x) => rgbAt(x, { level_scheme: "agua" }));
    return Math.abs(c[0].r - c[1].r) > 24 && Math.abs(c[1].b - c[2].b) > 24;
  })(), JSON.stringify(LEVELS.map((x) => rgbAt(x, { level_scheme: "agua" }))));
check("sem esquema, o papel continua o de sempre (nada muda para quem já usa)",
  bgAt("LEVEL 1") === bgAt("LEVEL 3") &&
  bgAt("LEVEL 3") === "linear-gradient(145deg, #fdfaf3, #e8e3d8)");
check("esquema de matizes diferentes (semáforo) troca a cor, não só o tom",
  (() => {
    const lo = rgbAt("LEVEL 1", { level_scheme: "semaforo" });
    const hi = rgbAt("LEVEL 3", { level_scheme: "semaforo" });
    return lo.g > lo.r && hi.r > hi.g;
  })(), JSON.stringify([rgbAt("LEVEL 1", { level_scheme: "semaforo" }), rgbAt("LEVEL 3", { level_scheme: "semaforo" })]));
check("os esquemas de sussurro continuam saindo da paleta de papel",
  bgAt("LEVEL 3", { level_scheme: "nevoa" }).includes("hsl(203"),
  bgAt("LEVEL 3", { level_scheme: "nevoa" }));
check("esquema desconhecido não quebra — cai na cor única",
  bgAt("LEVEL 2", { level_scheme: "nao-existe" }) === "linear-gradient(145deg, #fdfaf3, #e8e3d8)");

const fixa = { level_scheme: "agua", level_colors: { "LEVEL 2": "red-5" } };
check("cor escolhida a dedo vence o esquema", bgAt("LEVEL 2", fixa).includes("hsl(6"));
check("as outras opções continuam no esquema",
  bgAt("LEVEL 1", fixa) === bgAt("LEVEL 1", { level_scheme: "agua" }));
check("cor livre em hex vira papel com relevo (gradiente derivado)",
  /^linear-gradient\(145deg, rgba\(/.test(bgAt("LEVEL 1", { level_colors: { "LEVEL 1": "#2b6cb0" } })),
  bgAt("LEVEL 1", { level_colors: { "LEVEL 1": "#2b6cb0" } }));
check("gradiente inteiro escrito no YAML passa cru",
  bgAt("LEVEL 1", { level_colors: { "LEVEL 1": "linear-gradient(90deg, #000, #fff)" } })
    === "linear-gradient(90deg, #000, #fff)");
check("nome de cor do CSS é usado como veio",
  bgAt("LEVEL 1", { level_colors: { "LEVEL 1": "tomato" } }) === "tomato");
check("lista por posição também vale (level_colors como array)",
  bgAt("LEVEL 3", { level_colors: ["red-2", "red-4", "red-6"] })
    === bgAt("LEVEL 3", { level_colors: { "LEVEL 3": "red-6" } }),
  bgAt("LEVEL 3", { level_colors: ["red-2", "red-4", "red-6"] }));

const escuro = atLevel("LEVEL 1", { level_colors: { "LEVEL 1": "#12203a" } });
check("papel escuro acende o texto em creme (senão o preto sumiria)",
  prop(escuro, "--mw-fg") === "#fdfaf3" && prop(escuro, "--mw-icon-color") === "#fdfaf3");
check("papel escuro troca o relevo: o realce interno branco vira sutil",
  prop(escuro, "--mw-shadow").includes("rgba(255,255,255,0.16)"));
const claro = atLevel("LEVEL 1", { level_colors: { "LEVEL 1": "#ffe08a" } });
check("papel claro mantém o preto de sempre", prop(claro, "--mw-fg") === "#1a1a1a");
check("cor de texto escrita pelo dono vence o contraste automático",
  prop(atLevel("LEVEL 1", { level_colors: { "LEVEL 1": "#12203a" }, color_on_name: "#00ff00" }),
    "--mw-fg") === "#00ff00");

const CD = "select.escritorio_umidificador_escritorio_local_countdown";
const cd = (state, cfg) => mk({ entity: CD, ...cfg },
  { [CD]: S(state, { options: COUNTDOWN, friendly_name: "Countdown" }) });
check("a opção de desligado fica fora da rampa (3 Hours é o fim, não o meio)",
  prop(cd("3 Hours", { level_scheme: "agua" }), "--mw-bg") ===
  prop(atLevel("LEVEL 3", { level_scheme: "agua" }), "--mw-bg"));
check("com esquema, 'cancel' continua sendo o desligado escuro",
  prop(cd("cancel", { level_scheme: "agua" }), "--mw-bg") === "rgba(0, 0, 0, 0.45)" &&
  cd("cancel", { level_scheme: "agua" }).getAttribute("mode") === "off");
const cdPinta = cd("cancel", { level_colors: { cancel: "green-3" } });
check("mas uma cor escolhida a dedo pinta até o desligado",
  prop(cdPinta, "--mw-bg").includes("hsl(96"));
check("…sem mentir sobre o estado: continua mode=off",
  cdPinta.getAttribute("mode") === "off");
check("sem resposta ignora a cor do nível",
  prop(mk({ entity: "select.umidificador_da_sala_spraying_level", level_scheme: "agua" }), "--mw-bg")
    === "rgba(80, 0, 0, 0.6)");

console.log("aparência e configuração:");
const custom = mk({ entity: ESC, name: "NÍVEL", icon: "mdi:spray", paper_color: "blue-3", height: 56 });
check("nome do YAML vence", custom._nm.textContent === "NÍVEL");
check("ícone do YAML vence", custom._ico.getAttribute("icon") === "mdi:spray");
check("papel colorido aplicado", prop(custom, "--mw-bg").includes("hsl(203"));
check("altura configurável", prop(custom, "--mw-h") === "56px");
check("ícone acompanha a altura da linha", prop(custom, "--mw-icon") === "26px");

const nudo = mk({ entity: ESC, show_icon: false, show_name: false });
check("dá para esconder ícone e rótulo",
  nudo._ico.style.display === "none" && nudo._nm.style.display === "none");

const throws = (cfg) => { try { new reg["mw-humidifier-level-card"]().setConfig(cfg); return false; } catch (e) { return true; } };
check("setConfig sem entity falha", throws({}));
check("setConfig com entidade que não é select falha",
  throws({ entity: "switch.escritorio_umidificador_escritorio_local_led" }));

console.log("as lições da família (regressão):");
check("line-height SEM unidade — o HA herda um valor absoluto para dentro",
  /line-height:1\.15/.test(SOURCE) && !/line-height:\s*[\d.]+px/.test(SOURCE.replace(/\/\*[\s\S]*?\*\//g, "")));
check("o card é bloco (num pai flex não encolhe para o conteúdo)",
  /:host\{display:block/.test(SOURCE));
check("DOM montado uma vez (sem innerHTML no caminho de atualização)",
  !/_update\(\)[\s\S]{0,2000}shadowRoot\.innerHTML/.test(SOURCE));
check("hass de outra entidade sai em O(1)", (() => {
  const el = mk({ entity: ESC });
  let n = 0;
  el._update = () => { n += 1; };
  el.hass = { ...hass };           // mesmo state object
  return n === 0;
})());
check("paleta de papel embutida entre marcadores (check-embeds.sh)",
  SOURCE.includes(">>> paper-palette v1") && SOURCE.includes("<<< paper-palette v1"));
check("getGridOptions pede a linha inteira no modo sections",
  JSON.stringify(new reg["mw-humidifier-level-card"]().getGridOptions()).includes('"columns":"full"'));

console.log("editor:");
const flatten = (l, out = []) => {
  l.forEach((f) => (f.schema ? flatten(f.schema, out) : out.push(f)));
  return out;
};
const ed = new reg["mw-humidifier-level-card-editor"]();
ed.hass = hass;
ed.setConfig({ entity: ESC, device: "esc" });
const schema = ed._schema();
const flat = flatten(schema);
const byName = (n) => flat.find((f) => f.name === n);
check("select de dispositivo", !!byName("device"));
check("dispositivos filtrados por umidificador (3 + todos)",
  byName("device").selector.select.options.length === 4,
  JSON.stringify(byName("device").selector.select.options.map((o) => o.label)));
check("entidades filtradas pelo dispositivo escolhido",
  byName("entity").selector.select.options.length === 2,
  JSON.stringify(byName("entity").selector.select.options.map((o) => o.value)));
check("seções expansíveis (aparência, cor por nível, rótulos)",
  schema.filter((f) => f.type === "expandable").length === 3);
check("esquema de cores por nível no editor, com a opção de cor única",
  byName("level_scheme")?.selector.select.options[0].value === "none" &&
  byName("level_scheme").selector.select.options.length >= 8,
  JSON.stringify(byName("level_scheme")?.selector.select.options.map((o) => o.value)));

const edLvl = new reg["mw-humidifier-level-card-editor"]();
edLvl.hass = hass;
edLvl.setConfig({ entity: ESC, level_scheme: "agua" });
check("o painel de cor por opção abre uma linha por opção da entidade",
  (edLvl._levelsEl.innerHTML.match(/class="mhl-lrow"/g) || []).length === LEVELS.length,
  edLvl._levelsEl.innerHTML.slice(0, 120));
check("o painel mostra de onde veio a cor de cada opção",
  edLvl._levelsEl.innerHTML.includes("(esquema)"));

const edAll = new reg["mw-humidifier-level-card-editor"]();
edAll.hass = hass;
edAll.setConfig({ entity: ESC });
const semDev = flatten(edAll._schema()).find((f) => f.name === "entity").selector.select.options;
check("sem dispositivo, mostra só os que parecem de nível",
  semDev.length === 3 && semDev.every((o) => /spraying_level$/.test(o.value)),
  JSON.stringify(semDev.map((o) => o.value)));

const out = [];
const edOut = new reg["mw-humidifier-level-card-editor"]();
edOut.hass = hass;
edOut.setConfig({ entity: ESC });
edOut.dispatchEvent = (ev) => out.push(ev.detail.config);
listeners.get(edOut._form)["value-changed"][0]({
  stopPropagation() {},
  detail: { value: { entity: ESC, name: "", height: 48, haptic: true, paper_color: "paper", radius: 14 } },
});
check("defaults fora do YAML", JSON.stringify(out[0]) === JSON.stringify({ entity: ESC }),
  JSON.stringify(out[0]));

const swap = [];
const edDev = new reg["mw-humidifier-level-card-editor"]();
edDev.hass = hass;
edDev.setConfig({ entity: ESC, device: "esc" });
edDev.dispatchEvent = (ev) => swap.push(ev.detail.config);
listeners.get(edDev._form)["value-changed"][0]({
  stopPropagation() {},
  detail: { value: { entity: ESC, device: "sui" } },
});
check("trocar de dispositivo já aponta o seletor de nível do novo",
  swap[0].entity === "select.suite_umidificador_da_suite_local_spraying_level",
  JSON.stringify(swap[0]));

console.log(fails ? `\n${fails} verificação(ões) falharam` : "\ntudo ok");
process.exit(fails ? 1 : 0);
