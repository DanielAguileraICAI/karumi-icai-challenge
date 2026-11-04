// Seeds the memory layer with SYNTHETIC demo sessions so /api/insights has something to show.
// Every row is marked source "seed" and its session id starts with "seed-".
// Usage: node scripts/seed-memory.mjs [https://karumi-icai-challenge.vercel.app]
//        node scripts/seed-memory.mjs --companies [BASE]   two companies with mixed data, then checks each dashboard sees only its own
if (process.argv[2] === "--companies") {
  await import("./seed-companies.mjs");
  process.exit(process.exitCode || 0);
}
const BASE = (process.argv[2] || "https://karumi-icai-challenge.vercel.app").replace(/\/$/, "");
const PRODUCT = BASE + "/client-site/";
const SESSIONS = [
  // Logistics finance buyers: integrations reaches 4 sessions, security 3, analytics 2
  { sector: "Logistics", buyer_type: "finance", company: "Seed Freight Iberia", asks: [["integrations", "Does it connect with our ERP and the fleet software?"], ["security", "Where is the payroll data stored?"]] },
  { sector: "Logistics", buyer_type: "finance", company: "Seed Cargo Norte", asks: [["integrations", "Can we push the expense data into SAP?"], ["analytics", "I want a dashboard with cost per depot"]] },
  { sector: "Logistics", buyer_type: "finance", company: "Seed Puerto Logistics", asks: [["integrations", "How long does the accounting integration take?"], ["security", "Do you have SOC 2 and SSO?"]] },
  { sector: "Logistics", buyer_type: "finance", company: "Seed Ruta Transportes", asks: [["integrations", "Show me the integrations with our bank"], ["security", "Who can see salaries?"], ["analytics", "Reports by warehouse please"]] },
  { sector: "Logistics", buyer_type: "finance", company: "Seed Almacenes Sur", asks: [["expenses", "How do drivers submit fuel receipts?"]] },
  { sector: "Logistics", buyer_type: "hr", company: "Seed Freight Iberia", asks: [["timeoff", "How do shift workers ask for leave?"]] },
  // Retail manager buyers: timeoff reaches 3 sessions
  { sector: "Retail", buyer_type: "manager", company: "Seed Moda Centro", asks: [["timeoff", "How do store staff swap shifts and ask for days off?"], ["analytics", "Sales per employee by store"]] },
  { sector: "Retail", buyer_type: "manager", company: "Seed Super Barrio", asks: [["timeoff", "Holiday requests in peak season"], ["recruiting", "We hire 200 people for Christmas"]] },
  { sector: "Retail", buyer_type: "manager", company: "Seed Calzados Luna", asks: [["timeoff", "Can managers approve absences from the phone?"]] },
  { sector: "Retail", buyer_type: "manager", company: "Seed Hogar Plus", asks: [["recruiting", "How fast can we hire seasonal staff?"], ["analytics", "Labour cost per store"]] },
  { sector: "Retail", buyer_type: "finance", company: "Seed Moda Centro", asks: [["integrations", "Does it connect with our point of sale?"]] },
  { sector: "Retail", buyer_type: "finance", company: "Seed Super Barrio", asks: [["pricing", "What does it cost per store?"]] },
];

const run = Date.now().toString(36);
let ok = 0, fail = 0;
for (const [i, s] of SESSIONS.entries()) {
  const session_id = `seed-${run}-${i + 1}`;
  const t0 = Date.now() - (SESSIONS.length - i) * 3600e3;
  for (const [j, [topic, text]] of s.asks.entries()) {
    const body = { session_id, ts: new Date(t0 + j * 60e3).toISOString(), product_url: PRODUCT, type: "utterance", role: "user",
      text, topic, page_url: PRODUCT, reason: "seed", source: "seed", sector: s.sector, buyer_type: s.buyer_type, company: s.company, meta: { seed: true } };
    const r = await fetch(BASE + "/api/memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) ok++; else { fail++; console.error(session_id, r.status, await r.text()); }
  }
}
console.log(`seeded ${SESSIONS.length} synthetic sessions, ${ok} events ok, ${fail} failed`);
