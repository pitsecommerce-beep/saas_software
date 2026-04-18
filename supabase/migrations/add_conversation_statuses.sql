-- =============================================================================
-- Migration: Add saludo_inicial and cotizando conversation statuses
-- =============================================================================
-- The conversations.status CHECK constraint needs to be dropped and recreated
-- to include the two new values. ai_attended is kept for backwards compatibility.
-- =============================================================================

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_status_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_status_check
  CHECK (status IN (
    'nuevo',
    'saludo_inicial',
    'cotizando',
    'ai_attended',
    'payment_pending',
    'immediate_attention',
    'closed'
  ));
