'use client';

import { useState } from 'react';
import type { KnowledgeBase, KnowledgeColumn } from '@/types';
import type { UploadPayload } from './ExcelUploader';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  FileDown,
  Table2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Toggle';
import { ExcelUploader } from './ExcelUploader';

interface KnowledgeBaseWithColumns extends KnowledgeBase {
  columns?: KnowledgeColumn[];
}

interface KnowledgeBaseManagerProps {
  knowledgeBases: KnowledgeBaseWithColumns[];
  onUpload: (payload: UploadPayload) => void;
  onDelete: (id: string) => void;
  onToggleQueryable: (id: string, isQueryable: boolean) => void;
}

const CUSTOMER_TEMPLATE_COLUMNS = [
  'Nombre',
  'Email',
  'Teléfono',
  'Empresa',
  'Ciudad',
  'Notas',
];

// Mock data for demonstration
const MOCK_KNOWLEDGE_BASES: KnowledgeBaseWithColumns[] = [
  {
    id: 'kb-1',
    team_id: 'team-1',
    name: 'Catálogo de Productos',
    description: 'Inventario completo de productos con precios y disponibilidad',
    file_url: '/files/catalogo.xlsx',
    row_count: 1250,
    is_queryable: true,
    created_at: '2026-01-15T10:30:00Z',
    columns: [
      {
        id: 'col-1',
        knowledge_base_id: 'kb-1',
        column_name: 'SKU',
        description: 'Código único de identificación del producto',
        data_type: 'text',
      },
      {
        id: 'col-2',
        knowledge_base_id: 'kb-1',
        column_name: 'Nombre',
        description: 'Nombre comercial del producto',
        data_type: 'text',
      },
      {
        id: 'col-3',
        knowledge_base_id: 'kb-1',
        column_name: 'Precio',
        description: 'Precio de venta al público en MXN',
        data_type: 'number',
      },
      {
        id: 'col-4',
        knowledge_base_id: 'kb-1',
        column_name: 'Disponibilidad',
        description: 'Cantidad disponible en almacén',
        data_type: 'number',
      },
    ],
  },
  {
    id: 'kb-2',
    team_id: 'team-1',
    name: 'Preguntas Frecuentes',
    description: 'Base de preguntas y respuestas para soporte al cliente',
    file_url: '/files/faq.xlsx',
    row_count: 85,
    is_queryable: true,
    created_at: '2026-02-20T14:00:00Z',
    columns: [
      {
        id: 'col-5',
        knowledge_base_id: 'kb-2',
        column_name: 'Pregunta',
        description: 'Pregunta frecuente del cliente',
        data_type: 'text',
      },
      {
        id: 'col-6',
        knowledge_base_id: 'kb-2',
        column_name: 'Respuesta',
        description: 'Respuesta oficial aprobada por el equipo de soporte',
        data_type: 'text',
      },
      {
        id: 'col-7',
        knowledge_base_id: 'kb-2',
        column_name: 'Categoría',
        description: 'Categoría temática de la pregunta (envíos, pagos, devoluciones, etc.)',
        data_type: 'text',
      },
    ],
  },
];

function KnowledgeBaseManager({
  knowledgeBases: propKnowledgeBases,
  onUpload,
  onDelete,
  onToggleQueryable,
}: KnowledgeBaseManagerProps) {
  const knowledgeBases =
    propKnowledgeBases.length > 0 ? propKnowledgeBases : MOCK_KNOWLEDGE_BASES;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState<'free' | 'template' | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleUpload = (payload: UploadPayload) => {
    onUpload(payload);
    setShowUploader(null);
  };

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setShowUploader('free')}
        >
          Cargar nueva base de conocimiento
        </Button>
        <Button
          variant="secondary"
          icon={<FileDown className="h-4 w-4" />}
          onClick={() => setShowUploader('template')}
        >
          Cargar clientes desde plantilla
        </Button>
      </div>

      {/* Uploader overlay */}
      <AnimatePresence>
        {showUploader && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-surface-800">
                  {showUploader === 'template'
                    ? 'Cargar clientes desde plantilla'
                    : 'Cargar base de conocimiento'}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUploader(null)}
                >
                  Cancelar
                </Button>
              </div>
              <ExcelUploader
                mode={showUploader}
                onUpload={handleUpload}
                templateColumns={
                  showUploader === 'template' ? CUSTOMER_TEMPLATE_COLUMNS : undefined
                }
              />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Knowledge base list */}
      <div className="space-y-4">
        {knowledgeBases.length === 0 && !showUploader && (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="h-10 w-10 text-surface-300 mb-3" />
            <p className="text-sm font-medium text-surface-600">
              No hay bases de conocimiento
            </p>
            <p className="text-xs text-surface-400 mt-1">
              Carga un archivo Excel para que tu agente de IA pueda consultar datos
            </p>
          </Card>
        )}

        {knowledgeBases.map((kb) => {
          const isExpanded = expandedId === kb.id;

          return (
            <Card key={kb.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
                    <Table2 className="h-5 w-5 text-primary-500" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-surface-800 truncate">
                      {kb.name}
                    </h4>
                    {kb.description && (
                      <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">
                        {kb.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="info" size="sm">
                        {kb.row_count} filas
                      </Badge>
                      <Badge variant="neutral" size="sm">
                        {kb.columns?.length ?? 0} columnas
                      </Badge>
                      {kb.is_queryable && (
                        <Badge variant="success" size="sm">
                          IA activa
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Toggle
                    enabled={kb.is_queryable}
                    onChange={(enabled) => onToggleQueryable(kb.id, enabled)}
                  />
                  <button
                    onClick={() => onDelete(kb.id)}
                    className="rounded-md p-2 text-surface-400 hover:bg-danger-50 hover:text-danger-500 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleExpanded(kb.id)}
                    className={cn(
                      'rounded-md p-2 transition-colors',
                      isExpanded
                        ? 'bg-surface-100 text-surface-700'
                        : 'text-surface-400 hover:bg-surface-100 hover:text-surface-600'
                    )}
                    title="Ver columnas"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expandable column descriptions */}
              <AnimatePresence>
                {isExpanded && kb.columns && kb.columns.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-4 border-t border-surface-100">
                      <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-3">
                        Columnas y descripciones para el agente de IA
                      </p>
                      <div className="space-y-2">
                        {kb.columns.map((col) => (
                          <div
                            key={col.id}
                            className="flex items-start gap-3 rounded-lg bg-surface-50 px-3 py-2.5"
                          >
                            <span className="shrink-0 inline-flex items-center rounded-md bg-white border border-surface-200 px-2 py-0.5 text-xs font-mono font-medium text-surface-700">
                              {col.column_name}
                            </span>
                            <span className="text-xs text-surface-400 uppercase tracking-wider shrink-0 pt-0.5">
                              {col.data_type}
                            </span>
                            <p className="text-sm text-surface-600">
                              {col.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export { KnowledgeBaseManager, MOCK_KNOWLEDGE_BASES };
export type { KnowledgeBaseManagerProps, KnowledgeBaseWithColumns };
