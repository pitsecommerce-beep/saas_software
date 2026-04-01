'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, MessageSquare, Sparkles, Trash2 } from 'lucide-react';
import type { Conversation, ChannelType } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { cn, formatRelativeTime, truncate } from '@/lib/utils';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}

const channelConfig: Record<ChannelType, { label: string; color: string; icon: string }> = {
  whatsapp: { label: 'WhatsApp', color: 'bg-green-100 text-green-700 border-green-200', icon: '💬' },
  instagram: { label: 'Instagram', color: 'bg-pink-100 text-pink-700 border-pink-200', icon: '📸' },
  messenger: { label: 'Messenger', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: '💭' },
};

function ConversationList({ conversations, activeId, onSelect, onDelete }: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const list = conversations.filter((c) => {
      if (!q) return true;
      const name = c.customer?.name?.toLowerCase() ?? '';
      const lastMsg = c.last_message?.toLowerCase() ?? '';
      return name.includes(q) || lastMsg.includes(q);
    });
    return list.sort((a, b) => {
      const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [conversations, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-white border-r border-surface-100">
      {/* Search bar */}
      <div className="p-3 border-b border-surface-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input
            type="text"
            placeholder="Buscar conversaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full rounded-lg border border-surface-200 bg-surface-50 py-2 pl-9 pr-3 text-sm',
              'placeholder:text-surface-400 text-surface-900',
              'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
              'transition-all duration-200'
            )}
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare className="h-8 w-8 text-surface-300 mb-2" />
            <p className="text-sm text-surface-500">No se encontraron conversaciones</p>
          </div>
        )}

        {filtered.map((conversation) => {
          const isActive = conversation.id === activeId;
          const channel = channelConfig[conversation.channel];
          const customerName = conversation.customer?.name ?? 'Cliente Pendiente';
          const isPending = !conversation.customer;

          return (
            <motion.div
              key={conversation.id}
              whileHover={{ backgroundColor: isActive ? undefined : 'rgba(59,130,246,0.04)' }}
              className={cn(
                'w-full flex items-start gap-3 p-3 text-left transition-colors duration-150',
                'border-b border-surface-50 group relative',
                isActive
                  ? 'bg-primary-50 border-l-2 border-l-primary-500'
                  : 'border-l-2 border-l-transparent hover:bg-surface-50'
              )}
            >
              {/* Clickable area */}
              <button
                onClick={() => onSelect(conversation.id)}
                className="flex items-start gap-3 w-full text-left"
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <Avatar
                    name={customerName}
                    size="sm"
                    className={isPending ? '!bg-surface-300' : undefined}
                  />
                  {conversation.is_ai_enabled && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 ring-2 ring-white">
                      <Sparkles className="h-2.5 w-2.5 text-white" />
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'text-sm font-medium truncate',
                        isPending ? 'text-warning-600 italic' : 'text-surface-900'
                      )}
                    >
                      {customerName}
                    </span>
                    {conversation.last_message_at && (
                      <span className="text-[11px] text-surface-400 shrink-0">
                        {formatRelativeTime(conversation.last_message_at)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-surface-500 truncate">
                      {conversation.last_message
                        ? truncate(conversation.last_message, 50)
                        : 'Sin mensajes'}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {conversation.unread_count > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1.5 text-[10px] font-bold text-white">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Channel badge */}
                  <div className="mt-1.5">
                    <Badge
                      size="sm"
                      className={cn('border', channel.color)}
                    >
                      <span className="mr-1 text-[10px]">{channel.icon}</span>
                      {channel.label}
                    </Badge>
                  </div>
                </div>
              </button>

              {/* Delete button */}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conversation.id);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-md p-1.5 text-surface-400 hover:bg-danger-50 hover:text-danger-500"
                  title="Eliminar conversación"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export { ConversationList };
