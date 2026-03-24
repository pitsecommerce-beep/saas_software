import { create } from 'zustand';
import type { Profile, TeamInvitation, UserRole } from '@/types';
import { supabase } from '@/lib/supabase';

// TODO: Remove mock data when Supabase is configured
const mockMembers: Profile[] = [
  {
    id: 'mock-user-1',
    email: 'demo@example.com',
    full_name: 'Demo User',
    role: 'gerente',
    team_id: 'mock-team-1',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-user-2',
    email: 'vendedor@example.com',
    full_name: 'Juan Vendedor',
    role: 'vendedor',
    team_id: 'mock-team-1',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-user-3',
    email: 'logistica@example.com',
    full_name: 'Laura Logística',
    role: 'logistica',
    team_id: 'mock-team-1',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

const mockInvitations: TeamInvitation[] = [
  {
    id: 'inv-1',
    team_id: 'mock-team-1',
    email: 'nuevo@example.com',
    role: 'vendedor',
    status: 'pending',
    created_at: new Date().toISOString(),
  },
];

interface TeamState {
  members: Profile[];
  invitations: TeamInvitation[];
  loading: boolean;
  fetchMembers: (teamId: string) => Promise<void>;
  fetchInvitations: (teamId: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  acceptInvitation: (invitationId: string) => Promise<void>;
  rejectInvitation: (invitationId: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: UserRole) => Promise<void>;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  members: [],
  invitations: [],
  loading: false,

  fetchMembers: async (teamId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      set({ members: data as Profile[] });
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock members');
      set({ members: mockMembers });
    } finally {
      set({ loading: false });
    }
  },

  fetchInvitations: async (teamId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ invitations: data as TeamInvitation[] });
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock invitations');
      set({ invitations: mockInvitations });
    } finally {
      set({ loading: false });
    }
  },

  removeMember: async (memberId: string) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: null, is_active: false })
        .eq('id', memberId);
      if (error) throw error;
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock removeMember');
    }

    set({ members: get().members.filter((m) => m.id !== memberId) });
    set({ loading: false });
  },

  acceptInvitation: async (invitationId: string) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('team_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);
      if (error) throw error;
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock acceptInvitation');
    }

    set({
      invitations: get().invitations.map((inv) =>
        inv.id === invitationId ? { ...inv, status: 'accepted' as const } : inv
      ),
    });
    set({ loading: false });
  },

  rejectInvitation: async (invitationId: string) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('team_invitations')
        .update({ status: 'rejected' })
        .eq('id', invitationId);
      if (error) throw error;
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock rejectInvitation');
    }

    set({
      invitations: get().invitations.map((inv) =>
        inv.id === invitationId ? { ...inv, status: 'rejected' as const } : inv
      ),
    });
    set({ loading: false });
  },

  updateMemberRole: async (memberId: string, role: UserRole) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', memberId);
      if (error) throw error;
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock updateMemberRole');
    }

    set({
      members: get().members.map((m) =>
        m.id === memberId ? { ...m, role } : m
      ),
    });
    set({ loading: false });
  },
}));
