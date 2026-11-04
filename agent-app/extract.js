// Feature extractor: crawl a product site in the browser and turn its pages into engine features.
// Plain ES module, no dependencies. Uses fetch + DOMParser.

const ASSET_RE = /\.(css|js|mjs|png|jpe?g|gif|svg|webp|ico|pdf|zip|json|woff2?|ttf|mp4|mp3)(\?|$)/i;
const ACTION_RE = /^(run|approve|request|add|export|ask|create|new|send|submit|book|start|invite|compare|fix|review|verify|connect|download|upload|generate|schedule|apply|post|close|plan|import|sync|share|assign|launch|pay|try|calcul|aprobar|solicitar|a[ñn]adir|exportar|preguntar|crear|enviar|reservar|empezar|invitar|comparar|revisar|conectar|descargar|subir|generar|programar|pagar|probar)/i;
const NUM_RE = /\d[\d.,]*\s*(%|x\b|×|days?|d[ií]as|hours?|horas?|h\b|minutes?|minutos?|mins?\b)|[€$£]\s?\d|\d[\d.,]*\s?[€$£]/i;

const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function sentencesWithNumbers(text) {
  return text
    .split(/(?<=[.!?])\s+|\s·\s|\n/)
    .map(clean)
    .filter((s) => s.length > 3 && s.length < 260 && NUM_RE.test(s));
}

function textUnits(main) {
  // text in readable units (paragraphs, list items, cells, leaf blocks) so numbers are not glued to labels
  if (!main) return "";
  const units = [...main.querySelectorAll("p, li, td, h1, h2, h3, h4, .callout, *")].filter((e) =>
    /^(P|LI|TD|H[1-4])$/.test(e.tagName) || (e.classList && e.classList.contains("callout")) || !e.children.length
  ).filter((e) => !e.parentElement || !e.parentElement.closest("p, li, td, .callout"));
  return units.map((e) => clean(e.textContent)).filter(Boolean).join("\n");
}

function moduleFor(a) {
  // nearest preceding sibling with class "group" (sidebar group label), else parent heading
  let el = a.previousElementSibling;
  while (el) {
    if (el.classList && (el.classList.contains("group") || /^H[2-6]$/.test(el.tagName))) return clean(el.textContent);
    el = el.previousElementSibling;
  }
  return "";
}

function parsePage(html, url) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const u = new URL(url);
  const main = doc.querySelector("main") || doc.body;
  const text = clean(main ? main.textContent : "");
  const headings = [...main.querySelectorAll("h1,h2,h3,h4")].map((h) => ({ level: +h.tagName[1], text: clean(h.textContent) })).filter((h) => h.text);
  const nav = [...doc.querySelectorAll("nav a[href], aside a[href], header a[href]")]
    .map((a) => ({ text: clean(a.textContent), href: new URL(a.getAttribute("href"), url).href, group: moduleFor(a) }))
    .filter((n) => n.text);
  const crumbEl = doc.querySelector('.crumbs, .breadcrumbs, [aria-label*="breadcrumb" i], nav.breadcrumb');
  const breadcrumbs = crumbEl ? clean(crumbEl.textContent).split(/\s*[·›>\/|]\s*/).filter(Boolean) : [];
  const paragraphs = [...main.querySelectorAll("p")].map((p) => clean(p.textContent)).filter(Boolean).slice(0, 5).map((p) => cut(p, 240));
  const actions = [...new Set([...main.querySelectorAll("button, a.btn, a[role=button], input[type=submit], .btn")]
    .map((b) => clean(b.textContent || b.value))
    .filter((t) => t && t.length < 60 && ACTION_RE.test(t)))];
  const forms = [...main.querySelectorAll("form")].map((f) => ({
    fields: [...f.querySelectorAll("input,select,textarea")].filter((i) => i.type !== "hidden").map((i) => {
      const lab = (i.id && f.querySelector(`label[for="${i.id}"]`)) || i.closest("label");
      return { label: clean(lab ? lab.textContent : i.placeholder || i.getAttribute("aria-label") || ""), type: i.type || i.tagName.toLowerCase(), name: i.name || "" };
    }),
  }));
  const looseInputs = main.querySelectorAll("input,select,textarea").length;
  const tables = [...main.querySelectorAll("table")].map((t) => ({
    columns: [...t.querySelectorAll("thead th, tr:first-child th")].map((th) => clean(th.textContent)),
    rows: t.querySelectorAll("tbody tr").length || Math.max(0, t.querySelectorAll("tr").length - 1),
  }));
  const charts = [...main.querySelectorAll("svg, canvas")].filter((g) => {
    const w = +(g.getAttribute("width") || 0), vb = (g.getAttribute("viewBox") || "").split(/\s+/).map(Number);
    return g.tagName.toLowerCase() === "canvas" || g.querySelectorAll("path,rect,circle,polyline,line").length >= 3 || w > 80 || (vb[2] || 0) > 80;
  }).length + main.querySelectorAll(".cols, .chart, .bars, [class*=chart], [role=img]").length;
  const og = doc.querySelector('meta[property="og:site_name"]');
  const logo = doc.querySelector("header .logo, header .brand, .logo, .brand");
  return {
    url, path: u.pathname,
    title: clean(doc.title),
    meta_description: clean(doc.querySelector('meta[name="description"]')?.getAttribute("content")),
    h1: clean(main.querySelector("h1")?.textContent || doc.querySelector("h1")?.textContent),
    headings, nav, breadcrumbs, paragraphs, actions, forms, inputs: looseInputs, tables, charts,
    numbers: [...new Set(sentencesWithNumbers(textUnits(main)))].slice(0, 12),
    data_feature: main?.getAttribute("data-feature") || "",
    word_count: text ? text.split(" ").length : 0,
    _brand: clean(og?.getAttribute("content") || logo?.textContent || ""),
    _links: [...doc.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
    _text: text.toLowerCase(),
  };
}

export async function extractSite(startUrl, { maxPages = 25 } = {}) {
  const start = new URL(startUrl, typeof location !== "undefined" ? location.href : undefined);
  const out = { product: "", start_url: start.href, crawled_at: new Date().toISOString(), pages: [], links_seen: 0, errors: [] };
  const seen = new Set([start.href.split("#")[0]]);
  const queue = [start.href.split("#")[0]];
  while (queue.length && out.pages.length < maxPages) {
    const url = queue.shift();
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      if (!/html/i.test(res.headers.get("content-type") || "text/html")) continue;
      const page = parsePage(await res.text(), url);
      for (const href of page._links) {
        if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
        let abs;
        try { abs = new URL(href, url); } catch { continue; }
        out.links_seen++;
        if (abs.origin !== start.origin || ASSET_RE.test(abs.pathname)) continue;
        const key = abs.href.split("#")[0];
        if (!seen.has(key)) { seen.add(key); queue.push(key); }
      }
      delete page._links;
      if (!out.product && page._brand) out.product = page._brand;
      delete page._brand;
      out.pages.push(page);
    } catch (e) {
      out.errors.push({ url, error: String(e.message || e) });
    }
  }
  if (!out.product) out.product = clean((out.pages[0]?.title || "").split(/[·|\-–]/).pop()) || start.hostname;
  return out;
}

const THEMES = {
  cost: ["price", "pricing", "cost", "budget", "spend", "payroll", "roi", "€", "$", "precio", "coste", "presupuesto", "gasto", "nómina"],
  compliance: ["audit", "compliance", "policy", "rules", "gdpr", "regulation", "auditoría", "cumplimiento", "política", "normativa", "rgpd"],
  security: ["sso", "soc", "iso", "encryption", "permission", "role-based", "residency", "cifrado", "permisos", "seguridad"],
  ease: ["one click", "two taps", "simple", "photo", "mobile", "easy", "un clic", "fácil", "foto", "móvil"],
  speed: ["faster", "instant", "live", "minutes", "automate", "automatic", "rápido", "instantáneo", "minutos", "automático", "automatiza"],
  insight: ["dashboard", "report", "analytics", "chart", "trend", "forecast", "panel", "informe", "analítica", "gráfico", "tendencia", "previsión"],
  integration: ["api", "connect", "integration", "sync", "connector", "conectar", "integración", "sincroniza", "conector"],
  innovation: ["ai", "assistant", "predict", "suggest", "smart", "ia", "asistente", "predice", "sugiere", "inteligente"],
};
const ROLES = {
  finance: ["ledger", "payroll", "budget", "expense", "close", "invoice", "spend", "nómina", "presupuesto", "gasto", "factura", "cierre"],
  hr: ["hire", "candidate", "leave", "review", "employee", "onboarding", "people", "contratar", "candidato", "empleado", "personas"],
  manager: ["team", "approve", "goals", "check-in", "equipo", "aprobar", "objetivos"],
  it: ["api", "sso", "security", "integration", "permissions", "seguridad", "integración", "permisos"],
  exec: ["dashboard", "board", "plan", "headcount", "strategy", "plantilla", "estrategia", "consejo"],
  employee: ["request", "my", "time off", "expenses", "profile", "solicitar", "mis", "vacaciones", "perfil"],
};
const AI_WORDS = ["ai", "assistant", "predict", "suggest", "smart", "ask", "ia", "asistente", "predice", "sugiere"];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function hit(word, text) {
  if (/^[€$£]$/.test(word)) return text.includes(word);
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(word)}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}
function where(word, page) {
  const spots = [["h1", page.h1], ["title", page.title], ["description", page.meta_description], ["headings", page.headings.map((h) => h.text).join(" ")], ["actions", page.actions.join(" ")], ["body", page._text || page.paragraphs.join(" ")]];
  for (const [name, txt] of spots) if (txt && hit(word, txt.toLowerCase())) return name;
  return null;
}
function tag(dict, page, kind, evidence) {
  const scores = [];
  for (const [key, words] of Object.entries(dict)) {
    let n = 0, first = null;
    for (const w of words) {
      const spot = where(w, page);
      if (spot) { n += spot === "body" ? 1 : 3; first = first || `'${w}' in ${spot}`; }
    }
    if (n) { scores.push([key, n]); evidence.push(`${kind}.${key} <- ${first} (weight ${n})`); }
  }
  scores.sort((a, b) => b[1] - a[1]);
  return scores.filter(([, n], i) => i < 3 || n >= 3).slice(0, 4).map(([k]) => k);
}
const slug = (s) => clean(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\.html?$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "home";

export function deriveFeatures(extract) {
  const base = new URL(".", extract.start_url).pathname; // e.g. /client-site/
  const navIndex = new Map();
  for (const p of extract.pages) for (const n of p.nav) if (n.group && !navIndex.has(n.href.split("#")[0])) navIndex.set(n.href.split("#")[0], n.group);
  const features = [];
  const ids = new Set(), screens = new Set();
  for (const page of extract.pages) {
    if (page.word_count < 30) continue;
    const evidence = [];
    let screen = page.path.startsWith(base) ? page.path.slice(base.length) : page.path.replace(/^\//, "");
    if (!screen || screen.endsWith("/")) screen += "index.html";
    if (screens.has(screen)) continue; // "/x/" and "/x/index.html" are the same page
    screens.add(screen);
    let id = page.data_feature || slug(screen.split("/").pop());
    while (ids.has(id)) id += "-2";
    ids.add(id);
    const module = navIndex.get(page.url) || page.breadcrumbs[0] || "General";
    const name = page.h1 || page.title || id;
    const themes = tag(THEMES, page, "themes", evidence);
    const roles = tag(ROLES, page, "roles", evidence);
    const inputs = page.inputs + page.forms.reduce((s, f) => s + f.fields.length, 0) / 2;
    const rows = page.tables.length, ui = inputs + rows * 2 + page.charts * 2 + page.actions.length;
    const level = ui >= 12 ? 3 : ui >= 5 ? 2 : 1;
    evidence.push(`level ${level} <- ${Math.round(inputs)} inputs, ${rows} tables, ${page.charts} charts, ${page.actions.length} actions`);
    const aiHits = AI_WORDS.filter((w) => hit(w, page._text || "")).length;
    const big = page.numbers.filter((s) => /\d{2,}\s*%|\d+(\.\d+)?\s*x\b|×/i.test(s)).length;
    const wow = Math.max(1, Math.min(5, 1 + Math.min(2, page.charts) + (aiHits ? 1 : 0) + (big ? 1 : 0)));
    evidence.push(`wow ${wow} <- ${page.charts} charts, ${aiHits} AI words, ${big} big-effect numbers`);
    features.push({
      id, module, name,
      does: page.meta_description || page.paragraphs[0] || page.headings.slice(1, 3).map((h) => h.text).join(". "),
      screen, roles: roles.length ? roles : ["employee"], themes: themes.length ? themes : ["ease"],
      level, wow, seconds: 20 + 10 * level,
      proof: page.numbers.find((s) => s.split(" ").length >= 5) || page.numbers[0] || "",
      evidence,
    });
  }
  return features;
}

export function toSchema(extract) {
  return { product: extract.product, category: "extracted from " + extract.start_url, features: deriveFeatures(extract) };
}
