// Shared helpers for the serverless functions (Vercel ignores files starting with _ as routes).
export function safeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname;
  if (process.env.ALLOW_LOCAL) return u; // local testing only
  if (h === 'localhost' || h.endsWith('.local') || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === '[::1]') return null;
  return u;
}

export async function fetchText(url, ms = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (KarumiVoiceDemo hackathon)', 'Accept': 'text/html,*/*' },
    });
    const type = r.headers.get('content-type') || '';
    return { ok: r.ok, status: r.status, type, finalUrl: r.url, text: await r.text() };
  } finally { clearTimeout(t); }
}

export const strip = (s = '') => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
