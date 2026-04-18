import { create } from 'zustand';
import type { Conversation, Message } from '@/types';
import { supabase } from '@/lib/supabase';

// TODO: Remove mock data when Supabase is configured
const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    team_id: 'mock-team-1',
    customer_id: 'cust-1',
    customer: {
      id: 'cust-1',
      team_id: 'mock-team-1',
      name: 'María García',
      email: 'maria@example.com',
      phone: '+52 555 1234',
      channel: 'whatsapp',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    channel: 'whatsapp',
    channel_contact_id: '+52 555 1234',
    status: 'nuevo',
    is_ai_enabled: true,
    last_message: 'Hola, necesito información sobre precios',
    last_message_at: new Date().toISOString(),
    unread_count: 2,
    created_at: new Date().toISOString(),
  },
  {
    id: 'conv-2',
    team_id: 'mock-team-1',
    customer_id: 'cust-2',
    customer: {
      id: 'cust-2',
      team_id: 'mock-team-1',
      name: 'Carlos López',
      phone: '+52 555 5678',
      channel: 'instagram',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    channel: 'instagram',
    channel_contact_id: '@carloslopez',
    status: 'saludo_inicial',
    is_ai_enabled: false,
    last_message: '¿Tienen envío a Guadalajara?',
    last_message_at: new Date(Date.now() - 3600000).toISOString(),
    unread_count: 1,
    created_at: new Date().toISOString(),
  },
];

const mockMessages: Message[] = [
  {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_type: 'customer',
    content: 'Hola, necesito información sobre precios',
    created_at: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: 'msg-2',
    conversation_id: 'conv-1',
    sender_type: 'ai',
    content: '¡Hola María! Con gusto te ayudo. ¿Qué producto te interesa?',
    created_at: new Date().toISOString(),
  },
];

interface ConversationState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  viewMode: 'list' | 'canvas';
  fetchConversations: (teamId: string) => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, senderType: string) => Promise<void>;
  setActiveConversation: (conversation: Conversation | null) => void;
  toggleAI: (conversationId: string, enabled: boolean) => Promise<void>;
  assignVendor: (conversationId: string, vendorId: string) => Promise<void>;
  setViewMode: (mode: 'list' | 'canvas') => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  loading: false,
  viewMode: 'list',

  fetchConversations: async (teamId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, customer:customers(*), assigned_profile:profiles(*)')
        .eq('team_id', teamId)
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      set({ conversations: data as Conversation[] });
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock conversations');
      set({ conversations: mockConversations });
    } finally {
      set({ loading: false });
    }
  },

  fetchMessages: async (conversationId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      set({ messages: data as Message[] });
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock messages');
      set({ messages: mockMessages.filter((m) => m.conversation_id === conversationId) });
    } finally {
      set({ loading: false });
    }
  },

  sendMessage: async (conversationId: string, content: string, senderType: string) => {
    try {
      const newMessage: Partial<Message> = {
        conversation_id: conversationId,
        sender_type: senderType as Message['sender_type'],
        content,
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(newMessage)
        .select()
        .single();
      if (error) throw error;

      set({ messages: [...get().messages, data as Message] });

      await supabase
        .from('conversations')
        .update({ last_message: content, last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock sendMessage');
      const mockMsg: Message = {
        id: `msg-${Date.now()}`,
        conversation_id: conversationId,
        sender_type: senderType as Message['sender_type'],
        content,
        created_at: new Date().toISOString(),
      };
      set({ messages: [...get().messages, mockMsg] });
    }
  },

  setActiveConversation: (conversation: Conversation | null) => {
    set({ activeConversation: conversation });
  },

  toggleAI: async (conversationId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ is_ai_enabled: enabled })
        .eq('id', conversationId);
      if (error) throw error;
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock toggleAI');
    }

    set({
      conversations: get().conversations.map((c) =>
        c.id === conversationId ? { ...c, is_ai_enabled: enabled } : c
      ),
      activeConversation:
        get().activeConversation?.id === conversationId
          ? { ...get().activeConversation!, is_ai_enabled: enabled }
          : get().activeConversation,
    });
  },

  assignVendor: async (conversationId: string, vendorId: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ assigned_to: vendorId })
        .eq('id', conversationId);
      if (error) throw error;
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock assignVendor');
    }

    set({
      conversations: get().conversations.map((c) =>
        c.id === conversationId ? { ...c, assigned_to: vendorId } : c
      ),
    });
  },

  setViewMode: (mode: 'list' | 'canvas') => {
    set({ viewMode: mode });
  },
}));
