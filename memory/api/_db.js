// Minimal Supabase (PostgREST) client. Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (server only, never in the repo).
const base = () => process.env.SUPABASE_URL && process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
export const dbReady = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

export async function sb(path, { method = 'GET', body, prefer } = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(base() + path, {
    method,
    headers: {
      apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`supabase ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

// A session belongs to the domain of its first write. Later writes can fill a missing domain or update the
// visitor profile, but never move a session (and its events) into another company's dashboard.
export async function upsertSession({ id, product_url, domain, ...profile }) {
  const prof = Object.fromEntries(Object.entries(profile).filter(([, v]) => v));
  const made = await sb('/sessions?on_conflict=id', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=representation',
    body: { id, product_url: product_url || null, domain: domain || null, ...prof } });
  if (made && made.length) return;
  const sid = encodeURIComponent(id);
  await Promise.all([
    Object.keys(prof).length && sb(`/sessions?id=eq.${sid}`, { method: 'PATCH', prefer: 'return=minimal', body: prof }),
    domain && sb(`/sessions?id=eq.${sid}&domain=is.null`, { method: 'PATCH', prefer: 'return=minimal', body: { product_url, domain } }),
  ]);
}

// Host without www, the key that ties sessions to a company.
export const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; } };
