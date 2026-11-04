// Demo plan engine: feature schema + visitor profile -> first demo plan.
// Pure function, no network, so it always works live.

const CONCERN = {
  cost: "cost and payback", compliance: "compliance", ease: "ease of use", security: "security",
  speed: "speed", insight: "insight and reporting", integration: "integrations", innovation: "innovation",
};
const ROLE = { finance: "finance lead", hr: "HR lead", manager: "manager", it: "tech lead", exec: "executive", employee: "employee" };

const MUST_KNOW_DECISION = {
  decider: ["What it costs and when it pays back", "How long until it is live", "Who else has to say yes"],
  influencer: ["How it compares with what you use today", "A one page summary to take to whoever decides", "The two strongest proofs"],
  user: ["What changes in your day", "How long it takes to learn", "Who to ask for help"],
  researcher: ["The full feature list for your shortlist", "Security and integrations in writing", "Prices and plans to compare"],
};
const MUST_KNOW_CONCERN = {
  cost: "Price per employee and the payback period",
  compliance: "Country rules, audit trail and who signs off",
  ease: "How many clicks the everyday tasks take",
  security: "SOC 2, ISO 27001, data residency and SSO",
  speed: "Time to go live and time saved each month",
  insight: "Which numbers you get live and how to ask for new ones",
  integration: "Which of your tools connect on day one",
  innovation: "What the AI does today, not on the roadmap",
};
const MUST_KNOW_KNOWLEDGE = {
  novice: "What an HR and finance suite does, in one sentence",
  familiar: "What is different from the tools you know",
  expert: "Where it is deeper than the suites you have used",
};
const NEXT_STEP = {
  decider: { deciding: "Book a call with sales this week to agree price and start date", comparing: "Get a side by side with your current vendor and a price", exploring: "Start a 14 day pilot with one team" },
  influencer: { any: "Send a one page summary of this demo to whoever decides" },
  user: { any: "Try it free with your own team for a week" },
  researcher: { any: "Download the comparison pack with features, security and prices" },
};
const CHECK = {
  cost: "Does this payback fit your budget cycle?", compliance: "Would this pass your next audit?",
  ease: "Could your team do this without training?", security: "Is anything missing for your security review?",
  speed: "How long does this take you today?", insight: "Which number would you look at first?",
  integration: "Which of your tools would you connect first?", innovation: "Where would you use this first?",
};

function levelFit(level, knowledge) {
  if (knowledge === "novice") return level === 1 ? 2 : level === 2 ? 0 : -3;
  if (knowledge === "familiar") return level === 2 ? 1.5 : level === 1 ? 0.5 : -0.5;
  return level === 3 ? 2 : level === 2 ? 1 : -1; // expert
}

export function scoreFeature(f, p) {
  const reasons = [];
  let s = 0;
  if (f.roles.includes(p.role)) { s += 3; reasons.push(`made for a ${ROLE[p.role] || p.role}`); }
  if (f.themes.includes(p.concern)) { s += 4; reasons.push(`answers ${CONCERN[p.concern] || p.concern}`); }
  const wowWeight = p.stage === "exploring" ? 0.9 : 0.5;
  s += f.wow * wowWeight;
  if (f.wow >= 4) reasons.push("strong wow moment");
  const lf = levelFit(f.level, p.knowledge);
  s += lf;
  if (lf >= 1.5) reasons.push(`right depth for ${p.knowledge === "novice" ? "a first look" : "someone who knows the field"}`);
  if (lf <= -2) reasons.push("too deep for a first look");
  if (f.id === "pricing") {
    if (p.decision === "decider") { s += p.stage === "deciding" ? 6 : 3; reasons.push("they can sign, so price matters"); }
    if (p.decision === "researcher") { s += 2; reasons.push("needs prices for the shortlist"); }
    if (p.decision === "user") s -= 4;
  }
  if (p.decision === "researcher" && ["security", "integrations"].includes(f.id)) { s += 1.5; reasons.push("goes in the shortlist file"); }
  if (p.decision === "user" && ["home", "assistant", "timeoff", "expenses"].includes(f.id)) { s += 1.5; reasons.push("part of their daily work"); }
  if (p.stage === "comparing" && f.level >= 2) { s += 1; reasons.push("shows depth to compare"); }
  return { score: Math.round(s * 10) / 10, reasons };
}

export function planDemo(schema, p) {
  const intro = 15, close = 15;
  const budget = Math.max(60, (p.minutes || 3) * 60) - intro - close;
  const scored = schema.features
    .map(f => ({ f, ...scoreFeature(f, p) }))
    .sort((a, b) => b.score - a.score);

  // Hook: the best scored feature for this person (pricing never opens).
  const hook = scored.find(x => x.f.id !== "pricing") || scored[0];
  const chosen = [hook];
  let used = hook.f.seconds;
  for (const x of scored) {
    if (chosen.includes(x)) continue;
    if (x.score < 3) continue;
    if (used + x.f.seconds > budget) continue;
    chosen.push(x); used += x.f.seconds;
  }
  // Pricing always closes the demo if chosen.
  const pi = chosen.findIndex(x => x.f.id === "pricing");
  if (pi > 0) chosen.push(chosen.splice(pi, 1)[0]);

  const say = (f) => p.knowledge === "novice"
    ? `In plain words: ${f.does.charAt(0).toLowerCase() + f.does.slice(1)}.`
    : p.knowledge === "expert" ? `${f.does}. ${f.proof}.` : `${f.does}. For example: ${f.proof.toLowerCase()}.`;

  let t = intro;
  const steps = chosen.map((x, i) => {
    const step = {
      n: i + 1, id: x.f.id, name: x.f.name, module: x.f.module, screen: x.f.screen,
      start: t, seconds: x.f.seconds, score: x.score, why: x.reasons, say: say(x.f),
      check: i === 0 || i === chosen.length - 1 ? CHECK[p.concern] : null,
      role: i === 0 ? "hook" : x.f.id === "pricing" ? "close" : "core",
    };
    t += x.f.seconds;
    return step;
  });

  const leftOut = scored.filter(x => !chosen.includes(x)).map(x => ({
    name: x.f.name,
    why: x.score < 3 ? (levelFit(x.f.level, p.knowledge) <= -2 ? "too deep for a first look" : `not what a ${ROLE[p.role] || p.role} came for`) : "no time in this demo, keep for later",
  }));

  const ns = NEXT_STEP[p.decision];
  return {
    opening: `Hi ${p.name.split(" ")[0]}, you have ${p.minutes} minutes and you care about ${CONCERN[p.concern] || p.concern}. I will start with ${hook.f.name.toLowerCase()}.`,
    totalSeconds: t + close,
    budgetSeconds: budget + intro + close,
    steps,
    mustKnow: [MUST_KNOW_KNOWLEDGE[p.knowledge], MUST_KNOW_CONCERN[p.concern], ...MUST_KNOW_DECISION[p.decision]].filter(Boolean),
    leftOut,
    nextStep: ns[p.stage] || ns.any,
  };
}
