// Two client companies with interleaved visitor data, then checks that each dashboard token sees only its own domain.
// Run through: node scripts/seed-memory.mjs --companies [BASE]   (BASE defaults to the live deploy)
// Everything is synthetic: domains *.example (unique per run), session ids "seed-<run>-a|b-<n>", source "seed",
// sectors ending in "(seed)" so /api/insights (always filtered by a real sector) never picks them up.
const BASE = (process.argv[3] || "https://karumi-icai-challenge.vercel.app").replace(/\/$/, "");
const run = Date.now().toString(36);

const ask = (topic, text) => ({ type: "utterance", role: "user", topic, text, source: "seed-voice" });
const reply = (text) => ({ type: "reply", role: "agent", text });
const nav = (page_id, text) => ({ type: "navigate", role: "agent", page_id, text });
const shown = (text, topic) => ({ type: "reco_shown", role: "agent", text, topic });
const click = (text, topic) => ({ type: "reco_click", role: "user", text, topic });
const idea = (text) => ({ type: "reco_idea", role: "user", text });

const CO = {
  a: {
    name: "Booking (seed)", url: `https://www.booking-${run}.example/`,
    sessions: [
      { buyer_type: "finance", sector: "Consulting (seed)", company: "Seed Asesores Norte", steps: [
        ask("invoicing", "Can we get one monthly invoice for all our hotel stays?"), reply("Yes, every stay lands on one consolidated invoice"),
        nav("invoicing", "Consolidated invoicing"), shown("Spend per department", "analytics"), click("Spend per department", "analytics"),
        ask("analytics", "Show me hotel spend per department")] },
      { buyer_type: "manager", sector: "Consulting (seed)", company: "Seed Bufete Sol", steps: [
        ask("approvals", "Can I approve a team trip from my phone?"), nav("approvals", "Trip approvals"), idea("A Slack button to approve trips would save us hours")] },
      { buyer_type: "finance", sector: "Consulting (seed)", company: "Seed Grupo Delta", steps: [
        ask("invoicing", "How do VAT receipts work for hotels abroad?"), ask("travel_policy", "Can we cap the nightly rate per city?")] },
      { buyer_type: "finance", sector: "Consulting (seed)", company: "Seed Audit Partners", steps: [
        ask("invoicing", "We need the hotel invoices in our ERP every month"), shown("Travel policy rules", "travel_policy"), click("Travel policy rules", "travel_policy")] },
    ],
  },
  b: {
    name: "Glovo (seed)", url: `https://glovo-${run}.example/`,
    sessions: [
      { buyer_type: "it", sector: "Retail (seed)", company: "Seed Tiendas Mar", steps: [
        ask("integrations", "Does the courier API plug into our order system?"), reply("It does, through a REST API and webhooks"),
        nav("integrations", "Courier API"), ask("security", "Who can see our customers' home addresses?")] },
      { buyer_type: "manager", sector: "Retail (seed)", company: "Seed Farmacia Plaza", steps: [
        ask("delivery_zones", "Can one courier fleet cover two cities?"), idea("Show average delivery time per zone on the home screen")] },
      { buyer_type: "it", sector: "Retail (seed)", company: "Seed Moda Viva", steps: [
        ask("integrations", "Is there a webhook when the courier reaches the door?"), shown("Live courier tracking", "tracking"), click("Live courier tracking", "tracking")] },
    ],
  },
};
for (const k of ["a", "b"]) CO[k].domain = new URL(CO[k].url).hostname.replace(/^www\./, "");

const results = [];
const check = (ok, msg) => { results.push(ok); console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); };
const post = (path, body) => fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const getDash = (token) => fetch(BASE + "/api/dashboard?token=" + encodeURIComponent(token));

// 1. Register both companies (and check a second registration of the same domain gets no token)
for (const k of ["a", "b"]) {
  const r = await post("/api/company", { name: CO[k].name, url: CO[k].url });
  const j = await r.json();
  if (r.status !== 201) { console.error(`company ${k}: ${r.status} ${JSON.stringify(j)}`); process.exitCode = 1; throw new Error("cannot register companies"); }
  CO[k].token = new URL(j.dashboard_url).searchParams.get("token");
  CO[k].dashboard_url = j.dashboard_url;
  check(j.company.domain === CO[k].domain && /^[0-9a-f]{32}$/.test(CO[k].token) && j.snippet.includes("/widget/widget.js"), `${k}: registered ${CO[k].domain}, 32-char token, snippet`);
}
{
  const r = await post("/api/company", { name: "Someone else", url: CO.a.url.replace("www.", "") });
  const j = await r.json();
  check(r.status === 409 && !JSON.stringify(j).includes(CO.a.token) && !j.dashboard_url, "same domain again: 409, no token");
}

// 2. Interleaved writes: A, B, A, B... through the public memory endpoint
const queue = { a: [], b: [] }, texts = { a: [], b: [] };
const t0 = Date.now() - 3 * 3600e3;
for (const k of ["a", "b"]) {
  CO[k].sessions.forEach((s, i) => {
    const session_id = `seed-${run}-${k}-${i + 1}`;
    s.id = session_id;
    s.steps.forEach((st, j) => {
      if (st.text) texts[k].push(st.text);
      queue[k].push({ session_id, ts: new Date(t0 + i * 1800e3 + j * 45e3).toISOString(), product_url: CO[k].url,
        page_url: st.page_id ? CO[k].url + "app/" + st.page_id : null, reason: "seed", source: "seed", meta: { seed: true },
        sector: s.sector, buyer_type: s.buyer_type, company: s.company, ...st });
    });
  });
}
let ok = 0, bad = 0;
for (let i = 0; i < Math.max(queue.a.length, queue.b.length); i++) {
  for (const k of ["a", "b"]) {
    if (!queue[k][i]) continue;
    const r = await post("/api/memory", queue[k][i]);
    if (r.ok) ok++; else { bad++; console.error(k, r.status, await r.text()); }
  }
}
check(bad === 0, `${ok} events written, interleaved between both companies`);

// 3. Try to move one of A's sessions into B by writing to it with B's product_url
const flipId = CO.a.sessions[0].id;
await post("/api/memory", { session_id: flipId, product_url: CO.b.url, page_url: null, type: "utterance", role: "user",
  text: `flip attempt ${run}`, topic: "flip_test", source: "seed", meta: { seed: true } });

// 4. Read both dashboards and compare
const dash = {};
for (const k of ["a", "b"]) {
  const r = await getDash(CO[k].token);
  dash[k] = await r.json();
  check(r.status === 200, `${k}: dashboard 200`);
}
for (const [me, other] of [["a", "b"], ["b", "a"]]) {
  const d = dash[me], s = JSON.stringify(d);
  check(d.company && d.company.domain === CO[me].domain, `${me}: company.domain is ${CO[me].domain}`);
  check(d.totals && d.totals.sessions === CO[me].sessions.length, `${me}: totals.sessions = ${CO[me].sessions.length} (got ${d.totals && d.totals.sessions})`);
  check(d.sessions.length && d.sessions.every(x => x.id.startsWith(`seed-${run}-${me}-`)), `${me}: every session listed is its own`);
  check(!s.includes(`seed-${run}-${other}-`), `${me}: no session id of ${other}`);
  check(!s.includes(CO[other].domain), `${me}: never mentions ${CO[other].domain}`);
  const leaked = texts[other].filter(t => s.includes(t));
  check(!leaked.length, `${me}: none of ${other}'s ${texts[other].length} texts (${leaked.length} found)`);
  const missing = texts[me].filter(t => !s.includes(t));
  check(!missing.length, `${me}: all ${texts[me].length} own texts present (${missing.length} missing)`);
}
check(dash.a.sessions.some(x => x.id === flipId), "flip: the session is still in A");
check(!JSON.stringify(dash.b).includes(flipId) && !JSON.stringify(dash.b).includes(`flip attempt ${run}`), "flip: nothing of it reaches B");
check(dash.a.promoted.some(p => p.topic === "invoicing" && p.sessions === 3), "a: invoicing promoted (3 finance demos)");

// 5. Tokens that must not open anything
for (const [label, tok] of [["random 32-char token", [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, "0")).join("")], ["short token", "abc"], ["no token", ""]]) {
  const r = await getDash(tok);
  const body = await r.text();
  check(r.status === 401 && !body.includes("seed-"), `${label}: 401, no data`);
}

const failed = results.filter(x => !x).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
for (const k of ["a", "b"]) console.log(`${CO[k].name}: ${CO[k].dashboard_url}`);
if (failed) process.exitCode = 1;
