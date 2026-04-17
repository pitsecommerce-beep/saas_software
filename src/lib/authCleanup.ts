import { supabase } from './supabase';

/**
 * Best-effort deletion of an abandoned Supabase auth user.
 *
 * The backend will refuse the request if the user already has a team_id,
 * so calling this when a registration is incomplete is safe — completed
 * users are never touched.
 *
 * Uses `fetch` by default; pass `{ beacon: true }` when called from a
 * `beforeunload` handler so the browser can send it after the page closes.
 */
export async function cleanupPendingAuthUser(
  userId: string,
  accessToken: string,
  opts: { beacon?: boolean } = {}
): Promise<boolean> {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return false;

  const url = `${apiUrl.replace(/\/$/, '')}/api/auth/cleanup-pending-user`;
  const payload = JSON.stringify({ user_id: userId, access_token: accessToken });

  if (opts.beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    return navigator.sendBeacon(url, blob);
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Retrieves the current session's access token (if any), runs the cleanup
 * call, and signs the user out locally. Returns true if the auth user was
 * successfully removed on the server.
 */
export async function discardPendingGoogleUser(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;
  const ok = await cleanupPendingAuthUser(userId, token);
  await supabase.auth.signOut();
  return ok;
}
