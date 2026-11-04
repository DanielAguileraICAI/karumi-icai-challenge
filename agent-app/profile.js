// What we know about the person before the demo, turned into the engine Profile.
// Plain rules, no DOM, importable in the browser and in Node.

const low = (s) => String(s || "").toLowerCase();
const has = (s, re) => re.test(low(s));
const src = (value, from, evidence, confidence) => ({ value, from, evidence, confidence });

const NO_TOOL = /^(none|no tool|spreadsheets?|excel|paper.*|paper and spreadsheets|)$/;
const EXPERT_TITLE = /\b(cto|cio|ciso|it |engineer|engineering|architect|security|devops)/;

function pickRole(c) {
  const t = low(c.job_title), d = low(c.department);
  if (/\b(ceo|founder|coo|managing director|general manager)\b/.test(t)) return src("exec", "crm", `Job title is "${c.job_title}"`, "high");
  if (/\b(cto|cio|ciso)\b|\bit\b|security/.test(t)) return src("it", "crm", `Job title is "${c.job_title}"`, "high");
  if (/cfo|financ|controller|account|treasur/.test(t)) return src("finance", "crm", `Job title is "${c.job_title}"`, "high");
  if (/\bhr\b|human resources|people|talent|recruit/.test(t)) return src("hr", "crm", `Job title is "${c.job_title}"`, "high");
  if (/manager|lead|supervisor|head of/.test(t)) return src("manager", "crm", `Job title is "${c.job_title}", runs a team`, "medium");
  if (/financ/.test(d)) return src("finance", "crm", `Works in ${c.department}`, "medium");
  if (/hr|human|people/.test(d)) return src("hr", "crm", `Works in ${c.department}`, "medium");
  if (/it|engineer|tech/.test(d)) return src("it", "crm", `Works in ${c.department}`, "medium");
  return src("employee", "crm", `No clear role in title or department`, "low");
}

function pickDecision(c, f) {
  const w = low(f.who_else_decides), s = c.seniority;
  if (/my boss|my manager|asked me|sent me/.test(w)) return src("researcher", "form", `Said who decides: "${f.who_else_decides}"`, "high");
  if (/use it|i use|just use/.test(w)) return src("user", "form", `Said who decides: "${f.who_else_decides}"`, "high");
  const alone = !w || /no one|nobody|just me|only me|i sign|i decide|^me$/.test(w);
  if ((s === "c-level" || s === "vp") && alone) return src("decider", "form", `${s} and said "${f.who_else_decides || "no one else"}"`, "high");
  if (s === "c-level" || s === "vp") return src("influencer", "form", `${s}, but others sign: "${f.who_else_decides}"`, "medium");
  if (s === "director" || s === "manager") return src("influencer", "form", `${s} who shares the decision: "${f.who_else_decides}"`, "medium");
  return src("researcher", "enrichment", `Seniority is ${s || "unknown"}`, "low");
}

function pickKnowledge(c, co) {
  const tools = [co.current_hr_tool, co.current_finance_tool].filter((t) => !NO_TOOL.test(low(t).trim()));
  if (has(c.job_title, EXPERT_TITLE)) return src("expert", "crm", `Technical title "${c.job_title}"`, "high");
  if (tools.length >= 2) return src("expert", "enrichment", `Already runs two suites: ${tools.join(" and ")}`, "high");
  if (tools.length === 1) return src("familiar", "enrichment", `Already uses ${tools[0]}`, "medium");
  return src("novice", "enrichment", `Today uses ${co.current_hr_tool || "nothing"} for HR and ${co.current_finance_tool || "nothing"} for finance`, "medium");
}

const CONCERN_WORDS = [
  ["compliance", /gdpr|audit|complian|legal|labour law|regulat/],
  ["security", /\bsso\b|security|residency|encrypt|privacy/],
  ["cost", /payback|cost|price|pricing|budget|\broi\b|cheap/],
  ["integration", /\bapi\b|integrat|connect|sync/],
  ["insight", /report|dashboard|insight|analytic|numbers/],
  ["speed", /\bfast\b|quickly|up and running|asap|this week/],
  ["ease", /easy|simple|phone|mobile|intuitive/],
];
const PAGE_CONCERN = [["pricing", "cost"], ["security", "security"], ["integrations", "integration"], ["analytics", "insight"]];
const ROLE_CONCERN = { finance: "cost", hr: "compliance", manager: "ease", it: "security", exec: "speed", employee: "ease" };

function pickConcern(a, f, role) {
  const text = `${f.what_brings_you || ""} ${f.biggest_pain || ""}`;
  for (const [k, re] of CONCERN_WORDS) {
    const m = low(f.what_brings_you).match(re) || low(text).match(re);
    if (m) return src(k, "form", `Wrote "${m[0]}" when booking the demo`, "high");
  }
  for (const [p, k] of PAGE_CONCERN) {
    const page = (a.pages_visited || []).find((x) => x.includes(p));
    if (page) return src(k, "web behaviour", `Visited ${page} before the demo`, "medium");
  }
  return src(ROLE_CONCERN[role] || "ease", "crm", `Default for a ${role} person`, "low");
}

function pickStage(a, f) {
  if (a.source === "g2 comparison") return src("comparing", "web behaviour", `Came from a G2 comparison page`, "high");
  if (a.crm_stage === "negotiation" || (a.crm_stage === "opportunity" && f.timeline === "this month"))
    return src("deciding", "crm", `CRM stage ${a.crm_stage}, timeline ${f.timeline}`, "high");
  if (a.crm_stage === "sql" || f.timeline === "this quarter") return src("comparing", "crm", `CRM stage ${a.crm_stage}, timeline ${f.timeline}`, "medium");
  return src("exploring", "form", `Timeline "${f.timeline}", CRM stage ${a.crm_stage}`, "medium");
}

export function toProfile(record) {
  const c = record.contact || {}, co = record.company || {}, a = record.activity || {}, f = record.form || {};
  const role = pickRole(c);
  const sources = {
    role,
    decision: pickDecision(c, f),
    knowledge: pickKnowledge(c, co),
    concern: pickConcern(a, f, role.value),
    stage: pickStage(a, f),
    language: src(c.language === "es" ? "es" : "en", "crm", `Contact language is ${c.language}, based in ${c.country}`, "high"),
  };
  return {
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
    title: c.job_title,
    role: role.value,
    company: co.name,
    sector: co.industry,
    size: `${Number(co.employees || 0).toLocaleString("en-US")} employees`,
    decision: sources.decision.value,
    knowledge: sources.knowledge.value,
    concern: sources.concern.value,
    stage: sources.stage.value,
    minutes: 3,
    language: sources.language.value,
    note: f.biggest_pain || "",
    sources,
  };
}

export const CRM_FIELDS = [
  { block: "contact", field: "first_name", label: "First name", example: "Marta" },
  { block: "contact", field: "last_name", label: "Last name", example: "Ruiz" },
  { block: "contact", field: "email", label: "Email", example: "marta.ruiz@logitrans-iberia.example" },
  { block: "contact", field: "job_title", label: "Job title", example: "CFO" },
  { block: "contact", field: "seniority", label: "Seniority", example: "c-level" },
  { block: "contact", field: "department", label: "Department", example: "Finance" },
  { block: "contact", field: "linkedin_headline", label: "LinkedIn headline", example: "CFO at Logitrans Iberia" },
  { block: "contact", field: "language", label: "Language", example: "es" },
  { block: "contact", field: "country", label: "Country", example: "Spain" },
  { block: "contact", field: "timezone", label: "Time zone", example: "Europe/Madrid" },
  { block: "company", field: "name", label: "Company", example: "Logitrans Iberia" },
  { block: "company", field: "domain", label: "Domain", example: "logitrans-iberia.example" },
  { block: "company", field: "industry", label: "Industry", example: "Logistics" },
  { block: "company", field: "employees", label: "Employees", example: 1200 },
  { block: "company", field: "revenue_band", label: "Revenue band", example: "100M-250M EUR" },
  { block: "company", field: "country", label: "Company country", example: "Spain" },
  { block: "company", field: "funding_stage", label: "Funding stage", example: "private, profitable" },
  { block: "company", field: "current_hr_tool", label: "HR tool today", example: "spreadsheets" },
  { block: "company", field: "current_finance_tool", label: "Finance tool today", example: "SAP Business One" },
  { block: "company", field: "tech_stack", label: "Tech stack", example: ["SAP Business One", "Microsoft 365"] },
  { block: "company", field: "hiring_trend", label: "Hiring trend", example: "flat" },
  { block: "activity", field: "source", label: "Came from", example: "referral" },
  { block: "activity", field: "first_seen", label: "First seen", example: "2026-10-02" },
  { block: "activity", field: "pages_visited", label: "Pages visited", example: ["pricing.html", "app/close.html"] },
  { block: "activity", field: "content_downloaded", label: "Downloaded", example: "ROI calculator" },
  { block: "activity", field: "emails_opened", label: "Emails opened", example: 6 },
  { block: "activity", field: "previous_demos", label: "Previous demos", example: 1 },
  { block: "activity", field: "crm_stage", label: "CRM stage", example: "opportunity" },
  { block: "activity", field: "deal_owner", label: "Deal owner", example: "Pablo Ferrer" },
  { block: "activity", field: "open_opportunity_value_eur", label: "Open deal (EUR)", example: 84000 },
  { block: "form", field: "what_brings_you", label: "What brings you here", example: "We need to know the payback before the board meeting" },
  { block: "form", field: "team_size_answer", label: "Team size", example: "1,200 people" },
  { block: "form", field: "timeline", label: "Timeline", example: "this month" },
  { block: "form", field: "who_else_decides", label: "Who else decides", example: "no one, I sign" },
  { block: "form", field: "biggest_pain", label: "Biggest pain", example: "Month end close takes 9 days" },
];
