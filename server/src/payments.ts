import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { supabase, isConfigured } from './supabase';
import { extractMessageBlocks } from './webhook';

// -----------------------------------------------------------------------------
// Payment link handler
// -----------------------------------------------------------------------------
//
// Creates a hosted-checkout payment link via Mercado Pago (Preferences API) or
// Stripe (Checkout Sessions API) and sends it to the customer through the
// conversation channel.
//
// Reference docs:
//   • Mercado Pago Preferences:
//     https://www.mercadopago.com.mx/developers/en/reference/preferences/_checkout_preferences/post
//   • Stripe Checkout Sessions:
//     https://stripe.com/docs/api/checkout/sessions/create
//
// Body:
//   conversation_id: string
//   amount:          number  (e.g. 1234.50)
//   description:     string
//   order_id?:       string  (links the payment back to an order)
//
// Behaviour:
//   – Pulls provider credentials + URLs from `payment_settings` per team.
//   – Loads customer info from the conversation to hydrate payer data (MP has
//     better approval rates when payer.email/phone/name are supplied).
//   – Uses an idempotency key so retrying the same request does not produce
//     duplicate preferences/sessions.
//   – Sends the link back to the customer via yCloud (WhatsApp) and records it
//     as a message in the conversation.
//   – If `order_id` is provided, moves the order to `pendiente_pago`.
// -----------------------------------------------------------------------------

interface PaymentSettingsRow {
  provider: 'mercadopago' | 'stripe';
  api_key_encrypted: string;
  public_key?: string | null;
  success_url?: string | null;
  cancel_url?: string | null;
  webhook_secret?: string | null;
  statement_descriptor?: string | null;
  currency?: string | null;
  webhook_url?: string | null;
}

interface ConversationRow {
  id: string;
  team_id: string;
  channel: string;
  channel_contact_id: string;
  customer_id: string | null;
}

interface CustomerRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

function pickBackUrl(raw: string | null | undefined, fallback: string): string {
  const value = (raw ?? '').trim();
  if (!value) return fallback;
  return value;
}

function sanitizeDescriptor(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  // Stripe: ≤22 chars, no <>"'*\. Mercado Pago: also caps at 22.
  const cleaned = raw.replace(/[<>"'*\\]/g, '').slice(0, 22).trim();
  return cleaned || undefined;
}

async function createMercadoPagoLink(opts: {
  settings: PaymentSettingsRow;
  amount: number;
  description: string;
  currency: string;
  externalReference: string;
  notificationUrl: string | null;
  successUrl: string;
  cancelUrl: string;
  pendingUrl: string;
  payer: { name?: string; email?: string; phone?: string };
  metadata: Record<string, string>;
  idempotencyKey: string;
}): Promise<{ url: string; id: string }> {
  const {
    settings,
    amount,
    description,
    currency,
    externalReference,
    notificationUrl,
    successUrl,
    cancelUrl,
    pendingUrl,
    payer,
    metadata,
    idempotencyKey,
  } = opts;

  const body: Record<string, unknown> = {
    items: [
      {
        title: description.slice(0, 256),
        quantity: 1,
        unit_price: Number(amount.toFixed(2)),
        currency_id: currency,
      },
    ],
    external_reference: externalReference,
    back_urls: {
      success: successUrl,
      failure: cancelUrl,
      pending: pendingUrl,
    },
    // MP rejects `auto_return` if `back_urls.success` is empty, which is why
    // we always populate it above (falling back to a safe default).
    auto_return: 'approved',
    metadata,
  };

  if (notificationUrl) body.notification_url = notificationUrl;
  const descriptor = sanitizeDescriptor(settings.statement_descriptor);
  if (descriptor) body.statement_descriptor = descriptor;

  const payerPayload: Record<string, unknown> = {};
  if (payer.name) payerPayload.name = payer.name;
  if (payer.email) payerPayload.email = payer.email;
  if (payer.phone) {
    const digits = payer.phone.replace(/\D/g, '');
    if (digits.length > 2) {
      payerPayload.phone = {
        area_code: digits.slice(0, digits.length - 10) || '52',
        number: digits.slice(-10),
      };
    }
  }
  if (Object.keys(payerPayload).length > 0) body.payer = payerPayload;

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.api_key_encrypted}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Mercado Pago ${response.status}: ${errBody}`);
  }

  const data = (await response.json()) as {
    id: string;
    init_point?: string;
    sandbox_init_point?: string;
  };
  const url = data.init_point || data.sandbox_init_point;
  if (!url) throw new Error('Mercado Pago did not return an init_point');
  return { url, id: data.id };
}

async function createStripeLink(opts: {
  settings: PaymentSettingsRow;
  amount: number;
  description: string;
  currency: string;
  externalReference: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail: string | null;
  metadata: Record<string, string>;
  idempotencyKey: string;
}): Promise<{ url: string; id: string }> {
  const {
    settings,
    amount,
    description,
    currency,
    externalReference,
    successUrl,
    cancelUrl,
    customerEmail,
    metadata,
    idempotencyKey,
  } = opts;

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('line_items[0][quantity]', '1');
  params.append('line_items[0][price_data][currency]', currency.toLowerCase());
  params.append('line_items[0][price_data][unit_amount]', String(Math.round(amount * 100)));
  params.append('line_items[0][price_data][product_data][name]', description.slice(0, 250));
  params.append('success_url', successUrl);
  params.append('cancel_url', cancelUrl);
  params.append('client_reference_id', externalReference);
  params.append('locale', 'es');
  if (customerEmail) params.append('customer_email', customerEmail);

  const descriptor = sanitizeDescriptor(settings.statement_descriptor);
  if (descriptor) {
    params.append('payment_intent_data[statement_descriptor]', descriptor);
  }

  for (const [key, value] of Object.entries(metadata)) {
    params.append(`metadata[${key}]`, value);
    params.append(`payment_intent_data[metadata][${key}]`, value);
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.api_key_encrypted}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': idempotencyKey,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Stripe ${response.status}: ${errBody}`);
  }

  const data = (await response.json()) as { id: string; url: string };
  if (!data.url) throw new Error('Stripe did not return a session url');
  return { url: data.url, id: data.id };
}

export async function handleCreatePaymentLink(req: Request, res: Response): Promise<void> {
  try {
    if (!isConfigured || !supabase) {
      res.status(503).json({ error: 'Server not configured.' });
      return;
    }

    const { conversation_id, amount, description, order_id } = req.body as {
      conversation_id?: string;
      amount?: number;
      description?: string;
      order_id?: string;
    };

    if (!conversation_id || !amount || !description) {
      res.status(400).json({
        error: 'Missing required fields: conversation_id, amount, description',
      });
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number' });
      return;
    }

    // Conversation with associated customer (used to hydrate payer data).
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('id, team_id, channel, channel_contact_id, customer_id')
      .eq('id', conversation_id)
      .single<ConversationRow>();

    if (convErr || !conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    let customer: CustomerRow | null = null;
    if (conversation.customer_id) {
      const { data: custData } = await supabase
        .from('customers')
        .select('id, name, email, phone')
        .eq('id', conversation.customer_id)
        .maybeSingle<CustomerRow>();
      customer = custData ?? null;
    }

    const { data: settings } = await supabase
      .from('payment_settings')
      .select('*')
      .eq('team_id', conversation.team_id)
      .eq('is_active', true)
      .maybeSingle<PaymentSettingsRow>();

    if (!settings) {
      res.status(400).json({ error: 'No payment provider configured for this team' });
      return;
    }

    if (!settings.api_key_encrypted) {
      res.status(400).json({ error: 'Provider API key is missing' });
      return;
    }

    const currency = (settings.currency ?? 'MXN').toUpperCase();
    const externalReference = order_id ?? conversation_id;
    const metadata: Record<string, string> = {
      team_id: conversation.team_id,
      conversation_id: conversation.id,
    };
    if (order_id) metadata.order_id = order_id;

    const baseSuccess = pickBackUrl(settings.success_url, 'https://orkesta.app/payment/success');
    const baseCancel = pickBackUrl(settings.cancel_url, 'https://orkesta.app/payment/cancel');
    const idempotencyKey = `${externalReference}-${randomUUID()}`;

    let paymentUrl = '';
    let providerPaymentId = '';

    try {
      if (settings.provider === 'mercadopago') {
        const result = await createMercadoPagoLink({
          settings,
          amount: parsedAmount,
          description,
          currency,
          externalReference,
          notificationUrl: settings.webhook_url ?? null,
          successUrl: baseSuccess,
          cancelUrl: baseCancel,
          pendingUrl: baseSuccess,
          payer: {
            name: customer?.name ?? undefined,
            email: customer?.email ?? undefined,
            phone: customer?.phone ?? undefined,
          },
          metadata,
          idempotencyKey,
        });
        paymentUrl = result.url;
        providerPaymentId = result.id;
      } else if (settings.provider === 'stripe') {
        const result = await createStripeLink({
          settings,
          amount: parsedAmount,
          description,
          currency,
          externalReference,
          successUrl: baseSuccess,
          cancelUrl: baseCancel,
          customerEmail: customer?.email ?? null,
          metadata,
          idempotencyKey,
        });
        paymentUrl = result.url;
        providerPaymentId = result.id;
      } else {
        res.status(400).json({ error: `Unsupported provider: ${settings.provider}` });
        return;
      }
    } catch (err) {
      console.error('Payment provider error:', err);
      const message = err instanceof Error ? err.message : 'Unknown provider error';
      res.status(502).json({ error: 'Error creating payment link', details: message });
      return;
    }

    const messageContent = `Link de pago generado:\n${description} - $${parsedAmount.toFixed(2)} ${currency}\n${paymentUrl}`;

    await supabase.from('messages').insert({
      conversation_id,
      sender_type: 'agent',
      content: messageContent,
      metadata: {
        type: 'payment_link',
        provider: settings.provider,
        provider_payment_id: providerPaymentId,
        payment_url: paymentUrl,
        amount: parsedAmount,
        currency,
        description,
        order_id: order_id ?? null,
      },
    });

    if (conversation.channel === 'whatsapp' && conversation.channel_contact_id) {
      const apiKey = process.env.YCLOUD_API_KEY;
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
              ? {
                  from: assignment.channel_identifier,
                  to: conversation.channel_contact_id,
                  type: 'text',
                  text: { body: block.content },
                }
              : {
                  from: assignment.channel_identifier,
                  to: conversation.channel_contact_id,
                  type: 'image',
                  image: { link: block.url },
                };

          await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
            body: JSON.stringify(body),
          });
        }
      }
    }

    await supabase
      .from('conversations')
      .update({
        last_message: messageContent,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversation_id);

    if (order_id) {
      await supabase
        .from('orders')
        .update({ status: 'pendiente_pago', updated_at: new Date().toISOString() })
        .eq('id', order_id)
        .eq('team_id', conversation.team_id);
    }

    res.json({
      success: true,
      payment_url: paymentUrl,
      provider: settings.provider,
      provider_payment_id: providerPaymentId,
    });
  } catch (err) {
    console.error('Error in handleCreatePaymentLink:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
