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
YCLOUD_WEBHOOK_SECRET      - Secret para validar webhooks de YCloud
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
1. En YCloud Dashboard, crear webhook endpoint apuntando a: `https://<railway-url>/api/webhook/ycloud`
2. Configurar eventos: `message.received`, `message.status_updated`
3. Guardar el webhook secret en Railway como `YCLOUD_WEBHOOK_SECRET`

## Próximos Pasos (para futuras sesiones)

1. Implementar servidor Express en Railway para webhooks de YCloud
2. Implementar módulo de Logística completo
3. Implementar módulo de Almacén
4. Implementar módulo de Servicios
5. Portal de administrador (otro repositorio)
6. Integración real con proveedores de IA
7. Tests E2E con Playwright
