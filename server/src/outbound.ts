import type { Request, Response } from 'express';
import { supabase, isConfigured } from './supabase';

/**
 * POST /api/messages/send
 *
 * Sends a message from the UI to a customer via YCloud WhatsApp API.
 *
 * Body:
 *   conversation_id: string  - The conversation to send the message in
 *   content: string          - The message text
 */
export async function handleSendMessage(req: Request, res: Response): Promise<void> {
  try {
    if (!isConfigured || !supabase) {
      res.status(503).json({ error: 'Server not configured.' });
      return;
    }

    const { conversation_id, content } = req.body;

    if (!conversation_id || !content) {
      res.status(400).json({ error: 'Missing conversation_id or content' });
      return;
    }

    // 1. Get the conversation to find channel_contact_id and channel
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('id, team_id, channel, channel_contact_id')
      .eq('id', conversation_id)
      .single();

    if (convErr || !conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // 2. Find the channel assignment for this team to get the "from" phone number
    const { data: assignments } = await supabase
      .from('channel_assignments')
      .select('channel_identifier')
      .eq('team_id', conversation.team_id)
      .eq('channel', conversation.channel)
      .limit(1);

    const fromNumber = assignments?.[0]?.channel_identifier;
    if (!fromNumber) {
      // Try to use ycloud_settings phone_number_id as fallback
      const { data: yCloudSettings } = await supabase
        .from('ycloud_settings')
        .select('phone_number_id')
        .eq('team_id', conversation.team_id)
        .maybeSingle();

      if (!yCloudSettings?.phone_number_id) {
        res.status(400).json({ error: 'No phone number configured for outbound messages. Configure a channel assignment or YCloud phone number.' });
        return;
      }
    }

    const senderPhone = fromNumber ?? (await getTeamPhoneNumber(conversation.team_id));
    const recipientPhone = conversation.channel_contact_id;

    if (!senderPhone) {
      res.status(400).json({ error: 'No sender phone number available' });
      return;
    }

    // 3. Send via YCloud
    const apiKey = process.env.YCLOUD_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'YCLOUD_API_KEY not configured on server' });
      return;
    }

    const yCloudResponse = await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        from: senderPhone,
        to: recipientPhone,
        type: 'text',
        text: { body: content },
      }),
    });

    if (!yCloudResponse.ok) {
      const errorBody = await yCloudResponse.text();
      console.error(`YCloud API error (${yCloudResponse.status}):`, errorBody);
      res.status(502).json({ error: 'Failed to send message via YCloud', details: errorBody });
      return;
    }

    // 4. Save the message in the database
    const { data: savedMsg, error: msgErr } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_type: 'agent',
        content,
        metadata: { sent_via: 'ui', ycloud_status: 'sent' },
      })
      .select()
      .single();

    if (msgErr) {
      console.error('Error saving message:', msgErr);
    }

    // 5. Update conversation last_message
    await supabase
      .from('conversations')
      .update({
        last_message: content,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversation_id);

    res.status(200).json({
      status: 'sent',
      message_id: savedMsg?.id ?? null,
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getTeamPhoneNumber(teamId: string): Promise<string | null> {
  const { data } = await supabase
    .from('ycloud_settings')
    .select('phone_number_id')
    .eq('team_id', teamId)
    .maybeSingle();
  return data?.phone_number_id ?? null;
}
