export type UserRole = 'gerente' | 'vendedor' | 'logistica';
export type BusinessType = 'retailer' | 'servicios';
export type ConversationStatus = 'nuevo' | 'saludo_inicial' | 'cotizando' | 'ai_attended' | 'payment_pending' | 'immediate_attention' | 'closed';
export type MessageSender = 'customer' | 'agent' | 'ai';
export type ChannelType = 'whatsapp' | 'instagram' | 'messenger';

export type OrderStatus =
  | 'curioso'
  | 'cotizando'
  | 'pendiente_pago'
  | 'pendiente_surtir'
  | 'pendiente_enviar'
  | 'enviado'
  | 'entregado'
  | 'cancelado'
  | 'requiere_atencion';

export type DeliveryMethod = 'cliente_recoge' | 'envio_directo' | 'envio_en_ruta';

export const DEFAULT_CUSTOMER_DISCOUNT = 40;

export interface Team {
  id: string;
  name: string;
  invite_code: string;
  business_type: BusinessType;
  active_modules: string[];
  created_at: string;
  owner_id: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  team_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  team_id: string;
  name: string;
  email?: string;
  phone?: string;
  channel: ChannelType;
  channel_id?: string;
  rfc?: string;
  delivery_address?: string;
  discount_percentage?: number;
  notes?: string;
  assigned_to?: string;
  assigned_profile?: Profile;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  team_id: string;
  customer_id?: string;
  customer?: Customer;
  assigned_to?: string;
  assigned_profile?: Profile;
  channel: ChannelType;
  channel_contact_id: string;
  status: ConversationStatus;
  is_ai_enabled: boolean;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: MessageSender;
  sender_id?: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface AIAgent {
  id: string;
  team_id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  api_key_encrypted: string;
  system_prompt: string;
  is_active: boolean;
  enabled_tools?: string[];
  created_at: string;
}

export interface Order {
  id: string;
  team_id: string;
  customer_id?: string;
  customer?: Customer;
  conversation_id?: string;
  conversation?: Conversation;
  seller_id?: string;
  seller?: Profile;
  status: OrderStatus;
  total?: number;
  notes?: string;
  delivery_method?: DeliveryMethod;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  knowledge_row_id?: string;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface ChannelAssignment {
  id: string;
  team_id: string;
  agent_id: string;
  agent?: AIAgent;
  channel: ChannelType;
  channel_identifier: string;
  label?: string;
  created_at: string;
}

export interface KnowledgeBase {
  id: string;
  team_id: string;
  name: string;
  description?: string;
  file_url: string;
  row_count: number;
  is_queryable: boolean;
  created_at: string;
}

export interface KnowledgeColumn {
  id: string;
  knowledge_base_id: string;
  column_name: string;
  description: string;
  data_type: string;
}

export interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  role: UserRole;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface DashboardMetrics {
  totalConversations: number;
  activeConversations: number;
  avgResponseTime: number;
  customerSatisfaction: number;
  totalCustomers: number;
  newCustomersThisMonth: number;
  conversationsByChannel: { channel: string; count: number }[];
  conversationsByDay: { date: string; count: number }[];
  vendorPerformance: {
    name: string;
    conversations: number;
    avgResponseTime: number;
    resolved: number;
  }[];
}

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  requiredRoles: UserRole[];
  isAvailable: boolean;
}
