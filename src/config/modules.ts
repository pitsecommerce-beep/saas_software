import type { ModuleDefinition } from '@/types';

export const MODULES: ModuleDefinition[] = [
  {
    id: 'crm',
    name: 'CRM & Atención',
    description: 'Gestión de clientes, conversaciones y cotizaciones con IA',
    icon: 'MessageSquare',
    route: '/dashboard',
    requiredRoles: ['gerente', 'vendedor'],
    isAvailable: true,
  },
  {
    id: 'logistics',
    name: 'Logística',
    description: 'Seguimiento de pedidos, rutas y entregas',
    icon: 'Truck',
    route: '/logistics',
    requiredRoles: ['gerente', 'vendedor', 'logistica'],
    isAvailable: false,
  },
  {
    id: 'warehouse',
    name: 'Almacén',
    description: 'Inventario, SKUs, bodegas y gestión de precios',
    icon: 'Warehouse',
    route: '/warehouse',
    requiredRoles: ['gerente', 'logistica'],
    isAvailable: false,
  },
  {
    id: 'services',
    name: 'Servicios',
    description: 'Agendamiento de citas, clases y membresías',
    icon: 'Calendar',
    route: '/services',
    requiredRoles: ['gerente', 'vendedor'],
    isAvailable: false,
  },
];

export const AI_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', recommended: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', recommended: true },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', recommended: false },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', recommended: true },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', recommended: true },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', recommended: false },
    ],
  },
  {
    id: 'google',
    name: 'Google AI',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', recommended: true },
      { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', recommended: false },
    ],
  },
];

export const ORDER_STATUSES = [
  { id: 'curioso', label: 'Curioso', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { id: 'cotizando', label: 'Cotizando', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'pendiente_pago', label: 'Pendiente de Pago', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { id: 'pendiente_surtir', label: 'Pendiente de Surtir', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'pendiente_enviar', label: 'Pendiente de Enviar', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'enviado', label: 'Enviado', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { id: 'entregado', label: 'Entregado', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'cancelado', label: 'Cancelado', color: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'requiere_atencion', label: 'Requiere Atención', color: 'bg-red-200 text-red-800 border-red-300' },
] as const;

export const CHANNELS: { id: string; label: string; color: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp', color: 'bg-green-100 text-green-700' },
  { id: 'instagram', label: 'Instagram', color: 'bg-pink-100 text-pink-700' },
  { id: 'messenger', label: 'Messenger', color: 'bg-blue-100 text-blue-700' },
];
