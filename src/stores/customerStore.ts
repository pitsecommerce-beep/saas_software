import { create } from 'zustand';
import type { Customer } from '@/types';
import { supabase } from '@/lib/supabase';

// TODO: Remove mock data when Supabase is configured
const mockCustomers: Customer[] = [
  {
    id: 'cust-1',
    team_id: 'mock-team-1',
    name: 'María García',
    email: 'maria@example.com',
    phone: '+52 555 1234',
    channel: 'whatsapp',
    channel_id: '+52 555 1234',
    notes: 'Cliente frecuente',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cust-2',
    team_id: 'mock-team-1',
    name: 'Carlos López',
    phone: '+52 555 5678',
    channel: 'instagram',
    channel_id: '@carloslopez',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cust-3',
    team_id: 'mock-team-1',
    name: 'Ana Martínez',
    email: 'ana@example.com',
    phone: '+52 555 9012',
    channel: 'messenger',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

interface CustomerState {
  customers: Customer[];
  loading: boolean;
  searchQuery: string;
  fetchCustomers: (teamId: string) => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  importFromExcel: (teamId: string, data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>[]) => Promise<void>;
  setCustomers: (customers: Customer[]) => void;
  setSearchQuery: (query: string) => void;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  loading: false,
  searchQuery: '',

  fetchCustomers: async (teamId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*, assigned_profile:profiles(*)')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ customers: data as Customer[] });
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock customers');
      set({ customers: mockCustomers });
    } finally {
      set({ loading: false });
    }
  },

  addCustomer: async (customer) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert(customer)
        .select()
        .single();
      if (error) throw error;
      set({ customers: [data as Customer, ...get().customers] });
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock addCustomer');
      const mockNew: Customer = {
        ...customer,
        id: `cust-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Customer;
      set({ customers: [mockNew, ...get().customers] });
    } finally {
      set({ loading: false });
    }
  },

  updateCustomer: async (id: string, data: Partial<Customer>) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('customers')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock updateCustomer');
    }

    set({
      customers: get().customers.map((c) =>
        c.id === id ? { ...c, ...data, updated_at: new Date().toISOString() } : c
      ),
    });
    set({ loading: false });
  },

  deleteCustomer: async (id: string) => {
    set({ loading: true });
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock deleteCustomer');
    }

    set({ customers: get().customers.filter((c) => c.id !== id) });
    set({ loading: false });
  },

  importFromExcel: async (teamId: string, data) => {
    set({ loading: true });
    try {
      const rows = data.map((row) => ({ ...row, team_id: teamId }));
      const { data: inserted, error } = await supabase
        .from('customers')
        .insert(rows)
        .select();
      if (error) throw error;
      set({ customers: [...(inserted as Customer[]), ...get().customers] });
    } catch {
      // TODO: Remove mock data when Supabase is configured
      console.warn('Supabase not configured, using mock importFromExcel');
      const mockImported: Customer[] = data.map((row, i) => ({
        ...row,
        id: `cust-import-${Date.now()}-${i}`,
        team_id: teamId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })) as Customer[];
      set({ customers: [...mockImported, ...get().customers] });
    } finally {
      set({ loading: false });
    }
  },

  setCustomers: (customers: Customer[]) => {
    set({ customers });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },
}));
