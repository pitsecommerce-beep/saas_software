'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Sparkles, GripVertical, Trash2 } from 'lucide-react';
import type { Conversation, ConversationStatus, ChannelType } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { cn, formatRelativeTime, truncate } from '@/lib/utils';

interface ConversationCanvasProps {
  conversations: Conversation[];
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: ConversationStatus) => void;
  onDelete?: (id: string) => void;
}

const columns: { key: ConversationStatus; label: string; color: string; dotColor: string; dropHighlight: string }[] = [
  { key: 'nuevo',              label: 'Mensaje Nuevo',    color: 'border-blue-200 bg-blue-50/50',     dotColor: 'bg-blue-500',     dropHighlight: 'ring-blue-300 bg-blue-50/80' },
  { key: 'saludo_inicial',     label: 'Saludo Inicial',   color: 'border-sky-200 bg-sky-50/50',       dotColor: 'bg-sky-400',      dropHighlight: 'ring-sky-300 bg-sky-50/80' },
  { key: 'cotizando',          label: 'Cotizando',        color: 'border-violet-200 bg-violet-50/50', dotColor: 'bg-violet-500',   dropHighlight: 'ring-violet-300 bg-violet-50/80' },
  { key: 'payment_pending',    label: 'Pago Pendiente',   color: 'border-warning-200 bg-warning-50/50', dotColor: 'bg-warning-500', dropHighlight: 'ring-amber-300 bg-amber-50/80' },
  { key: 'immediate_attention',label: 'Atención Inmediata', color: 'border-danger-200 bg-danger-50/50', dotColor: 'bg-danger-500', dropHighlight: 'ring-red-300 bg-red-50/80' },
  { key: 'closed',             label: 'Cerrado',          color: 'border-surface-200 bg-surface-50/50', dotColor: 'bg-surface-400', dropHighlight: 'ring-surface-300 bg-surface-100/80' },
];

const channelConfig: Record<ChannelType, { label: string; color: string }> = {
  whatsapp: { label: 'WhatsApp', color: 'bg-green-100 text-green-700 border-green-200' },
  instagram: { label: 'Instagram', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  messenger: { label: 'Messenger', color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

// ---------------------------------------------------------------------------
// Droppable Column wrapper
// ---------------------------------------------------------------------------
function DroppableColumn({
  id,
  isOver,
  dropHighlight,
  children,
}: {
  id: string;
  isOver: boolean;
  dropHighlight: string;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 overflow-y-auto space-y-2 p-2 border-x border-b border-surface-100 rounded-b-xl transition-all duration-200 min-h-[120px]',
        isOver ? `ring-2 ${dropHighlight}` : 'bg-surface-50/30'
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable Card
// ---------------------------------------------------------------------------
function SortableCard({
  conversation,
  onSelect,
  onDelete,
  isDragging: isOverlayDragging,
}: {
  conversation: Conversation;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: conversation.id, data: { conversation } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-lg border-2 border-dashed border-primary-200 bg-primary-50/30 p-3 h-[100px]"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border border-surface-100 bg-white p-3 cursor-pointer',
        'hover:shadow-md hover:border-surface-200 transition-all duration-200',
        'group',
        isOverlayDragging && 'shadow-xl ring-2 ring-primary-300 rotate-[2deg] scale-[1.02]'
      )}
    >
      <ConversationCardContent
        conversation={conversation}
        onSelect={onSelect}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card content (shared between sortable card and drag overlay)
// ---------------------------------------------------------------------------
function ConversationCardContent({
  conversation,
  onSelect,
  onDelete,
  dragHandleProps,
  isOverlay,
}: {
  conversation: Conversation;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  dragHandleProps?: Record<string, unknown>;
  isOverlay?: boolean;
}) {
  const customerName = conversation.customer?.name ?? 'Cliente Pendiente';
  const isPending = !conversation.customer;
  const channel = channelConfig[conversation.channel];

  return (
    <>
      {/* Card header with drag handle */}
      <div className="flex items-center gap-2 mb-2">
        <button
          {...dragHandleProps}
          className={cn(
            'shrink-0 touch-none rounded p-0.5 text-surface-300 transition-colors',
            isOverlay
              ? 'text-primary-400 cursor-grabbing'
              : 'hover:text-surface-500 cursor-grab opacity-0 group-hover:opacity-100'
          )}
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span
          onClick={() => onSelect(conversation.id)}
          className={cn(
            'text-sm font-medium truncate flex-1 cursor-pointer',
            isPending ? 'text-warning-600 italic' : 'text-surface-900'
          )}
        >
          {customerName}
        </span>
        {conversation.is_ai_enabled && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 shrink-0">
            <Sparkles className="h-3 w-3 text-violet-600" />
          </span>
        )}
      </div>

      {/* Assigned vendor */}
      {conversation.assigned_profile && (
        <p className="text-[10px] text-surface-400 mb-1.5 ml-6">
          Asignado a <span className="font-medium text-surface-500">{conversation.assigned_profile.full_name}</span>
        </p>
      )}

      {/* Last message */}
      {conversation.last_message && (
        <p
          onClick={() => onSelect(conversation.id)}
          className="text-xs text-surface-500 mb-2 line-clamp-2 ml-6 cursor-pointer"
        >
          {truncate(conversation.last_message, 80)}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between ml-6">
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
        <div className="flex items-center gap-1.5">
          {conversation.last_message_at && (
            <span className="text-[10px] text-surface-400">
              {formatRelativeTime(conversation.last_message_at)}
            </span>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conversation.id);
              }}
              className={cn(
                'rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity',
                'text-surface-400 hover:bg-danger-50 hover:text-danger-500'
              )}
              title="Eliminar"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
function ConversationCanvas({ conversations, onSelect, onStatusChange, onDelete }: ConversationCanvasProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const grouped = useMemo(() => {
    const groups: Record<ConversationStatus, Conversation[]> = {
      nuevo: [],
      saludo_inicial: [],
      cotizando: [],
      ai_attended: [],       // legacy — not shown as a column
      payment_pending: [],
      immediate_attention: [],
      closed: [],
    };
    for (const c of conversations) {
      if (c.status === 'ai_attended') {
        // Legacy: map to saludo_inicial so cards remain visible
        groups.saludo_inicial.push(c);
      } else if (groups[c.status]) {
        groups[c.status].push(c);
      } else {
        groups.nuevo.push(c);
      }
    }
    for (const key of Object.keys(groups) as ConversationStatus[]) {
      groups[key].sort((a, b) => {
        const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return dateB - dateA;
      });
    }
    return groups;
  }, [conversations]);

  const activeConversation = useMemo(
    () => (activeId ? conversations.find((c) => c.id === activeId) : null),
    [activeId, conversations]
  );

  const findColumnForConversation = useCallback(
    (convId: string): ConversationStatus | null => {
      for (const col of columns) {
        if (grouped[col.key].some((c) => c.id === convId)) {
          return col.key;
        }
      }
      return null;
    },
    [grouped]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (!over) {
        setOverColumnId(null);
        return;
      }

      const overId = over.id as string;

      // Check if over a column directly
      const isColumn = columns.some((c) => c.key === overId);
      if (isColumn) {
        setOverColumnId(overId);
        return;
      }

      // Over a card — find which column it's in
      const col = findColumnForConversation(overId);
      setOverColumnId(col);
    },
    [findColumnForConversation]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverColumnId(null);

      if (!over) return;

      const convId = active.id as string;
      const overId = over.id as string;

      // Determine target column
      let targetColumn: ConversationStatus | null = null;

      const isColumn = columns.some((c) => c.key === overId);
      if (isColumn) {
        targetColumn = overId as ConversationStatus;
      } else {
        targetColumn = findColumnForConversation(overId);
      }

      if (!targetColumn) return;

      // Find current column
      const currentColumn = findColumnForConversation(convId);
      if (currentColumn === targetColumn) return;

      onStatusChange(convId, targetColumn);
    },
    [findColumnForConversation, onStatusChange]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverColumnId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-3 h-full overflow-x-auto p-1">
        {columns.map((col) => {
          const items = grouped[col.key];
          const isOver = overColumnId === col.key && activeId !== null;

          return (
            <div key={col.key} className="flex-1 min-w-[260px] flex flex-col">
              {/* Column header */}
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-t-xl border transition-colors duration-200',
                  col.color,
                  isOver && 'brightness-95'
                )}
              >
                <span className={cn('h-2.5 w-2.5 rounded-full', col.dotColor)} />
                <h3 className="text-xs font-semibold text-surface-800 truncate">{col.label}</h3>
                <span className="ml-auto text-[10px] font-medium text-surface-500 bg-white/80 rounded-full px-2 py-0.5">
                  {items.length}
                </span>
              </div>

              {/* Droppable area */}
              <SortableContext
                items={items.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <DroppableColumn id={col.key} isOver={isOver} dropHighlight={col.dropHighlight}>
                  <AnimatePresence mode="popLayout">
                    {items.map((conversation) => (
                      <motion.div
                        key={conversation.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                      >
                        <SortableCard
                          conversation={conversation}
                          onSelect={onSelect}
                          onDelete={onDelete}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {items.length === 0 && !isOver && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <MessageSquare className="h-6 w-6 text-surface-300 mb-1.5" />
                      <p className="text-xs text-surface-400">Sin conversaciones</p>
                    </div>
                  )}

                  {items.length === 0 && isOver && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <p className="text-xs text-surface-400 font-medium">Soltar aquí</p>
                    </div>
                  )}
                </DroppableColumn>
              </SortableContext>
            </div>
          );
        })}
      </div>

      {/* Drag overlay — follows the cursor */}
      <DragOverlay dropAnimation={{
        duration: 200,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}>
        {activeConversation ? (
          <div className="w-[260px] rounded-lg border border-primary-200 bg-white p-3 shadow-xl ring-2 ring-primary-300 rotate-[2deg] scale-[1.02] opacity-95">
            <ConversationCardContent
              conversation={activeConversation}
              onSelect={() => {}}
              isOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export { ConversationCanvas };
