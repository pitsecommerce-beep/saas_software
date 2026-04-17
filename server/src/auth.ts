import type { Request, Response } from 'express';
import { supabase, isConfigured } from './supabase';

/**
 * POST /api/auth/cleanup-pending-user
 *
 * Deletes an abandoned Supabase auth user *only* if they don't yet belong to
 * a team. This is the safety-valve that lets the UI recover the email address
 * when a visitor starts Google OAuth but never finishes onboarding.
 *
 * Security:
 *   – Uses the service-role key (bypasses RLS) — only deletes users whose
 *     profile row either does not exist or has `team_id IS NULL`.
 *   – Verifies the provided access token resolves to the same user id.
 *
 * Body:
 *   user_id:       string  – the auth.users.id to delete
 *   access_token:  string  – the session JWT for that user (proof of ownership)
 */
export async function handleCleanupPendingUser(req: Request, res: Response): Promise<void> {
  try {
    if (!isConfigured || !supabase) {
      res.status(503).json({ error: 'Server not configured.' });
      return;
    }

    const { user_id, access_token } = req.body ?? {};

    if (!user_id || typeof user_id !== 'string') {
      res.status(400).json({ error: 'Missing user_id' });
      return;
    }
    if (!access_token || typeof access_token !== 'string') {
      res.status(400).json({ error: 'Missing access_token' });
      return;
    }

    // Verify that the supplied access token belongs to the user being deleted.
    const { data: tokenUser, error: tokenErr } = await supabase.auth.getUser(access_token);
    if (tokenErr || !tokenUser?.user || tokenUser.user.id !== user_id) {
      res.status(401).json({ error: 'Invalid access token' });
      return;
    }

    // Refuse to delete users who already completed onboarding (have a team).
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, team_id')
      .eq('id', user_id)
      .maybeSingle();

    if (profileErr) {
      console.warn('cleanup-pending-user: profile lookup failed', profileErr.message);
      // Fall through — if we can't read the profile, we'll still attempt deletion
      // because the original concern is abandoned auth users.
    }

    if (profile?.team_id) {
      res.status(409).json({ error: 'User already belongs to a team' });
      return;
    }

    // Remove the profile row (if any) so the DB doesn't keep a dangling record.
    if (profile) {
      await supabase.from('profiles').delete().eq('id', user_id);
    }

    const { error: deleteErr } = await supabase.auth.admin.deleteUser(user_id);
    if (deleteErr) {
      console.error('cleanup-pending-user: deleteUser failed', deleteErr.message);
      res.status(500).json({ error: 'Failed to delete auth user' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('cleanup-pending-user unexpected error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
