# DEVELOPMENT CONTEXT - SaaS Modular ERP/CRM

> **Este archivo es el contexto principal para sesiones futuras de Claude Code.**
> Léelo al inicio de cada sesión para entender la arquitectura completa.

## Visión General

Software SaaS modular tipo ERP/CRM cuyo producto principal es un **cotizador de IA** que atiende clientes 24/7 a través de WhatsApp, Instagram y Messenger. El sistema consulta bases de datos para responder preguntas sobre productos, precios, disponibilidad, seguimiento de pedidos, etc.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS v4 |
| Estado | Zustand |
| Routing | React Router v6 |
| Animaciones | Framer Motion |
| Backend/Auth | Supabase (Auth, Database, Realtime, Storage) |
| Hosting Frontend | GitHub Pages (con GitHub Actions) |
| Hosting Backend | Railway (Supabase Edge Functions si se necesitan) |
| Mensajería | YCloud (WhatsApp, Instagram, Messenger) |
| Gráficas | Recharts |
| Tablas | TanStack React Table |
| Excel | xlsx (SheetJS) |
| Iconos | Lucide React |

## Arquitectura de Módulos

El sistema es **modular**. Cada módulo se activa/desactiva por equipo. El archivo `src/config/modules.ts` define los módulos disponibles:

### Módulo 1: CRM + Atención al Cliente (MVP - IMPLEMENTADO)
- **Clientes**: CRUD completo, importación por Excel
- **Conversaciones**: Vista lista y canvas, asignación de vendedores, toggle IA/manual
- **Equipo**: Roles (gerente/vendedor), código de equipo, invitaciones
- **Dashboard**: Métricas financieras y de atención por vendedor
- **Configuración IA**: Proveedores (OpenAI, Anthropic, Google), modelos, system prompt, asignación de agentes a canales/números
- **Excel Upload**: Carga de productos/servicios con descripción de columnas para el system prompt de la IA

### Módulo 2: Logística (PREPARADO, NO IMPLEMENTADO)
- Estados de pedido: curioso → cotizando → pendiente de pago → pendiente de surtir → pendiente de enviar → enviado → entregado → cancelado → requiere atención
- Rutas de entrega con vehículos y choferes
- Seguimiento de pedidos para clientes vía IA

### Módulo 3: Almacén (PREPARADO, NO IMPLEMENTADO)
- Inventario por SKU y bodega
- Gestión de precios
- Consulta de disponibilidad por IA

### Módulo 4: Servicios (PREPARADO, NO IMPLEMENTADO)
- Agendamiento de citas
- Clases y membresías
- Se activa en onboarding si el cliente elige "proveedor de servicios"

## Estructura de Archivos

```
src/
├── components/
│   ├── layout/          # Sidebar, Header, MainLayout
│   ├── ui/              # Button, Input, Modal, Card, Badge, etc.
│   ├── auth/            # LoginForm, RegisterForm, OnboardingForm
│   ├── dashboard/       # MetricCard, Charts, VendorPerformance
│   ├── conversations/   # ConversationList, ConversationCanvas, ChatWindow
│   ├── customers/       # CustomerTable, CustomerForm
│   ├── settings/        # AIAgentConfig, ChannelConfig
│   ├── team/            # TeamMembers, InviteCode
│   └── excel/           # ExcelUploader, TemplateDownloader
├── hooks/               # useAuth, useSupabase, useRealtime, etc.
├── lib/                 # Supabase client, utilities, AI helpers
├── pages/               # Rutas principales
├── stores/              # Zustand stores
├── types/               # TypeScript interfaces/types
├── config/              # Módulos, constantes, AI providers
└── modules/             # Definición de módulos futuros
```

## Base de Datos (Supabase)

### Tablas Principales

```sql
-- teams: Equipos de trabajo
-- profiles: Perfiles de usuario con rol y team_id
-- customers: Clientes del equipo
-- conversations: Conversaciones con clientes
-- messages: Mensajes de conversaciones
-- ai_agents: Configuración de agentes de IA
-- channel_assignments: Asignación de canales a agentes
-- knowledge_bases: Bases de datos/conocimiento cargadas por Excel
-- knowledge_columns: Descripción de columnas para el system prompt
-- team_invitations: Invitaciones pendientes
```

### Row Level Security (RLS)
- Todas las tablas tienen RLS habilitado
- Los datos se filtran por `team_id`
- Gerente tiene acceso total a su equipo
- Vendedor ve solo lo asignado

## Autenticación

### Métodos soportados
- **Email/Password**: Registro y login tradicional
- **Google OAuth**: Login/registro con Google (Supabase Auth Provider)

### Configuración de Google OAuth
1. Crear proyecto en Google Cloud Console
2. Habilitar Google Identity API
3. Crear credenciales OAuth 2.0 (Web application)
4. Agregar redirect URI: `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
5. En Supabase Dashboard > Authentication > Providers > Google: ingresar Client ID y Client Secret
6. La app redirige a `/auth/callback` después del login OAuth

### Flujo de OAuth
1. Usuario clickea "Continuar con Google"
2. Supabase redirige a Google para autenticación
3. Google redirige de vuelta a Supabase con el token
4. Supabase redirige a la app en `/auth/callback`
5. `AuthCallbackPage` verifica la sesión y redirige a `/dashboard` o `/onboarding`

## Flujo de Onboarding

1. Registro con email/password o Google OAuth
2. Formulario: ¿Eres proveedor de servicios o retailer?
3. Se crea el equipo y se genera el código de equipo
4. Se activan los módulos correspondientes
5. El gerente configura el agente de IA

## Flujo de IA

1. Mensaje llega por YCloud webhook → Supabase Edge Function
2. Se identifica el canal y el agente asignado
3. Se construye el system prompt con:
   - Instrucciones del gerente
   - Descripciones de columnas de knowledge bases
   - Reglas: no alucinar, consultar DB, flujo lineal, responder siempre
4. Se consulta la base de datos según la pregunta
5. Se genera respuesta y se envía por YCloud
6. Se guarda en la tabla de mensajes

## Configuración de Despliegue

### GitHub Actions → GitHub Pages (Frontend)
- Build con Vite
- Deploy a gh-pages branch
- Secrets necesarios: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

### Railway (Backend/API)
- Supabase Edge Functions o servidor Express si se necesita
- Para webhooks de YCloud

### Secrets de GitHub (Repository Secrets)
```
VITE_SUPABASE_URL          - URL de tu proyecto Supabase
VITE_SUPABASE_ANON_KEY     - Anon key de Supabase
VITE_YCLOUD_API_KEY        - API key de YCloud (para mensajería)
VITE_API_URL               - URL del backend en Railway (ej: https://tu-servicio.up.railway.app)
                             Necesario para enviar mensajes desde la UI al celular del cliente
```

### Configuración en Supabase Dashboard
```
Authentication > Providers > Google:
  GOOGLE_CLIENT_ID         - Client ID de Google Cloud OAuth 2.0
  GOOGLE_CLIENT_SECRET     - Client Secret de Google Cloud OAuth 2.0

Authentication > URL Configuration:
  Site URL                 - URL de tu frontend (ej: https://user.github.io/saas_software)
  Redirect URLs            - Agregar: https://user.github.io/saas_software/auth/callback
```

### Variables de Railway (Backend/Webhooks)
```
SUPABASE_URL               - URL de tu proyecto Supabase
SUPABASE_SERVICE_ROLE_KEY  - Service role key (NO la anon key)
YCLOUD_API_KEY             - API key de YCloud
YCLOUD_WEBHOOK_SECRET      - ⚠️ DEJAR EN BLANCO (vacío). La validación de webhook
                             funciona sin este secret. Configurar un valor aquí
                             puede causar que los webhooks de YCloud sean rechazados
                             si la firma no coincide. Se dejó vacío intencionalmente
                             en la configuración actual de Railway (marzo 2026).
PORT                       - Puerto (Railway lo asigna automáticamente)
```

### Variables de Entorno de Supabase (Dashboard > Settings > Edge Functions)
```
YCLOUD_API_KEY             - API key de YCloud
OPENAI_API_KEY             - Si se usa OpenAI como proveedor IA (lo pone el gerente)
ANTHROPIC_API_KEY          - Si se usa Anthropic (lo pone el gerente)
GOOGLE_AI_API_KEY          - Si se usa Google AI (lo pone el gerente)
```

> **NOTA**: Las API keys de IA las configura cada gerente desde la UI. Se guardan encriptadas en Supabase.

## Convenciones de Código

- **Componentes**: PascalCase, archivos .tsx
- **Hooks**: camelCase con prefijo `use`, archivos .ts
- **Stores**: camelCase, archivos .ts
- **Types**: PascalCase para interfaces, archivos .ts
- **Utilidades**: camelCase, archivos .ts
- Imports absolutos con `@/` alias
- Estilos con Tailwind utility classes
- Animaciones con Framer Motion `motion` components

## Despliegue en Railway

Railway se usa para el backend que maneja webhooks de YCloud y procesa mensajes con IA.

### Setup
1. Crear nuevo proyecto en Railway
2. Conectar repositorio de GitHub (o subir código del backend)
3. Railway detecta automáticamente el `railway.json`
4. Configurar variables de entorno en Railway Dashboard
5. Obtener URL pública del servicio para configurar webhooks en YCloud

### YCloud Webhook Configuration
1. En YCloud Dashboard, crear webhook endpoint apuntando a: `https://<railway-url>/api/webhooks/ycloud`
2. Configurar eventos: `whatsapp.inbound_message.received`, `whatsapp.message.updated`
3. `YCLOUD_WEBHOOK_SECRET` debe **dejarse vacío** en Railway. La conexión entre Railway, YCloud y la plataforma funciona correctamente sin este secret (validado marzo 2026). Si se configura un valor, los webhooks podrían ser rechazados.

### Notas de Configuración (Registro de Decisiones)
- **YCLOUD_WEBHOOK_SECRET vacío en Railway**: Se dejó intencionalmente en blanco. La lógica del servidor (`server/src/webhook.ts`) solo valida la firma si `YCLOUD_WEBHOOK_SECRET` tiene un valor. Al dejarlo vacío, todos los webhooks entrantes de YCloud son aceptados sin validación de firma, lo cual funciona correctamente en el entorno actual.
- **Conexión Railway ↔ YCloud ↔ Plataforma**: Validada y funcionando (marzo 2026). La configuración guardada en Supabase responde correctamente.

## Cambios Recientes (marzo 2026)

### ConversationsPage - Datos reales de Supabase
- La página de conversaciones ahora se conecta directamente a Supabase en lugar de usar solo datos mock.
- Incluye suscripción en tiempo real (Realtime) para nuevos mensajes y actualizaciones de conversaciones.
- Los mensajes enviados desde la UI se guardan en Supabase y se actualiza `last_message` en la conversación.
- Los mensajes del cliente que llegan por webhook también se ven reflejados en tiempo real.
- El fallback a datos mock solo se usa cuando Supabase no está configurado y el modo demo está activo.

### DashboardPage - Métricas reales
- El dashboard ahora calcula métricas reales desde Supabase: total de conversaciones, clientes, tiempo de respuesta promedio, y tasa de resolución.
- Incluye gráficas de conversaciones por día (últimos 30 días), distribución por canal, y rendimiento de vendedores.
- Se agregó una sección de "Conversaciones Recientes" que muestra las últimas 5 conversaciones con su canal, estado y tiempo.

### KnowledgeBasesPage - Nueva página de Bases de Datos
- Ruta: `/knowledge-bases`
- Permite cargar bases de conocimiento (Excel) para que la IA consulte datos.
- Incluye plantilla descargable de productos con el esquema de autopartes (sku, descripcion, existencia_cdmx, existencia_tulti, existencia_foranea, url_imagen, precio_compra, precio_venta, parte, modelo, marca, modelos_compatibles, lado, del_tras, int_ext).
- Dos modos de carga: libre (cualquier Excel) y desde plantilla (valida columnas exactas).
- Cada columna cargada requiere una descripción para que el agente de IA sepa qué datos puede consultar.
- Las bases de datos se almacenan en Supabase (tablas `knowledge_bases` y `knowledge_columns`).

### Webhook - Mensajes entrantes
- El webhook (`server/src/webhook.ts`) ya guardaba los mensajes del cliente (`sender_type: 'customer'`) en la tabla `messages`.
- El problema era que la UI no mostraba datos reales al no conectarse a Supabase. Ahora con la ConversationsPage conectada, los mensajes del cliente se ven correctamente.

## Próximos Pasos (para futuras sesiones)

1. Implementar módulo de Logística completo
2. Implementar módulo de Almacén
3. Implementar módulo de Servicios
4. Portal de administrador (otro repositorio)
5. Tests E2E con Playwright
6. Code splitting para reducir bundle size
7. Almacenar datos del Excel cargado en la tabla `knowledge_bases` como JSON o en Storage de Supabase para consulta por la IA
