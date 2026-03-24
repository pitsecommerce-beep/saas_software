'use client';

import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Sparkles,
  UserPlus,
  Bot,
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

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 bg-white">
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-surface-50/50">
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

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 py-3 border-t border-surface-100 bg-white"
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
