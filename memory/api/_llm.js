// LLM por API compatible con OpenAI. Por defecto OpenRouter con un modelo gratis (:free).
// Env: AI_GATEWAY_API_KEY (Vercel) | OPENROUTER_API_KEY (o LLM_API_KEY). Cambiar proveedor: LLM_BASE_URL + LLM_MODEL. Fallback: OPENAI_API_KEY.
export function llmConfig() {
  // 1) Vercel AI Gateway (Dani ya lo tiene): AI_GATEWAY_API_KEY. En Vercel puede usarse el token OIDC automático.
  const gw = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (gw) return { key: gw, base: process.env.LLM_BASE_URL || 'https://ai-gateway.vercel.sh/v1', model: process.env.LLM_MODEL || 'openai/gpt-4o-mini' };
  // 2) OpenRouter
  const orKey = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY;
  if (orKey) return { key: orKey, base: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1', model: process.env.LLM_MODEL || 'meta-llama/llama-3.3-70b-instruct:free' };
  if (process.env.OPENAI_API_KEY) return { key: process.env.OPENAI_API_KEY, base: 'https://api.openai.com/v1', model: process.env.LLM_MODEL || 'gpt-4o-mini' };
  return null;
}

export async function chat(messages, { max_tokens = 600, ms = 20000 } = {}) {
  const c = llmConfig();
  if (!c) return null;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(c.base + '/chat/completions', {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: `Bearer ${c.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: c.model, temperature: 0.3, max_tokens, messages }),
    });
    const j = await r.json();
    return j.choices?.[0]?.message?.content ?? null;
  } catch { return null; } finally { clearTimeout(t); }
}

// Los modelos gratis no siempre respetan response_format: extraemos el primer objeto JSON del texto.
export const parseJson = (s) => { try { return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); } catch { return null; } };
