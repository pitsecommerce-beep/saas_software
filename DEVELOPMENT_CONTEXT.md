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
ENCRYPTION_KEY             - Clave AES-256-GCM para encriptar/desencriptar API keys
                             guardadas en la BD. Debe ser exactamente 64 caracteres
                             hex (32 bytes). Generar con:
                             node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
                             Si no se configura, el sistema funciona en modo degradado
                             (las keys se usan en texto plano) con un WARNING en logs.
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

## Cambios Recientes (abril 2026)

### Encriptación AES-256-GCM para API keys (abril 2026)
- **`server/src/crypto.ts`** (nuevo): Módulo de encriptación con `encrypt()` y `decrypt()` usando AES-256-GCM nativo de Node.js. Formato del valor encriptado: `iv:authTag:ciphertext` (todo hex). `decrypt()` es idempotente para valores en texto plano (backwards-compatible).
- **`server/src/ai.ts`**: `callOpenAI`, `callAnthropic`, `callGoogle` (y sus variantes `continue*`) llaman a `decrypt(apiKey)` antes de crear el cliente o construir la URL.
- **`server/src/webhook.ts`**: En `processInboundMessage`, se crea `decryptedAgent` con la api_key desencriptada antes de pasarlo a `getAIResponse`. En `executeGenerarLinkPago`, se desencripta `settings.api_key_encrypted` antes de usarlo en las cabeceras de fetch.
- **`server/src/payments.ts`**: En `handleCreatePaymentLink`, se crea `decryptedSettings` con `api_key_encrypted` y `webhook_secret` desencriptados antes de pasarlos a `createMercadoPagoLink` / `createStripeLink`.
- **`server/src/migrate-encrypt-keys.ts`** (nuevo): Script ejecutable con `npm run migrate:encrypt` que encripta en la BD todas las keys que aún estén en texto plano (idempotente).
- **Variable `ENCRYPTION_KEY`**: Debe configurarse en Railway (64 chars hex). Sin ella el sistema funciona en modo degradado con WARNING.

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

## Sistema Harmony Credits (abril 2026)

### Objetivo
Registro automático del consumo de tokens de IA por equipo, con panel exclusivo para el gerente que muestra métricas en tiempo real y saldo disponible ("Harmony Credits").

### Tablas nuevas en Supabase
- **`token_usage`**: Registro acumulativo e independiente de conversaciones. Cada llamada al API de IA genera una fila con `team_id`, `agent_id`, `provider`, `model`, `input_tokens`, `output_tokens`, `conversation_id` (nullable), `created_at`.
- **`harmony_credits`**: Una fila por equipo con `balance_usd` (saldo actual), `total_recharged_usd` (acumulado histórico), `updated_at`, `updated_by`. El admin recarga desde otra plataforma usando el service role key.

### Captura automática de tokens
- `server/src/ai.ts`: Los tres proveedores (OpenAI, Anthropic, Google) ahora incluyen `tokenUsage: { inputTokens, outputTokens }` en `AIResponse`.
- `server/src/webhook.ts`: Después de cada respuesta IA (incluyendo iteraciones de tool calling), se suman todos los tokens y se inserta una fila en `token_usage`.
- Los datos **no se borran** aunque se eliminen conversaciones (referencia `conversation_id` es nullable/soft).

### Cálculo de costos
- `src/lib/modelPricing.ts`: Tabla de precios por modelo (USD/1M tokens) para OpenAI, Anthropic y Google. La función `calculateCostUsd(model, inputTokens, outputTokens)` devuelve el costo en USD.

### UI del gerente (Settings → Harmony Credits)
- Tab exclusivo visible solo para usuarios con rol `gerente`.
- Componente `src/components/settings/HarmonyCredits.tsx` con:
  - Gauge circular de saldo restante (% del total recargado)
  - Saldo en USD actual
  - KPIs: tokens totales, media por conversación, conversaciones restantes, costo total
  - Gráfica de barras por agente con porcentaje del gasto total
  - Nota informativa sobre la persistencia de datos
- El tab filtra con `managerOnly: true` en la definición de TABS.

### Recarga de créditos (admin)
- El admin usa la service role key de Supabase para hacer UPSERT en `harmony_credits`:
  ```sql
  INSERT INTO harmony_credits (team_id, balance_usd, total_recharged_usd, updated_by)
  VALUES ('{team_id}', {amount}, {amount}, 'admin')
  ON CONFLICT (team_id) DO UPDATE SET
    balance_usd = harmony_credits.balance_usd + EXCLUDED.balance_usd,
    total_recharged_usd = harmony_credits.total_recharged_usd + EXCLUDED.balance_usd,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by;
  ```

## Optimizaciones abril 2026

1. **`isSupabaseConfigured` extraído a `src/lib/config.ts`** — Se eliminó la declaración duplicada en `authStore.ts`, `ConversationsPage.tsx`, `DashboardPage.tsx`, `KnowledgeBasesPage.tsx` y `SettingsPage.tsx`. Todos ahora importan desde `@/lib/config`.
2. **Timeout de inicialización reducido de 20s a 8s** — El `safetyTimeout` en `authStore.ts` ahora es de 8000ms para evitar que el splash screen se quede visible demasiado tiempo.
3. **Timeout por operación reducido de 8s a 5s** — El `withTimeout` en `authStore.ts` ahora es de 5000ms.
4. **Reintentos reducidos de 2 a 1** — `maxRetries` en `authStore.ts` cambiado de 2 a 1 y se eliminó el delay entre reintentos para acelerar la carga.
5. **`fetchProfile` ya no hace upsert en PGRST116** — Cuando no se encuentra el perfil, se pone `profile: null` y se deja que `AuthCallbackPage` o el onboarding manejen la creación.
6. **Búsqueda full-text via RPC** — Se implementó `getKnowledgeSchema()` + `searchKnowledgeRows()` que usan las funciones RPC `search_knowledge` y `search_knowledge_fallback` en Postgres. Esto reemplaza a `getKnowledgeContext()` que traía hasta 200 filas completas como JSON al prompt.
7. **`max_tokens` reducido de 1024 a 500** — En `callOpenAI`, `callAnthropic` y `callGoogle` dentro de `server/src/ai.ts`.
8. **Historial de mensajes reducido de 20 a 10** — En `processInboundMessage` de `server/src/webhook.ts`, el `.limit()` de `recentMessages` pasó de 20 a 10.
9. **Prompt de concisión agregado** — Se añadió instrucción al final de `buildSystemPrompt` para que la IA responda de forma concisa, sin markdown ni formato especial.
