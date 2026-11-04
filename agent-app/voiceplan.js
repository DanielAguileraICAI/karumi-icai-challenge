// Our engine's plan in the voice agent's plan format (see INTEGRATION-DANI.md, section 2).
export function toVoicePlan(schema, profile, plan, features, baseUrl) {
  const abs = s => new URL(s, baseUrl).href;
  const planned = new Map(plan.steps.map((s, i) => [s.id, { s, i }]));
  const pages = features
    .map(f => {
      const hit = planned.get(f.id);
      const score = hit ? 1 - hit.i * 0.05 : Math.max(0, Math.min(0.5, (f.score || 0) / 30));
      return {
        id: f.id, url: abs(f.screen), title: f.name,
        summary: f.does || "", keywords: [...(f.themes || []), ...(f.roles || []), f.module].filter(Boolean),
        score: Math.round(score * 100) / 100,
        why: hit ? hit.s.why.join("; ") : "not in the first plan, show only if asked",
        talking_points: hit ? [hit.s.say, hit.s.check].filter(Boolean) : [f.proof].filter(Boolean),
      };
    })
    .sort((a, b) => b.score - a.score);
  return {
    product: schema.product, url: baseUrl, buyer: `${profile.title} (${profile.decision}, ${profile.knowledge}, cares about ${profile.concern})`,
    opening: plan.opening, buyer_ideas: [...plan.mustKnow, `Next step: ${plan.nextStep}`],
    source: "nextstep-engine", pages,
  };
}
export const asDataUrl = obj => "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj));
