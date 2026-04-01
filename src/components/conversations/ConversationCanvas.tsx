'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { MessageSquare, Sparkles, ChevronRight, Trash2 } from 'lucide-react';
import type { Conversation, ConversationStatus, ChannelType } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { cn, formatRelativeTime, truncate } from '@/lib/utils';

interface ConversationCanvasProps {
  conversations: Conversation[];
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: ConversationStatus) => void;
  onDelete?: (id: string) => void;
}

const columns: { key: ConversationStatus; label: string; color: string; dotColor: string }[] = [
  { key: 'active', label: 'Activas', color: 'border-accent-200 bg-accent-50/50', dotColor: 'bg-accent-500' },
  { key: 'pending', label: 'Pendientes', color: 'border-warning-200 bg-warning-50/50', dotColor: 'bg-warning-500' },
  { key: 'closed', label: 'Cerradas', color: 'border-surface-200 bg-surface-50/50', dotColor: 'bg-surface-400' },
];

const channelConfig: Record<ChannelType, { label: string; color: string }> = {
  whatsapp: { label: 'WhatsApp', color: 'bg-green-100 text-green-700 border-green-200' },
  instagram: { label: 'Instagram', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  messenger: { label: 'Messenger', color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const nextStatus: Record<ConversationStatus, ConversationStatus> = {
  active: 'pending',
  pending: 'closed',
  closed: 'active',
};

function ConversationCanvas({ conversations, onSelect, onStatusChange, onDelete }: ConversationCanvasProps) {
  const grouped = useMemo(() => {
    const groups: Record<ConversationStatus, Conversation[]> = {
      active: [],
      pending: [],
      closed: [],
    };
    for (const c of conversations) {
      groups[c.status].push(c);
    }
    // Sort each group by most recent
    for (const key of Object.keys(groups) as ConversationStatus[]) {
      groups[key].sort((a, b) => {
        const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return dateB - dateA;
      });
    }
    return groups;
  }, [conversations]);

  return (
    <LayoutGroup>
      <div className="flex gap-4 h-full overflow-x-auto p-1">
        {columns.map((col) => (
          <div key={col.key} className="flex-1 min-w-[300px] flex flex-col">
            {/* Column header */}
            <div
              className={cn(
                'flex items-center gap-2 px-4 py-3 rounded-t-xl border',
                col.color
              )}
            >
              <span className={cn('h-2.5 w-2.5 rounded-full', col.dotColor)} />
              <h3 className="text-sm font-semibold text-surface-800">{col.label}</h3>
              <span className="ml-auto text-xs font-medium text-surface-500 bg-white/80 rounded-full px-2 py-0.5">
                {grouped[col.key].length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-surface-50/30 border-x border-b border-surface-100 rounded-b-xl">
              <AnimatePresence mode="popLayout">
                {grouped[col.key].map((conversation) => {
                  const customerName = conversation.customer?.name ?? 'Cliente Pendiente';
                  const isPending = !conversation.customer;
                  const channel = channelConfig[conversation.channel];

                  return (
                    <motion.div
                      key={conversation.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => onSelect(conversation.id)}
                      className={cn(
                        'rounded-lg border border-surface-100 bg-white p-3 cursor-pointer',
                        'hover:shadow-md hover:border-surface-200 transition-shadow duration-200',
                        'group'
                      )}
                    >
                      {/* Card header */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={cn(
                            'text-sm font-medium truncate',
                            isPending ? 'text-warning-600 italic' : 'text-surface-900'
                          )}
                        >
                          {customerName}
                        </span>
                        {conversation.is_ai_enabled && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100">
                            <Sparkles className="h-3 w-3 text-violet-600" />
                          </span>
                        )}
                      </div>

                      {/* Last message */}
                      {conversation.last_message && (
                        <p className="text-xs text-surface-500 mb-2 line-clamp-2">
                          {truncate(conversation.last_message, 80)}
                        </p>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge size="sm" className={cn('border', channel.color)}>
                            {channel.label}
                          </Badge>
                          {conversation.unread_count > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1.5 text-[10px] font-bold text-white">
                              {conversation.unread_count}
                            </span>
                          )}
                        </div>
                        {conversation.last_message_at && (
                          <span className="text-[10px] text-surface-400">
                            {formatRelativeTime(conversation.last_message_at)}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="mt-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStatusChange(conversation.id, nextStatus[col.key]);
                          }}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-1 rounded-md py-1.5',
                            'text-[11px] font-medium text-surface-500',
                            'bg-surface-50 hover:bg-surface-100 border border-surface-100'
                          )}
                        >
                          Mover a {columns.find((c) => c.key === nextStatus[col.key])?.label}
                          <ChevronRight className="h-3 w-3" />
                        </button>
                        {onDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(conversation.id);
                            }}
                            className={cn(
                              'flex items-center justify-center rounded-md px-2 py-1.5',
                              'text-surface-400 hover:bg-danger-50 hover:text-danger-500',
                              'border border-surface-100'
                            )}
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {grouped[col.key].length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageSquare className="h-6 w-6 text-surface-300 mb-1.5" />
                  <p className="text-xs text-surface-400">Sin conversaciones</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </LayoutGroup>
  );
}

export { ConversationCanvas };
