import { create } from 'zustand';
import type { Profile, TeamInvitation, UserRole } from '@/types';
import { supabase } from '@/lib/supabase';
import { generateInviteCode } from '@/lib/utils';

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
  regenerateInviteCode: (teamId: string) => Promise<string>;
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
    } catch (err) {
      console.error('fetchMembers error:', err);
      set({ members: [] });
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
    } catch (err) {
      console.error('fetchInvitations error:', err);
      set({ invitations: [] });
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
      set({ members: get().members.filter((m) => m.id !== memberId) });
    } catch (err) {
      console.error('removeMember error:', err);
    } finally {
      set({ loading: false });
    }
  },

  acceptInvitation: async (invitationId: string) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('team_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);
      if (error) throw error;
      set({
        invitations: get().invitations.map((inv) =>
          inv.id === invitationId ? { ...inv, status: 'accepted' as const } : inv
        ),
      });
    } catch (err) {
      console.error('acceptInvitation error:', err);
    } finally {
      set({ loading: false });
    }
  },

  rejectInvitation: async (invitationId: string) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('team_invitations')
        .update({ status: 'rejected' })
        .eq('id', invitationId);
      if (error) throw error;
      set({
        invitations: get().invitations.map((inv) =>
          inv.id === invitationId ? { ...inv, status: 'rejected' as const } : inv
        ),
      });
    } catch (err) {
      console.error('rejectInvitation error:', err);
    } finally {
      set({ loading: false });
    }
  },

  updateMemberRole: async (memberId: string, role: UserRole) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', memberId);
      if (error) throw error;
      set({
        members: get().members.map((m) =>
          m.id === memberId ? { ...m, role } : m
        ),
      });
    } catch (err) {
      console.error('updateMemberRole error:', err);
    } finally {
      set({ loading: false });
    }
  },

  regenerateInviteCode: async (teamId: string) => {
    const newCode = generateInviteCode();
    const { error } = await supabase
      .from('teams')
      .update({ invite_code: newCode })
      .eq('id', teamId);
    if (error) throw error;
    return newCode;
  },
}));
