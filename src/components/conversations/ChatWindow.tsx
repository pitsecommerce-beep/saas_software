'use client';

import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Sparkles,
  UserPlus,
  Bot,
  CreditCard,
  X,
} from 'lucide-react';
import type { Conversation, Message, ChannelType } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Toggle';
import { cn } from '@/lib/utils';

interface ChatWindowProps {
  conversation: Conversation;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onToggleAI: (enabled: boolean) => void;
  onAssignVendor: () => void;
}

const channelBadge: Record<ChannelType, { label: string; variant: 'success' | 'info' | 'danger' }> = {
  whatsapp: { label: 'WhatsApp', variant: 'success' },
  instagram: { label: 'Instagram', variant: 'danger' },
  messenger: { label: 'Messenger', variant: 'info' },
};

function ChatWindow({
  conversation,
  messages,
  onSendMessage,
  onToggleAI,
  onAssignVendor,
}: ChatWindowProps) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDesc, setPaymentDesc] = useState('');
  const [paymentSending, setPaymentSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const customerName = conversation.customer?.name ?? 'Cliente Pendiente';
  const isPendingCustomer = !conversation.customer;
  const channel = channelBadge[conversation.channel];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation.id]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setInput('');

    // Simulate brief typing indicator after sending
    if (conversation.is_ai_enabled) {
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 1500);
    }
  };

  const handleSendPaymentLink = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0 || !paymentDesc.trim()) return;

    setPaymentSending(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl) {
        console.error('VITE_API_URL not configured');
        return;
      }
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/payments/create-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversation.id,
          amount,
          description: paymentDesc.trim(),
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('Payment link error:', errData);
        return;
      }
      const data = await response.json() as { payment_url?: string };
      if (data.payment_url) {
        onSendMessage(`Aquí está tu link de pago: ${data.payment_url}`);
      }
      setShowPaymentForm(false);
      setPaymentAmount('');
      setPaymentDesc('');
    } catch (err) {
      console.error('Error creating payment link:', err);
    } finally {
      setPaymentSending(false);
    }
  };

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 bg-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={cn(
                  'text-sm font-semibold truncate',
                  isPendingCustomer ? 'text-warning-600 italic' : 'text-surface-900'
                )}
              >
                {customerName}
              </h3>
              {isPendingCustomer && (
                <button
                  onClick={onAssignVendor}
                  className="text-[11px] text-primary-500 hover:text-primary-600 font-medium flex items-center gap-0.5 shrink-0"
                >
                  <UserPlus className="h-3 w-3" />
                  Identificar
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge size="sm" variant={channel.variant}>
                {channel.label}
              </Badge>
              {conversation.assigned_profile && (
                <span className="text-[11px] text-surface-500">
                  Asignado a {conversation.assigned_profile.full_name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Toggle
            enabled={conversation.is_ai_enabled}
            onChange={onToggleAI}
            label="IA"
            className="text-xs"
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-surface-50/50">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isCustomer = msg.sender_type === 'customer';
            const isAI = msg.sender_type === 'ai';

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'flex',
                  isCustomer ? 'justify-start' : 'justify-end'
                )}
              >
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm',
                    isCustomer
                      ? 'bg-white border border-surface-100 rounded-bl-md'
                      : isAI
                        ? 'bg-violet-50 border border-violet-100 text-surface-800 rounded-br-md'
                        : 'bg-primary-500 text-white rounded-br-md'
                  )}
                >
                  {isAI && (
                    <div className="flex items-center gap-1 mb-1">
                      <Bot className="h-3 w-3 text-violet-500" />
                      <span className="text-[10px] font-medium text-violet-500">
                        Asistente IA
                      </span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                  <p
                    className={cn(
                      'text-[10px] mt-1 text-right',
                      isCustomer
                        ? 'text-surface-400'
                        : isAI
                          ? 'text-violet-400'
                          : 'text-white/70'
                    )}
                  >
                    {formatMessageTime(msg.created_at)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex justify-end"
          >
            <div className="flex items-center gap-2 rounded-2xl bg-violet-50 border border-violet-100 px-4 py-3 rounded-br-md">
              <Sparkles className="h-3 w-3 text-violet-500 animate-pulse" />
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Payment form */}
      <AnimatePresence>
        {showPaymentForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-surface-100 bg-surface-50 shrink-0"
          >
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-surface-700">Generar link de pago</span>
                <button onClick={() => setShowPaymentForm(false)} className="text-surface-400 hover:text-surface-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="Monto (MXN)"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-28 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
                <input
                  type="text"
                  placeholder="Descripción del cobro"
                  value={paymentDesc}
                  onChange={(e) => setPaymentDesc(e.target.value)}
                  className="flex-1 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
                <button
                  type="button"
                  onClick={handleSendPaymentLink}
                  disabled={!paymentAmount || !paymentDesc.trim() || paymentSending}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    paymentAmount && paymentDesc.trim() && !paymentSending
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-surface-200 text-surface-400 cursor-not-allowed'
                  )}
                >
                  {paymentSending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 py-3 border-t border-surface-100 bg-white shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe un mensaje..."
          className={cn(
            'flex-1 rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm',
            'placeholder:text-surface-400 text-surface-900',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
            'transition-all duration-200'
          )}
        />
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowPaymentForm((v) => !v)}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200',
            showPaymentForm
              ? 'bg-green-500 text-white'
              : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
          )}
          title="Generar link de pago"
        >
          <CreditCard className="h-4 w-4" />
        </motion.button>
        <motion.button
          type="submit"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={!input.trim()}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            'transition-colors duration-200',
            input.trim()
              ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20 hover:bg-primary-600'
              : 'bg-surface-100 text-surface-400 cursor-not-allowed'
          )}
        >
          <Send className="h-4 w-4" />
        </motion.button>
      </form>
    </div>
  );
}

export { ChatWindow };
