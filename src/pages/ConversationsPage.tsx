'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, LayoutGrid, Plus, MessageSquare, Search, MessageCircle, MessagesSquare, Send } from 'lucide-react';
import { useDemoStore } from '@/stores/demoStore';
import { useAuthStore } from '@/stores/authStore';
import type { Conversation, Message, ConversationStatus, Customer, ChannelType, Profile } from '@/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConversationList } from '@/components/conversations/ConversationList';
import { ConversationCanvas } from '@/components/conversations/ConversationCanvas';
import { ChatWindow } from '@/components/conversations/ChatWindow';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/config';

// ---------------------------------------------------------------------------
// Mock data (fallback for demo mode)
// ---------------------------------------------------------------------------

const now = new Date();
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000).toISOString();

const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    team_id: 'team-1',
    customer_id: 'cust-1',
    customer: {
      id: 'cust-1',
      team_id: 'team-1',
      name: 'Maria Garcia Lopez',
      email: 'maria@email.com',
      phone: '+52 55 1234 5678',
      channel: 'whatsapp',
      channel_id: '5215512345678',
      created_at: minutesAgo(10080),
      updated_at: minutesAgo(5),
    },
    assigned_to: 'profile-1',
    assigned_profile: {
      id: 'profile-1',
      email: 'carlos@empresa.com',
      full_name: 'Carlos Mendez',
      role: 'vendedor',
      is_active: true,
      created_at: minutesAgo(43200),
    },
    channel: 'whatsapp',
    channel_contact_id: '5215512345678',
    status: 'nuevo',
    is_ai_enabled: true,
    last_message: 'Perfecto, me interesa el paquete premium. Cual es el precio mayoreo?',
    last_message_at: minutesAgo(2),
    unread_count: 3,
    created_at: minutesAgo(1440),
  },
  {
    id: 'conv-2',
    team_id: 'team-1',
    customer_id: 'cust-2',
    customer: {
      id: 'cust-2',
      team_id: 'team-1',
      name: 'Roberto Hernandez',
      phone: '+52 33 9876 5432',
      channel: 'whatsapp',
      channel_id: '5213398765432',
      created_at: minutesAgo(20160),
      updated_at: minutesAgo(30),
    },
    channel: 'whatsapp',
    channel_contact_id: '5213398765432',
    status: 'ai_attended',
    is_ai_enabled: false,
    last_message: 'Ya realice la transferencia, les envio el comprobante',
    last_message_at: minutesAgo(30),
    unread_count: 1,
    created_at: minutesAgo(4320),
  },
];

const mockMessages: Record<string, Message[]> = {
  'conv-1': [
    {
      id: 'msg-1-1',
      conversation_id: 'conv-1',
      sender_type: 'customer',
      content: 'Hola, buenas tardes! Me interesa cotizar sus productos para mi tienda.',
      created_at: minutesAgo(60),
    },
    {
      id: 'msg-1-2',
      conversation_id: 'conv-1',
      sender_type: 'ai',
      content: 'Hola Maria! Con gusto te ayudo con la cotizacion.',
      created_at: minutesAgo(59),
    },
  ],
  'conv-2': [
    {
      id: 'msg-2-1',
      conversation_id: 'conv-2',
      sender_type: 'customer',
      content: 'Buenos dias, ya quiero finalizar mi pedido del mes.',
      created_at: minutesAgo(180),
    },
  ],
};

const mockCustomerList: Customer[] = [
  { id: 'cust-1', team_id: 'team-1', name: 'Maria Garcia Lopez', email: 'maria@email.com', phone: '+52 55 1234 5678', channel: 'whatsapp', channel_id: '5215512345678', created_at: '', updated_at: '' },
  { id: 'cust-2', team_id: 'team-1', name: 'Roberto Hernandez', phone: '+52 33 9876 5432', channel: 'whatsapp', channel_id: '5213398765432', created_at: '', updated_at: '' },
];

// ---------------------------------------------------------------------------
// Channel options
// ---------------------------------------------------------------------------

const CHANNEL_OPTIONS: { value: ChannelType; label: string; icon: typeof MessageCircle }[] = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'instagram', label: 'Instagram', icon: MessageCircle },
  { value: 'messenger', label: 'Messenger', icon: MessagesSquare },
];

const channelColors: Record<ChannelType, string> = {
  whatsapp: 'text-green-600 bg-green-50',
  instagram: 'text-pink-600 bg-pink-50',
  messenger: 'text-blue-600 bg-blue-50',
};

type ViewMode = 'list' | 'canvas';

function getInitialViewMode(): ViewMode {
  try {
    const saved = localStorage.getItem('conversations_view_mode');
    if (saved === 'list' || saved === 'canvas') return saved;
  } catch { /* ignore */ }
  return 'list';
}

export default function ConversationsPage() {
  const { isDemoMode } = useDemoStore();
  const { profile } = useAuthStore();
  const teamId = profile?.team_id;

  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [, setMessagesLoading] = useState(false);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [newConvModalOpen, setNewConvModalOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // New conversation form state
  const [newConvSearch, setNewConvSearch] = useState('');
  const [newConvCustomer, setNewConvCustomer] = useState<Customer | null>(null);
  const [newConvChannel, setNewConvChannel] = useState<ChannelType | null>(null);
  const [newConvMessage, setNewConvMessage] = useState('');
  const [newConvSending, setNewConvSending] = useState(false);

  // Vendor assignment state
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendors, setVendors] = useState<Profile[]>([]);
  const [vendorsLoaded, setVendorsLoaded] = useState(false);

  // Persist view mode preference
  const handleSetViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem('conversations_view_mode', mode); } catch { /* ignore */ }
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch real data from Supabase
  // ---------------------------------------------------------------------------

  const loadVendors = useCallback(async () => {
    if (!isSupabaseConfigured || !teamId) {
      if (isDemoMode) {
        setVendors([
          { id: 'profile-1', email: 'carlos@empresa.com', full_name: 'Carlos Mendez', role: 'vendedor', is_active: true, created_at: '' },
          { id: 'profile-2', email: 'ana@empresa.com', full_name: 'Ana Torres', role: 'vendedor', is_active: true, created_at: '' },
        ]);
      }
      setVendorsLoaded(true);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('team_id', teamId)
        .in('role', ['vendedor', 'gerente'])
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      setVendors((data as Profile[]) ?? []);
    } catch (err) {
      console.error('Error loading vendors:', err);
    } finally {
      setVendorsLoaded(true);
    }
  }, [teamId, isDemoMode]);

  const loadConversations = useCallback(async () => {
    if (!isSupabaseConfigured || !teamId) {
      if (isDemoMode) setConversations(mockConversations);
      setDataLoaded(true);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, customer:customers(*), assigned_profile:profiles(*)')
        .eq('team_id', teamId)
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      setConversations((data as Conversation[]) ?? []);
    } catch (err) {
      console.error('Error loading conversations:', err);
      if (isDemoMode) setConversations(mockConversations);
    } finally {
      setDataLoaded(true);
    }
  }, [teamId, isDemoMode]);

  const loadCustomers = useCallback(async () => {
    if (!isSupabaseConfigured || !teamId) {
      if (isDemoMode) setCustomers(mockCustomerList);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('team_id', teamId)
        .order('name');
      if (error) throw error;
      setCustomers((data as Customer[]) ?? []);
    } catch (err) {
      console.error('Error loading customers:', err);
      if (isDemoMode) setCustomers(mockCustomerList);
    }
  }, [teamId, isDemoMode]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!isSupabaseConfigured) {
      if (isDemoMode) setMessages(mockMessages[conversationId] ?? []);
      return;
    }
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages((data as Message[]) ?? []);
    } catch (err) {
      console.error('Error loading messages:', err);
      if (isDemoMode) setMessages(mockMessages[conversationId] ?? []);
    } finally {
      setMessagesLoading(false);
    }
  }, [isDemoMode]);

  // Initial data load
  useEffect(() => {
    if (!dataLoaded) {
      loadConversations();
      loadCustomers();
    }
    if (!vendorsLoaded) {
      loadVendors();
    }
  }, [loadConversations, loadCustomers, loadVendors, dataLoaded, vendorsLoaded]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, loadMessages]);

  // Realtime subscription for new messages and conversation updates
  useEffect(() => {
    if (!isSupabaseConfigured || !teamId) return;

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          // If this message belongs to the active conversation, add it
          if (newMsg.conversation_id === activeConversationId) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
          // Refresh conversation list to update last_message
          loadConversations();
        }
      )
      .subscribe();

    // Subscribe to conversation updates
    const convsChannel = supabase
      .channel('conversations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `team_id=eq.${teamId}` },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(convsChannel);
    };
  }, [teamId, activeConversationId, loadConversations]);

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const filteredCustomers = useMemo(() => {
    const q = newConvSearch.toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
    );
  }, [newConvSearch, customers]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleOpenNewConv = () => {
    setNewConvSearch('');
    setNewConvCustomer(null);
    setNewConvChannel(null);
    setNewConvMessage('');
    setNewConvModalOpen(true);
  };

  const handleSendNewConversation = async (e: FormEvent) => {
    e.preventDefault();
    if (!newConvCustomer || !newConvChannel || !newConvMessage.trim()) return;
    setNewConvSending(true);

    if (isSupabaseConfigured && teamId) {
      try {
        // Create conversation in Supabase
        const { data: newConv, error: convErr } = await supabase
          .from('conversations')
          .insert({
            team_id: teamId,
            customer_id: newConvCustomer.id,
            channel: newConvChannel,
            channel_contact_id: newConvCustomer.channel_id ?? newConvCustomer.id,
            status: 'nuevo' as ConversationStatus,
            is_ai_enabled: false,
            last_message: newConvMessage.trim(),
            last_message_at: new Date().toISOString(),
          })
          .select('*, customer:customers(*), assigned_profile:profiles(*)')
          .single();
        if (convErr) throw convErr;

        // Create first message
        await supabase.from('messages').insert({
          conversation_id: newConv.id,
          sender_type: 'agent',
          content: newConvMessage.trim(),
        });

        setConversations((prev) => [newConv as Conversation, ...prev]);
        setActiveConversationId(newConv.id);
        setNewConvModalOpen(false);
      } catch (err) {
        console.error('Error creating conversation:', err);
      }
    } else {
      // Mock mode
      const newConv: Conversation = {
        id: `conv-new-${Date.now()}`,
        team_id: 'team-1',
        customer_id: newConvCustomer.id,
        customer: newConvCustomer,
        channel: newConvChannel,
        channel_contact_id: newConvCustomer.channel_id ?? newConvCustomer.id,
        status: 'nuevo',
        is_ai_enabled: false,
        last_message: newConvMessage.trim(),
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        created_at: new Date().toISOString(),
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setNewConvModalOpen(false);
    }
    setNewConvSending(false);
  };

  const handleSelect = useCallback(
    (id: string) => {
      setActiveConversationId(id);
      if (viewMode === 'canvas') {
        setChatModalOpen(true);
      }
    },
    [viewMode]
  );

  const handleStatusChange = useCallback(
    async (id: string, newStatus: ConversationStatus) => {
      if (isSupabaseConfigured) {
        await supabase.from('conversations').update({ status: newStatus }).eq('id', id);
      }
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
      );
    },
    []
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!activeConversationId) return;

      const apiUrl = import.meta.env.VITE_API_URL;

      if (isSupabaseConfigured && apiUrl) {
        try {
          // Send through backend API which handles YCloud delivery + DB persistence
          const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/messages/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversation_id: activeConversationId,
              content,
            }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('Send message API error:', errData);
            // Still save locally even if YCloud delivery fails
          }

          // Optimistically add message to UI (backend already saved it)
          const nowStr = new Date().toISOString();
          const optimisticMsg: Message = {
            id: `msg-pending-${Date.now()}`,
            conversation_id: activeConversationId,
            sender_type: 'agent',
            content,
            created_at: nowStr,
          };
          setMessages((prev) => [...prev, optimisticMsg]);
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConversationId
                ? { ...c, last_message: content, last_message_at: nowStr }
                : c
            )
          );
        } catch (err) {
          console.error('Error sending message:', err);
          // Fallback: save directly to Supabase without YCloud delivery
          const { data: newMsg } = await supabase
            .from('messages')
            .insert({
              conversation_id: activeConversationId,
              sender_type: 'agent',
              content,
            })
            .select()
            .single();
          if (newMsg) {
            setMessages((prev) => [...prev, newMsg as Message]);
          }
        }
      } else if (isSupabaseConfigured) {
        // Supabase configured but no backend URL - save to DB only (no YCloud delivery)
        try {
          const { data: newMsg, error } = await supabase
            .from('messages')
            .insert({
              conversation_id: activeConversationId,
              sender_type: 'agent',
              content,
            })
            .select()
            .single();
          if (error) throw error;
          setMessages((prev) => [...prev, newMsg as Message]);
          await supabase
            .from('conversations')
            .update({
              last_message: content,
              last_message_at: new Date().toISOString(),
            })
            .eq('id', activeConversationId);
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConversationId
                ? { ...c, last_message: content, last_message_at: new Date().toISOString() }
                : c
            )
          );
        } catch (err) {
          console.error('Error sending message:', err);
        }
      } else {
        // Mock mode
        const newMsg: Message = {
          id: `msg-new-${Date.now()}`,
          conversation_id: activeConversationId,
          sender_type: 'agent',
          content,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newMsg]);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId
              ? { ...c, last_message: content, last_message_at: newMsg.created_at }
              : c
          )
        );
      }
    },
    [activeConversationId]
  );

  const handleToggleAI = useCallback(
    async (enabled: boolean) => {
      if (!activeConversationId) return;
      if (isSupabaseConfigured) {
        await supabase
          .from('conversations')
          .update({ is_ai_enabled: enabled })
          .eq('id', activeConversationId);
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId ? { ...c, is_ai_enabled: enabled } : c
        )
      );
    },
    [activeConversationId]
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      if (isSupabaseConfigured && teamId) {
        try {
          // Delete messages first (cascade should handle it, but be explicit)
          await supabase.from('messages').delete().eq('conversation_id', id);
          const { error } = await supabase
            .from('conversations')
            .delete()
            .eq('id', id)
            .eq('team_id', teamId);
          if (error) throw error;
        } catch (err) {
          console.error('Error deleting conversation:', err);
          return;
        }
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    },
    [teamId, activeConversationId]
  );

  const handleAssignVendor = useCallback(() => {
    setVendorModalOpen(true);
  }, []);

  const handleConfirmAssignVendor = useCallback(
    async (vendorId: string) => {
      if (!activeConversationId) return;
      if (isSupabaseConfigured) {
        try {
          await supabase
            .from('conversations')
            .update({ assigned_to: vendorId })
            .eq('id', activeConversationId);
        } catch (err) {
          console.error('Error assigning vendor:', err);
        }
      }
      const vendor = vendors.find((v) => v.id === vendorId);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? { ...c, assigned_to: vendorId, assigned_profile: vendor }
            : c
        )
      );
      setVendorModalOpen(false);
    },
    [activeConversationId, vendors]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 bg-white">
        <div>
          <h1 className="text-xl font-bold text-surface-900">Conversaciones</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            {conversations.length} conversaciones totales
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-surface-200 bg-surface-50 p-0.5">
            <button
              onClick={() => handleSetViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200',
                viewMode === 'list'
                  ? 'bg-white text-surface-900 shadow-sm'
                  : 'text-surface-500 hover:text-surface-700'
              )}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
            <button
              onClick={() => handleSetViewMode('canvas')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200',
                viewMode === 'canvas'
                  ? 'bg-white text-surface-900 shadow-sm'
                  : 'text-surface-500 hover:text-surface-700'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Canvas
            </button>
          </div>

          <Button
            size="sm"
            onClick={handleOpenNewConv}
            icon={<Plus className="h-4 w-4" />}
          >
            Nueva conversacion
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.div
              key="list-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex h-full"
            >
              {/* Conversation list panel */}
              <div className="w-1/3 min-w-[320px] max-w-[400px] h-full">
                <ConversationList
                  conversations={conversations}
                  activeId={activeConversationId}
                  onSelect={handleSelect}
                  onDelete={handleDeleteConversation}
                />
              </div>

              {/* Chat panel */}
              <div className="flex-1 h-full">
                {activeConversation ? (
                  <ChatWindow
                    conversation={activeConversation}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    onToggleAI={handleToggleAI}
                    onAssignVendor={handleAssignVendor}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center bg-surface-50/50">
                    <div className="rounded-2xl bg-surface-100 p-4 mb-4">
                      <MessageSquare className="h-8 w-8 text-surface-400" />
                    </div>
                    <h3 className="text-base font-medium text-surface-700 mb-1">
                      Selecciona una conversacion
                    </h3>
                    <p className="text-sm text-surface-500 max-w-xs">
                      Elige una conversacion de la lista para ver los mensajes y responder
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="canvas-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full p-4"
            >
              <ConversationCanvas
                conversations={conversations}
                onSelect={handleSelect}
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteConversation}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nueva conversación modal */}
      <Modal
        isOpen={newConvModalOpen}
        onClose={() => setNewConvModalOpen(false)}
        title="Nueva conversación"
        size="md"
      >
        <form onSubmit={handleSendNewConversation} className="space-y-5">
          {/* Step 1: pick customer */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-surface-700">1. Selecciona un cliente</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, correo o teléfono..."
                value={newConvSearch}
                onChange={(e) => setNewConvSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-surface-200 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-surface-200 divide-y divide-surface-100">
              {filteredCustomers.length === 0 ? (
                <p className="text-center text-sm text-surface-400 py-4">Sin resultados</p>
              ) : (
                filteredCustomers.map((c) => {
                  const isSelected = newConvCustomer?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setNewConvCustomer(c);
                        setNewConvChannel(c.channel);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-50 ${
                        isSelected ? 'bg-primary-50' : 'bg-white'
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-100 text-xs font-bold text-surface-600">
                        {c.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-surface-900 truncate">{c.name}</p>
                        <p className="text-xs text-surface-400 truncate">{c.email ?? c.phone ?? c.channel}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${channelColors[c.channel]}`}>
                        {c.channel}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            {newConvCustomer && (
              <p className="text-xs text-primary-600 font-medium">
                {newConvCustomer.name} seleccionado
              </p>
            )}
          </div>

          {/* Step 2: pick channel */}
          <AnimatePresence>
            {newConvCustomer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-2"
              >
                <p className="text-sm font-medium text-surface-700">2. Canal de contacto</p>
                <div className="flex gap-2">
                  {CHANNEL_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setNewConvChannel(value)}
                      className={`flex-1 flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 transition-all ${
                        newConvChannel === value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-surface-200 bg-white hover:border-surface-300'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${newConvChannel === value ? 'text-primary-500' : 'text-surface-400'}`} />
                      <span className="text-xs font-medium text-surface-700">{label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 3: message */}
          <AnimatePresence>
            {newConvCustomer && newConvChannel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-2"
              >
                <p className="text-sm font-medium text-surface-700">3. Mensaje inicial</p>
                <textarea
                  rows={3}
                  placeholder="Escribe el primer mensaje para este cliente..."
                  value={newConvMessage}
                  onChange={(e) => setNewConvMessage(e.target.value)}
                  required
                  className="w-full rounded-lg border border-surface-200 px-3.5 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setNewConvModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!newConvCustomer || !newConvChannel || !newConvMessage.trim()}
              loading={newConvSending}
              icon={<Send className="h-4 w-4" />}
            >
              Enviar mensaje
            </Button>
          </div>
        </form>
      </Modal>

      {/* Chat modal for canvas view */}
      {viewMode === 'canvas' && activeConversation && (
        <Modal
          isOpen={chatModalOpen}
          onClose={() => setChatModalOpen(false)}
          title={activeConversation.customer?.name ?? 'Cliente Pendiente'}
          size="lg"
        >
          <div className="h-[60vh] -mx-6 -mb-4">
            <ChatWindow
              conversation={activeConversation}
              messages={messages}
              onSendMessage={handleSendMessage}
              onToggleAI={handleToggleAI}
              onAssignVendor={handleAssignVendor}
            />
          </div>
        </Modal>
      )}

      {/* Vendor assignment modal */}
      <Modal
        isOpen={vendorModalOpen}
        onClose={() => setVendorModalOpen(false)}
        title="Asignar vendedor"
        size="sm"
      >
        <div className="space-y-2">
          <p className="text-sm text-surface-500 mb-3">
            Selecciona un vendedor para esta conversación
          </p>
          {vendors.length === 0 ? (
            <p className="text-center text-sm text-surface-400 py-6">No hay vendedores disponibles</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-surface-200 divide-y divide-surface-100">
              {vendors.map((vendor) => {
                const isAssigned = activeConversation?.assigned_to === vendor.id;
                return (
                  <button
                    key={vendor.id}
                    type="button"
                    onClick={() => handleConfirmAssignVendor(vendor.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-50',
                      isAssigned ? 'bg-primary-50' : 'bg-white'
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600">
                      {vendor.full_name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-surface-900 truncate">{vendor.full_name}</p>
                      <p className="text-xs text-surface-400 truncate">{vendor.email}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-100 text-surface-500 capitalize">
                      {vendor.role}
                    </span>
                    {isAssigned && (
                      <span className="shrink-0 text-[10px] font-medium text-primary-500">Asignado</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {activeConversation?.assigned_to && (
            <button
              type="button"
              onClick={() => handleConfirmAssignVendor('')}
              className="w-full mt-2 text-sm text-danger-500 hover:text-danger-600 font-medium py-2"
            >
              Quitar asignación
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
