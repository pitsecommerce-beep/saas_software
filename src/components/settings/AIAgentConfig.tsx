'use client';

import { useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff, Bot, Sparkles, Wrench } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AIAgent } from '@/types';
import { AI_PROVIDERS } from '@/config/modules';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';

interface AIAgentConfigProps {
  agent: AIAgent | null;
  onSubmit: (data: Omit<AIAgent, 'id' | 'team_id' | 'created_at'>) => void;
  onCancel: () => void;
}

function AIAgentConfig({ agent, onSubmit, onCancel }: AIAgentConfigProps) {
  const [name, setName] = useState(agent?.name ?? '');
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'google'>(agent?.provider ?? 'openai');
  const [model, setModel] = useState(agent?.model ?? '');
  const [apiKey, setApiKey] = useState(agent?.api_key_encrypted ?? '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt ?? '');
  const [isActive, setIsActive] = useState(agent?.is_active ?? true);
  const [enabledTools, setEnabledTools] = useState<string[]>(agent?.enabled_tools ?? []);
  const [showApiKey, setShowApiKey] = useState(false);

  const selectedProvider = useMemo(
    () => AI_PROVIDERS.find((p) => p.id === provider),
    [provider]
  );

  const modelOptions = useMemo(() => {
    if (!selectedProvider) return [];
    return selectedProvider.models.map((m) => ({
      value: m.id,
      label: m.recommended ? `${m.name} - Recomendado` : m.name,
    }));
  }, [selectedProvider]);

  const providerOptions = AI_PROVIDERS.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const handleProviderChange = (newProvider: 'openai' | 'anthropic' | 'google') => {
    setProvider(newProvider);
    const newSelectedProvider = AI_PROVIDERS.find((p) => p.id === newProvider);
    if (!agent || newProvider !== agent.provider) {
      const recommended = newSelectedProvider?.models.find((m) => m.recommended);
      setModel(recommended?.id ?? newSelectedProvider?.models[0]?.id ?? '');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      provider,
      model,
      api_key_encrypted: apiKey,
      system_prompt: systemPrompt,
      is_active: isActive,
      enabled_tools: enabledTools,
    });
  };

  const currentModel = selectedProvider?.models.find((m) => m.id === model);

  return (
    <motion.form
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 pb-2">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-50">
          <Bot className="h-5 w-5 text-primary-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-surface-900">
            {agent ? 'Editar Agente' : 'Nuevo Agente de IA'}
          </h3>
          <p className="text-sm text-surface-500">
            Configura un agente inteligente para atender conversaciones
          </p>
        </div>
      </div>

      {/* Agent Name */}
      <Input
        label="Nombre del agente"
        placeholder="Ej: Asistente de ventas, Soporte técnico"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      {/* Provider & Model row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Proveedor"
          options={providerOptions}
          value={provider}
          onChange={(e) =>
            handleProviderChange(e.target.value as 'openai' | 'anthropic' | 'google')
          }
        />

        <div className="w-full space-y-1.5">
          <Select
            label="Modelo"
            options={modelOptions}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          {currentModel?.recommended && (
            <div className="flex items-center gap-1.5 mt-1">
              <Sparkles className="h-3 w-3 text-accent-500" />
              <Badge variant="success" size="sm">
                Recomendado
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* API Key */}
      <div className="w-full space-y-1.5">
        <label className="block text-sm font-medium text-surface-700">
          API Key
        </label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            className="block w-full rounded-lg border border-surface-200 bg-white px-3.5 py-2.5 pr-12 text-sm text-surface-900 placeholder:text-surface-400 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-primary-500 focus:ring-primary-500/20"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-surface-400 hover:text-surface-600 transition-colors"
          >
            {showApiKey ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-surface-400">
          Tu API key se almacena de forma encriptada y nunca se expone en el
          frontend.
        </p>
      </div>

      {/* System Prompt */}
      <div className="space-y-1.5">
        <Textarea
          label="System Prompt"
          rows={8}
          placeholder={
            'Describe en detalle cómo debe comportarse el agente.\n\n' +
            'Incluye:\n' +
            '- El nombre de tu empresa y giro de negocio\n' +
            '- Los productos o servicios que ofreces\n' +
            '- El tono de comunicación (formal, amigable, etc.)\n' +
            '- Reglas de respuesta (horarios, precios, políticas)\n' +
            '- Referencias a las bases de conocimiento y catálogos cargados\n\n' +
            'Ejemplo: "Eres el asistente virtual de [Mi Empresa]. Ayudas a los clientes a conocer nuestros productos, cotizar y resolver dudas. Consulta la base de conocimiento para información actualizada de precios e inventario."'
          }
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          required
        />
        <p className="text-xs text-surface-400">
          El system prompt define la personalidad y conocimientos del agente.
          Sé lo más específico posible para obtener mejores resultados.
          Menciona las columnas de las bases de conocimiento que el agente debe
          consultar.
        </p>
      </div>

      {/* Agent Tools */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-surface-500" />
          <label className="text-sm font-medium text-surface-700">
            Herramientas del agente
          </label>
        </div>
        <p className="text-xs text-surface-400">
          Selecciona las herramientas que este agente puede usar durante las conversaciones.
        </p>
        <div className="space-y-2 rounded-lg border border-surface-200 bg-surface-50 p-3">
          <label className="flex items-start gap-3 cursor-pointer rounded-lg p-2 hover:bg-white transition-colors">
            <input
              type="checkbox"
              checked={enabledTools.includes('crear_pedido')}
              onChange={(e) => {
                if (e.target.checked) {
                  setEnabledTools((prev) => [...prev, 'crear_pedido']);
                } else {
                  setEnabledTools((prev) => prev.filter((t) => t !== 'crear_pedido'));
                }
              }}
              className="mt-0.5 h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500/20"
            />
            <div>
              <span className="text-sm font-medium text-surface-800">Crear pedido</span>
              <p className="text-xs text-surface-500 mt-0.5">
                Permite al agente crear pedidos durante la conversacion cuando el cliente confirma una compra. Incluye consulta de disponibilidad automaticamente.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer rounded-lg p-2 hover:bg-white transition-colors">
            <input
              type="checkbox"
              checked={enabledTools.includes('consultar_pedido')}
              onChange={(e) => {
                if (e.target.checked) {
                  setEnabledTools((prev) => [...prev, 'consultar_pedido']);
                } else {
                  setEnabledTools((prev) => prev.filter((t) => t !== 'consultar_pedido'));
                }
              }}
              className="mt-0.5 h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500/20"
            />
            <div>
              <span className="text-sm font-medium text-surface-800">Consultar pedido</span>
              <p className="text-xs text-surface-500 mt-0.5">
                Permite al agente buscar el estado de un pedido cuando el cliente proporciona su número de orden.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer rounded-lg p-2 hover:bg-white transition-colors">
            <input
              type="checkbox"
              checked={enabledTools.includes('generar_link_pago')}
              onChange={(e) => {
                if (e.target.checked) {
                  setEnabledTools((prev) => [...prev, 'generar_link_pago']);
                } else {
                  setEnabledTools((prev) => prev.filter((t) => t !== 'generar_link_pago'));
                }
              }}
              className="mt-0.5 h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500/20"
            />
            <div>
              <span className="text-sm font-medium text-surface-800">Generar link de pago</span>
              <p className="text-xs text-surface-500 mt-0.5">
                Permite al agente generar links de pago de Mercado Pago o Stripe y enviarlos al cliente durante la conversación. Requiere configurar el proveedor de pagos en la pestaña de Configuración.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Active Toggle */}
      <Toggle
        enabled={isActive}
        onChange={setIsActive}
        label="Activo"
        description="El agente responderá automáticamente cuando esté activo"
      />

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-100">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" icon={<Bot className="h-4 w-4" />}>
          {agent ? 'Guardar cambios' : 'Crear agente'}
        </Button>
      </div>
    </motion.form>
  );
}

export { AIAgentConfig };
