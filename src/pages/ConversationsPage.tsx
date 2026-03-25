'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, LayoutGrid, Plus, MessageSquare, Settings } from 'lucide-react';
import { useDemoStore } from '@/stores/demoStore';
import { useNavigate } from 'react-router-dom';
import type { Conversation, Message, ConversationStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConversationList } from '@/components/conversations/ConversationList';
import { ConversationCanvas } from '@/components/conversations/ConversationCanvas';
import { ChatWindow } from '@/components/conversations/ChatWindow';
import { cn } from '@/lib/utils';

// TODO: Replace with useConversationStore when Supabase is connected

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
    status: 'active',
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
    status: 'active',
    is_ai_enabled: false,
    last_message: 'Ya realice la transferencia, les envio el comprobante',
    last_message_at: minutesAgo(30),
    unread_count: 1,
    created_at: minutesAgo(4320),
  },
  {
    id: 'conv-3',
    team_id: 'team-1',
    channel: 'instagram',
    channel_contact_id: 'ig_user_42398',
    status: 'pending',
    is_ai_enabled: true,
    last_message: 'Hola! Vi su publicacion de los productos nuevos, tienen disponibles?',
    last_message_at: minutesAgo(15),
    unread_count: 2,
    created_at: minutesAgo(15),
  },
  {
    id: 'conv-4',
    team_id: 'team-1',
    customer_id: 'cust-4',
    customer: {
      id: 'cust-4',
      team_id: 'team-1',
      name: 'Ana Sofia Ramirez',
      email: 'ana.ramirez@gmail.com',
      phone: '+52 81 5555 1234',
      channel: 'messenger',
      channel_id: 'fb_ana_ramirez',
      created_at: minutesAgo(30240),
      updated_at: minutesAgo(120),
    },
    channel: 'messenger',
    channel_contact_id: 'fb_ana_ramirez',
    status: 'active',
    is_ai_enabled: true,
    last_message: 'Gracias por la cotizacion, lo reviso con mi equipo y les confirmo manana',
    last_message_at: minutesAgo(120),
    unread_count: 0,
    created_at: minutesAgo(10080),
  },
  {
    id: 'conv-5',
    team_id: 'team-1',
    channel: 'whatsapp',
    channel_contact_id: '5214491234567',
    status: 'pending',
    is_ai_enabled: false,
    last_message: 'Buenas tardes, quisiera informacion sobre sus servicios de logistica',
    last_message_at: minutesAgo(45),
    unread_count: 1,
    created_at: minutesAgo(45),
  },
  {
    id: 'conv-6',
    team_id: 'team-1',
    customer_id: 'cust-6',
    customer: {
      id: 'cust-6',
      team_id: 'team-1',
      name: 'Luis Fernando Torres',
      phone: '+52 55 8888 4321',
      channel: 'whatsapp',
      channel_id: '5215588884321',
      created_at: minutesAgo(40320),
      updated_at: minutesAgo(4320),
    },
    channel: 'whatsapp',
    channel_contact_id: '5215588884321',
    status: 'closed',
    is_ai_enabled: false,
    last_message: 'Listo, ya recibi el pedido. Todo en orden, muchas gracias!',
    last_message_at: minutesAgo(4320),
    unread_count: 0,
    created_at: minutesAgo(20160),
  },
  {
    id: 'conv-7',
    team_id: 'team-1',
    customer_id: 'cust-7',
    customer: {
      id: 'cust-7',
      team_id: 'team-1',
      name: 'Patricia Vega',
      email: 'patricia.vega@empresa.mx',
      channel: 'instagram',
      channel_id: 'ig_patriciavega',
      created_at: minutesAgo(15120),
      updated_at: minutesAgo(1440),
    },
    channel: 'instagram',
    channel_contact_id: 'ig_patriciavega',
    status: 'closed',
    is_ai_enabled: true,
    last_message: 'Excelente servicio, los recomendare con mis contactos',
    last_message_at: minutesAgo(1440),
    unread_count: 0,
    created_at: minutesAgo(10080),
  },
  {
    id: 'conv-8',
    team_id: 'team-1',
    channel: 'messenger',
    channel_contact_id: 'fb_unknown_839',
    status: 'active',
    is_ai_enabled: true,
    last_message: 'Tienen envio a Monterrey? Necesito 50 unidades',
    last_message_at: minutesAgo(8),
    unread_count: 4,
    created_at: minutesAgo(8),
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
      content: 'Hola Maria! Con gusto te ayudo con la cotizacion. Contamos con varios paquetes. Cual es el giro de tu tienda para recomendarte los productos ideales?',
      created_at: minutesAgo(59),
    },
    {
      id: 'msg-1-3',
      conversation_id: 'conv-1',
      sender_type: 'customer',
      content: 'Tengo una tienda de regalos y accesorios en Polanco. Busco productos premium.',
      created_at: minutesAgo(55),
    },
    {
      id: 'msg-1-4',
      conversation_id: 'conv-1',
      sender_type: 'ai',
      content: 'Excelente! Para tiendas como la tuya, te recomiendo nuestro Paquete Premium que incluye 200 piezas variadas con un margen de ganancia del 40%. El precio regular es de $15,000 MXN pero tenemos un descuento del 10% en primera compra.',
      created_at: minutesAgo(54),
    },
    {
      id: 'msg-1-5',
      conversation_id: 'conv-1',
      sender_type: 'customer',
      content: 'Se escucha bien! Y tienen catalogo en linea?',
      created_at: minutesAgo(20),
    },
    {
      id: 'msg-1-6',
      conversation_id: 'conv-1',
      sender_type: 'agent',
      sender_id: 'profile-1',
      content: 'Hola Maria! Soy Carlos, tu asesor asignado. Te comparto el catalogo digital: https://catalogo.empresa.mx/premium-2026 \n\nCualquier duda estoy para ayudarte.',
      created_at: minutesAgo(15),
    },
    {
      id: 'msg-1-7',
      conversation_id: 'conv-1',
      sender_type: 'customer',
      content: 'Perfecto, me interesa el paquete premium. Cual es el precio mayoreo?',
      created_at: minutesAgo(2),
    },
  ],
  'conv-2': [
    {
      id: 'msg-2-1',
      conversation_id: 'conv-2',
      sender_type: 'customer',
      content: 'Buenos dias, ya quiero finalizar mi pedido del mes. Son las mismas 100 unidades de siempre.',
      created_at: minutesAgo(180),
    },
    {
      id: 'msg-2-2',
      conversation_id: 'conv-2',
      sender_type: 'agent',
      content: 'Hola Roberto! Claro, tu pedido recurrente de 100 unidades del modelo estándar. El total seria de $8,500 MXN. Te paso los datos para la transferencia.',
      created_at: minutesAgo(170),
    },
    {
      id: 'msg-2-3',
      conversation_id: 'conv-2',
      sender_type: 'customer',
      content: 'Ya realice la transferencia, les envio el comprobante',
      created_at: minutesAgo(30),
    },
  ],
  'conv-3': [
    {
      id: 'msg-3-1',
      conversation_id: 'conv-3',
      sender_type: 'customer',
      content: 'Hola! Vi su publicacion de los productos nuevos, tienen disponibles?',
      created_at: minutesAgo(15),
    },
  ],
  'conv-4': [
    {
      id: 'msg-4-1',
      conversation_id: 'conv-4',
      sender_type: 'customer',
      content: 'Hola, necesito una cotizacion para evento corporativo de 200 personas.',
      created_at: minutesAgo(2880),
    },
    {
      id: 'msg-4-2',
      conversation_id: 'conv-4',
      sender_type: 'ai',
      content: 'Hola Ana Sofia! Con gusto preparo tu cotizacion. Para un evento de 200 personas tenemos el Paquete Corporativo que incluye decoracion, materiales promocionales y detalles personalizados. El rango de precio es entre $45,000 y $65,000 MXN dependiendo de las especificaciones. Quieres que te envie la propuesta detallada?',
      created_at: minutesAgo(2870),
    },
    {
      id: 'msg-4-3',
      conversation_id: 'conv-4',
      sender_type: 'customer',
      content: 'Si, por favor envienme la propuesta completa con opciones.',
      created_at: minutesAgo(1440),
    },
    {
      id: 'msg-4-4',
      conversation_id: 'conv-4',
      sender_type: 'agent',
      content: 'Ana Sofia, te acabo de enviar la propuesta a tu correo con 3 opciones de paquete. Cualquier ajuste me dices!',
      created_at: minutesAgo(130),
    },
    {
      id: 'msg-4-5',
      conversation_id: 'conv-4',
      sender_type: 'customer',
      content: 'Gracias por la cotizacion, lo reviso con mi equipo y les confirmo manana',
      created_at: minutesAgo(120),
    },
  ],
  'conv-5': [
    {
      id: 'msg-5-1',
      conversation_id: 'conv-5',
      sender_type: 'customer',
      content: 'Buenas tardes, quisiera informacion sobre sus servicios de logistica',
      created_at: minutesAgo(45),
    },
  ],
  'conv-6': [
    {
      id: 'msg-6-1',
      conversation_id: 'conv-6',
      sender_type: 'customer',
      content: 'Ya llego mi paquete?',
      created_at: minutesAgo(5760),
    },
    {
      id: 'msg-6-2',
      conversation_id: 'conv-6',
      sender_type: 'agent',
      content: 'Hola Luis, tu paquete salio hoy por paqueteria. El numero de guia es: GUA-2026-4521. Llega en 2-3 dias habiles.',
      created_at: minutesAgo(5700),
    },
    {
      id: 'msg-6-3',
      conversation_id: 'conv-6',
      sender_type: 'customer',
      content: 'Listo, ya recibi el pedido. Todo en orden, muchas gracias!',
      created_at: minutesAgo(4320),
    },
  ],
  'conv-7': [
    {
      id: 'msg-7-1',
      conversation_id: 'conv-7',
      sender_type: 'customer',
      content: 'Hola! Quiero hacer otro pedido igual al anterior',
      created_at: minutesAgo(2880),
    },
    {
      id: 'msg-7-2',
      conversation_id: 'conv-7',
      sender_type: 'ai',
      content: 'Hola Patricia! Veo que tu ultimo pedido fue de 50 unidades del modelo Deluxe. Quieres que repita ese mismo pedido?',
      created_at: minutesAgo(2870),
    },
    {
      id: 'msg-7-3',
      conversation_id: 'conv-7',
      sender_type: 'customer',
      content: 'Si, exactamente el mismo. Y gracias por recordar mi pedido!',
      created_at: minutesAgo(1450),
    },
    {
      id: 'msg-7-4',
      conversation_id: 'conv-7',
      sender_type: 'agent',
      content: 'Listo Patricia! Tu pedido ya esta registrado y se envia manana. Te llega en 3 dias.',
      created_at: minutesAgo(1445),
    },
    {
      id: 'msg-7-5',
      conversation_id: 'conv-7',
      sender_type: 'customer',
      content: 'Excelente servicio, los recomendare con mis contactos',
      created_at: minutesAgo(1440),
    },
  ],
  'conv-8': [
    {
      id: 'msg-8-1',
      conversation_id: 'conv-8',
      sender_type: 'customer',
      content: 'Hola! Necesito informacion sobre precios mayoristas',
      created_at: minutesAgo(10),
    },
    {
      id: 'msg-8-2',
      conversation_id: 'conv-8',
      sender_type: 'ai',
      content: 'Hola! Gracias por tu interes. Nuestros precios mayoristas comienzan desde 50 unidades con un descuento del 15%. Que producto te interesa?',
      created_at: minutesAgo(9),
    },
    {
      id: 'msg-8-3',
      conversation_id: 'conv-8',
      sender_type: 'customer',
      content: 'El modelo estandar. Tienen envio a Monterrey? Necesito 50 unidades',
      created_at: minutesAgo(8),
    },
  ],
};

type ViewMode = 'list' | 'canvas';

export default function ConversationsPage() {
  const navigate = useNavigate();
  const { isDemoMode } = useDemoStore();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [newConvModalOpen, setNewConvModalOpen] = useState(false);

  useEffect(() => {
    setConversations(isDemoMode ? mockConversations : []);
    setActiveConversationId(null);
  }, [isDemoMode]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const activeMessages = useMemo(
    () => (activeConversationId ? mockMessages[activeConversationId] ?? [] : []),
    [activeConversationId]
  );

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
    (id: string, newStatus: ConversationStatus) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
      );
    },
    []
  );

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!activeConversationId) return;
      const newMsg: Message = {
        id: `msg-new-${Date.now()}`,
        conversation_id: activeConversationId,
        sender_type: 'agent',
        content,
        created_at: new Date().toISOString(),
      };
      // In a real app this would go through the store/API
      if (!mockMessages[activeConversationId]) {
        mockMessages[activeConversationId] = [];
      }
      mockMessages[activeConversationId].push(newMsg);
      // Force re-render by updating conversations
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? { ...c, last_message: content, last_message_at: newMsg.created_at }
            : c
        )
      );
    },
    [activeConversationId]
  );

  const handleToggleAI = useCallback(
    (enabled: boolean) => {
      if (!activeConversationId) return;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId ? { ...c, is_ai_enabled: enabled } : c
        )
      );
    },
    [activeConversationId]
  );

  const handleAssignVendor = useCallback(() => {
    // Placeholder - would open a vendor assignment modal
    console.log('Assign vendor to conversation:', activeConversationId);
  }, [activeConversationId]);

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
              onClick={() => setViewMode('list')}
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
              onClick={() => setViewMode('canvas')}
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
            onClick={() => setNewConvModalOpen(true)}
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
                />
              </div>

              {/* Chat panel */}
              <div className="flex-1 h-full">
                {activeConversation ? (
                  <ChatWindow
                    conversation={activeConversation}
                    messages={activeMessages}
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
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nueva conversación info modal */}
      <Modal
        isOpen={newConvModalOpen}
        onClose={() => setNewConvModalOpen(false)}
        title="Nueva conversación"
        size="sm"
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
            <MessageSquare className="h-7 w-7 text-primary-500" />
          </div>
          <div>
            <p className="text-sm text-surface-600 leading-relaxed">
              Las conversaciones se inician automáticamente cuando tus clientes te escriben por WhatsApp, Instagram o Messenger.
            </p>
            <p className="mt-2 text-sm text-surface-500">
              Conecta tus canales en <strong>Configuración → Canales</strong> para comenzar a recibir mensajes.
            </p>
          </div>
          <button
            onClick={() => { setNewConvModalOpen(false); navigate('/settings'); }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 transition-colors"
          >
            <Settings className="h-4 w-4" />
            Ir a Configuración
          </button>
        </div>
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
              messages={activeMessages}
              onSendMessage={handleSendMessage}
              onToggleAI={handleToggleAI}
              onAssignVendor={handleAssignVendor}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
