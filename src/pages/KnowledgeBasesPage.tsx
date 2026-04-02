'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Plus,
  Table2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Toggle';
import { ExcelUploader } from '@/components/excel/ExcelUploader';
import type { UploadPayload } from '@/components/excel/ExcelUploader';
import type { KnowledgeBase, KnowledgeColumn } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useDemoStore } from '@/stores/demoStore';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/config';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Product template columns matching the autoparts schema from the screenshot
// ---------------------------------------------------------------------------

const PRODUCT_TEMPLATE_COLUMNS = [
  { name: 'sku', example: 'TYCOLE091' },
  { name: 'descripcion', example: 'LUNA ESPEJO COROLLA 09-13 IZQ' },
  { name: 'existencia_cdmx', example: '5' },
  { name: 'existencia_tulti', example: '0' },
  { name: 'existencia_foranea', example: '3' },
  { name: 'url_imagen', example: 'https://grimex.com/img/TYCOLE091.jpg' },
  { name: 'precio_compra', example: '392' },
  { name: 'precio_venta', example: '' },
  { name: 'parte', example: 'LUNAS DE ESPEJO' },
  { name: 'modelo', example: 'COROLLA' },
  { name: 'marca', example: 'TOYOTA' },
  { name: 'modelos_compatibles', example: "['modelo': 'Corolla', 'rango': 'IZQUIERDO']" },
  { name: 'lado', example: 'IZQUIERDO' },
  { name: 'del_tras', example: 'DELANTERA' },
  { name: 'int_ext', example: 'EXTERIOR' },
];

const PRODUCT_TEMPLATE_COLUMN_NAMES = PRODUCT_TEMPLATE_COLUMNS.map((c) => c.name);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KnowledgeBaseWithColumns extends KnowledgeBase {
  columns?: KnowledgeColumn[];
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_KNOWLEDGE_BASES: KnowledgeBaseWithColumns[] = [
  {
    id: 'kb-1',
    team_id: 'team-1',
    name: 'Catálogo de Autopartes',
    description: 'Inventario de autopartes con precios, disponibilidad y compatibilidad',
    file_url: '/files/catalogo.xlsx',
    row_count: 1250,
    is_queryable: true,
    created_at: '2026-01-15T10:30:00Z',
    columns: [
      { id: 'col-1', knowledge_base_id: 'kb-1', column_name: 'sku', description: 'Código único del producto', data_type: 'text' },
      { id: 'col-2', knowledge_base_id: 'kb-1', column_name: 'descripcion', description: 'Descripción del producto incluyendo modelo y posición', data_type: 'text' },
      { id: 'col-3', knowledge_base_id: 'kb-1', column_name: 'precio_compra', description: 'Precio de compra en MXN', data_type: 'number' },
      { id: 'col-4', knowledge_base_id: 'kb-1', column_name: 'marca', description: 'Marca del vehículo compatible', data_type: 'text' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function KnowledgeBasesPage() {
  const { profile } = useAuthStore();
  const { isDemoMode } = useDemoStore();
  const teamId = profile?.team_id;
  const isManager = profile?.role === 'gerente';

  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseWithColumns[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState<'free' | 'product-template' | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // ---------------------------------------------------------------------------
  // Load from Supabase
  // ---------------------------------------------------------------------------

  const loadKnowledgeBases = useCallback(async () => {
    if (!isSupabaseConfigured || !teamId) {
      if (isDemoMode) setKnowledgeBases(MOCK_KNOWLEDGE_BASES);
      setDataLoaded(true);
      return;
    }
    try {
      const { data: kbs, error } = await supabase
        .from('knowledge_bases')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch columns for each knowledge base
      const kbIds = (kbs ?? []).map((kb: KnowledgeBase) => kb.id);
      let columnsMap: Record<string, KnowledgeColumn[]> = {};
      if (kbIds.length > 0) {
        const { data: cols } = await supabase
          .from('knowledge_columns')
          .select('*')
          .in('knowledge_base_id', kbIds);
        if (cols) {
          columnsMap = (cols as KnowledgeColumn[]).reduce((acc, col) => {
            if (!acc[col.knowledge_base_id]) acc[col.knowledge_base_id] = [];
            acc[col.knowledge_base_id].push(col);
            return acc;
          }, {} as Record<string, KnowledgeColumn[]>);
        }
      }

      const kbsWithCols: KnowledgeBaseWithColumns[] = (kbs ?? []).map((kb: KnowledgeBase) => ({
        ...kb,
        columns: columnsMap[kb.id] ?? [],
      }));
      setKnowledgeBases(kbsWithCols);
    } catch (err) {
      console.error('Error loading knowledge bases:', err);
      if (isDemoMode) setKnowledgeBases(MOCK_KNOWLEDGE_BASES);
    } finally {
      setDataLoaded(true);
    }
  }, [teamId, isDemoMode]);

  useEffect(() => {
    if (!dataLoaded) loadKnowledgeBases();
  }, [loadKnowledgeBases, dataLoaded]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleUpload = async (payload: UploadPayload) => {
    if (isSupabaseConfigured && teamId) {
      try {
        // 1. Create the knowledge base record
        const { data: kb, error: kbErr } = await supabase
          .from('knowledge_bases')
          .insert({
            team_id: teamId,
            name: payload.name,
            description: payload.columns.map((c) => `${c.name}: ${c.description}`).join('; '),
            file_url: `uploads/${payload.name}`,
            row_count: payload.data.length,
            is_queryable: payload.isQueryable,
          })
          .select()
          .single();
        if (kbErr) throw kbErr;

        // 2. Insert column descriptions
        const colRows = payload.columns.map((col) => ({
          knowledge_base_id: kb.id,
          column_name: col.name,
          description: col.description,
          data_type: col.dataType,
        }));
        const { data: insertedCols, error: colErr } = await supabase
          .from('knowledge_columns')
          .insert(colRows)
          .select();
        if (colErr) throw colErr;

        // 3. Insert actual row data in batches
        if (payload.data.length > 0) {
          const BATCH_SIZE = 500;
          for (let i = 0; i < payload.data.length; i += BATCH_SIZE) {
            const batch = payload.data.slice(i, i + BATCH_SIZE).map((row) => ({
              knowledge_base_id: kb.id,
              row_data: row,
            }));
            const { error: rowErr } = await supabase
              .from('knowledge_rows')
              .insert(batch);
            if (rowErr) {
              console.error('Error inserting knowledge rows batch:', rowErr);
            }
          }
        }

        const newKb: KnowledgeBaseWithColumns = {
          ...(kb as KnowledgeBase),
          columns: (insertedCols as KnowledgeColumn[]) ?? [],
        };
        setKnowledgeBases((prev) => [newKb, ...prev]);
      } catch (err) {
        console.error('Error uploading knowledge base:', err);
      }
    } else {
      // Mock mode
      const mockKb: KnowledgeBaseWithColumns = {
        id: `kb-${Date.now()}`,
        team_id: teamId ?? 'team-1',
        name: payload.name,
        description: payload.columns.map((c) => `${c.name}: ${c.description}`).join('; '),
        file_url: `uploads/${payload.name}`,
        row_count: payload.data.length,
        is_queryable: payload.isQueryable,
        created_at: new Date().toISOString(),
        columns: payload.columns.map((col, i) => ({
          id: `col-${Date.now()}-${i}`,
          knowledge_base_id: `kb-${Date.now()}`,
          column_name: col.name,
          description: col.description,
          data_type: col.dataType,
        })),
      };
      setKnowledgeBases((prev) => [mockKb, ...prev]);
    }
    setShowUploader(null);
  };

  const handleDelete = async (id: string) => {
    if (isSupabaseConfigured && teamId) {
      const { error } = await supabase
        .from('knowledge_bases')
        .delete()
        .eq('id', id)
        .eq('team_id', teamId);
      if (error) {
        console.error('Error deleting knowledge base:', error);
        return;
      }
    }
    setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
  };

  const handleToggleQueryable = async (id: string, isQueryable: boolean) => {
    if (isSupabaseConfigured && teamId) {
      const { error } = await supabase
        .from('knowledge_bases')
        .update({ is_queryable: isQueryable })
        .eq('id', id)
        .eq('team_id', teamId);
      if (error) {
        console.error('Error toggling queryable:', error);
        return;
      }
    }
    setKnowledgeBases((prev) =>
      prev.map((kb) => (kb.id === id ? { ...kb, is_queryable: isQueryable } : kb))
    );
  };

  const handleDownloadProductTemplate = () => {
    const headers = PRODUCT_TEMPLATE_COLUMNS.map((c) => c.name);
    const exampleRow = PRODUCT_TEMPLATE_COLUMNS.map((c) => c.example);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    worksheet['!cols'] = PRODUCT_TEMPLATE_COLUMNS.map((col) => ({
      wch: Math.max(col.name.length, col.example.length, 12) + 4,
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
    XLSX.writeFile(workbook, 'plantilla_productos.xlsx');
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Bases de Datos</h1>
        <p className="text-sm text-surface-500 mt-1">
          Carga archivos Excel para que tu agente de IA pueda consultar datos de productos, servicios, preguntas frecuentes y más.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setShowUploader('free')}
        >
          Cargar base de conocimiento
        </Button>
        <Button
          variant="secondary"
          icon={<Download className="h-4 w-4" />}
          onClick={handleDownloadProductTemplate}
        >
          Descargar plantilla de productos
        </Button>
        <Button
          variant="secondary"
          icon={<FileSpreadsheet className="h-4 w-4" />}
          onClick={() => setShowUploader('product-template')}
        >
          Cargar productos desde plantilla
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
                  {showUploader === 'product-template'
                    ? 'Cargar productos desde plantilla'
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
              {showUploader === 'product-template' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Download className="h-4 w-4" />}
                      onClick={handleDownloadProductTemplate}
                    >
                      Descargar Plantilla
                    </Button>
                    <span className="text-sm text-surface-500">
                      Descarga la plantilla, llénala con tus productos y cárgala aquí
                    </span>
                  </div>
                  <ExcelUploader
                    mode="template"
                    onUpload={handleUpload}
                    templateColumns={PRODUCT_TEMPLATE_COLUMN_NAMES}
                  />
                </div>
              ) : (
                <ExcelUploader
                  mode="free"
                  onUpload={handleUpload}
                />
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Knowledge base list */}
      <div className="space-y-4">
        {knowledgeBases.length === 0 && !showUploader && (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <Database className="h-12 w-12 text-surface-300 mb-4" />
            <h3 className="text-base font-semibold text-surface-700 mb-1">
              No hay bases de datos cargadas
            </h3>
            <p className="text-sm text-surface-500 max-w-md mb-6">
              Carga un archivo Excel con tus productos, catálogos o preguntas frecuentes para que tu agente de IA pueda consultar esos datos al responder a tus clientes.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setShowUploader('free')}
              >
                Cargar archivo libre
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<FileSpreadsheet className="h-4 w-4" />}
                onClick={() => setShowUploader('product-template')}
              >
                Usar plantilla de productos
              </Button>
            </div>
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
                      <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">
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
                    onChange={(enabled) => handleToggleQueryable(kb.id, enabled)}
                  />
                  {isManager && (
                    <button
                      onClick={() => handleDelete(kb.id)}
                      className="rounded-md p-2 text-surface-400 hover:bg-danger-50 hover:text-danger-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : kb.id)}
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
