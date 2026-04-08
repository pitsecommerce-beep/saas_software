import type { Request, Response } from 'express';
import { supabase, isConfigured } from './supabase';
import { extractMessageBlocks } from './webhook';

/**
 * POST /api/payments/create-link
 *
 * Creates a payment link via Mercado Pago or Stripe and sends it to the customer.
 *
 * Body:
 *   conversation_id: string
 *   amount: number
 *   description: string
 *   order_id?: string
 */
export async function handleCreatePaymentLink(req: Request, res: Response): Promise<void> {
  try {
    if (!isConfigured || !supabase) {
      res.status(503).json({ error: 'Server not configured.' });
      return;
    }

    const { conversation_id, amount, description, order_id } = req.body;

    if (!conversation_id || !amount || !description) {
      res.status(400).json({ error: 'Missing required fields: conversation_id, amount, description' });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({ error: 'Amount must be greater than 0' });
      return;
    }

    // Get conversation with team info
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('id, team_id, channel, channel_contact_id')
      .eq('id', conversation_id)
      .single();

    if (convErr || !conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Get payment settings for the team
    const { data: settings } = await supabase
      .from('payment_settings')
      .select('*')
      .eq('team_id', conversation.team_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!settings) {
      res.status(400).json({ error: 'No payment provider configured for this team' });
      return;
    }

    let paymentUrl = '';

    if (settings.provider === 'mercadopago') {
      const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.api_key_encrypted}`,
        },
        body: JSON.stringify({
          items: [{
            title: description,
            quantity: 1,
            unit_price: amount,
            currency_id: 'MXN',
          }],
          external_reference: order_id ?? conversation_id,
          auto_return: 'approved',
        }),
      });
      if (!mpResponse.ok) {
        const errBody = await mpResponse.text();
        console.error('Mercado Pago API error:', errBody);
        res.status(502).json({ error: 'Error creating Mercado Pago payment link' });
        return;
      }
      const mpData = await mpResponse.json() as { init_point: string };
      paymentUrl = mpData.init_point;
    } else if (settings.provider === 'stripe') {
      const params = new URLSearchParams();
      params.append('line_items[0][price_data][currency]', 'mxn');
      params.append('line_items[0][price_data][product_data][name]', description);
      params.append('line_items[0][price_data][unit_amount]', String(Math.round(amount * 100)));
      params.append('line_items[0][quantity]', '1');
      params.append('mode', 'payment');
      params.append('success_url', 'https://orkesta.app/payment/success');
      params.append('cancel_url', 'https://orkesta.app/payment/cancel');
      if (order_id) params.append('metadata[order_id]', order_id);

      const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(settings.api_key_encrypted + ':').toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      if (!stripeResponse.ok) {
        const errBody = await stripeResponse.text();
        console.error('Stripe API error:', errBody);
        res.status(502).json({ error: 'Error creating Stripe payment link' });
        return;
      }
      const stripeData = await stripeResponse.json() as { url: string };
      paymentUrl = stripeData.url;
    }

    // Save message in conversation
    const messageContent = `Link de pago generado:\n${description} - $${amount.toFixed(2)} MXN\n${paymentUrl}`;

    await supabase.from('messages').insert({
      conversation_id,
      sender_type: 'agent',
      content: messageContent,
      metadata: { type: 'payment_link', payment_url: paymentUrl, amount, description },
    });

    // Send via YCloud if WhatsApp
    if (conversation.channel === 'whatsapp' && conversation.channel_contact_id) {
      const apiKey = process.env.YCLOUD_API_KEY;
      // Look up the "from" phone number from channel assignments
      const { data: assignment } = await supabase
        .from('channel_assignments')
        .select('channel_identifier')
        .eq('team_id', conversation.team_id)
        .eq('channel', 'whatsapp')
        .limit(1)
        .single();

      if (apiKey && assignment) {
        const blocks = extractMessageBlocks(messageContent);
        for (let i = 0; i < blocks.length; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, 500));
          const block = blocks[i];
          const body =
            block.type === 'text'
              ? { from: assignment.channel_identifier, to: conversation.channel_contact_id, type: 'text', text: { body: block.content } }
              : { from: assignment.channel_identifier, to: conversation.channel_contact_id, type: 'image', image: { link: block.url } };

          await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
            body: JSON.stringify(body),
          });
        }
      }
    }

    // Update conversation last message
    await supabase
      .from('conversations')
      .update({
        last_message: messageContent,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversation_id);

    // Update order status if order_id
    if (order_id) {
      await supabase
        .from('orders')
        .update({ status: 'pendiente_pago', updated_at: new Date().toISOString() })
        .eq('id', order_id)
        .eq('team_id', conversation.team_id);
    }

    res.json({ success: true, payment_url: paymentUrl, provider: settings.provider });
  } catch (err) {
    console.error('Error in handleCreatePaymentLink:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
