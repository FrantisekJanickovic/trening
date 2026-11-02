import { createClient } from "@supabase/supabase-js";

/** Verifies the Supabase access token sent by the app, so only signed-in parents can use paid APIs. */
export async function requireUser(req: Request) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(token);
  if (error) return null;
  return data.user ?? null;
}

export const unauthorized = () => Response.json({ error: "Najprv sa prihlás." }, { status: 401 });
