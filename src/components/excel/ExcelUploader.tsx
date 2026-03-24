'use client';

import { useState, useRef, useCallback } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { TemplateDownloader } from './TemplateDownloader';

interface DetectedColumn {
  name: string;
  description: string;
  dataType: string;
}

interface UploadPayload {
  name: string;
  data: Record<string, unknown>[];
  columns: DetectedColumn[];
  isQueryable: boolean;
}

interface ExcelUploaderProps {
  mode: 'template' | 'free';
  onUpload: (payload: UploadPayload) => void;
  templateColumns?: string[];
}

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

function inferDataType(values: unknown[]): string {
  const sample = values.filter((v) => v != null && v !== '').slice(0, 20);
  if (sample.length === 0) return 'text';

  const allNumbers = sample.every((v) => typeof v === 'number' || !isNaN(Number(v)));
  if (allNumbers) return 'number';

  const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/;
  const allDates = sample.every(
    (v) => v instanceof Date || (typeof v === 'string' && datePattern.test(v))
  );
  if (allDates) return 'date';

  const allBooleans = sample.every(
    (v) =>
      typeof v === 'boolean' ||
      (typeof v === 'string' && ['true', 'false', 'sí', 'si', 'no', '1', '0'].includes(v.toLowerCase()))
  );
  if (allBooleans) return 'boolean';

  return 'text';
}

function ExcelUploader({ mode, onUpload, templateColumns }: ExcelUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<DetectedColumn[]>([]);
  const [allData, setAllData] = useState<Record<string, unknown>[]>([]);
  const [isQueryable, setIsQueryable] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFileName(null);
    setPreviewRows([]);
    setColumns([]);
    setAllData([]);
    setError(null);
    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsLoading(true);

      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setError('Formato no soportado. Usa archivos .xlsx, .xls o .csv');
        setIsLoading(false);
        return;
      }

      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        if (jsonData.length === 0) {
          setError('El archivo está vacío o no tiene datos válidos.');
          setIsLoading(false);
          return;
        }

        const detectedCols = Object.keys(jsonData[0]);

        // Template mode: validate columns match
        if (mode === 'template' && templateColumns) {
          const missing = templateColumns.filter((tc) => !detectedCols.includes(tc));
          const extra = detectedCols.filter((dc) => !templateColumns.includes(dc));

          if (missing.length > 0) {
            setError(
              `Columnas faltantes en el archivo: ${missing.join(', ')}. Descarga la plantilla para ver el formato correcto.`
            );
            setIsLoading(false);
            return;
          }
          if (extra.length > 0) {
            setError(
              `Columnas no reconocidas: ${extra.join(', ')}. El archivo debe coincidir exactamente con la plantilla.`
            );
            setIsLoading(false);
            return;
          }
        }

        const columnsWithTypes: DetectedColumn[] = detectedCols.map((colName) => ({
          name: colName,
          description: '',
          dataType: inferDataType(jsonData.map((row) => row[colName])),
        }));

        setFileName(file.name);
        setAllData(jsonData);
        setPreviewRows(jsonData.slice(0, 5));
        setColumns(columnsWithTypes);
      } catch {
        setError('Error al leer el archivo. Verifica que sea un archivo Excel válido.');
      } finally {
        setIsLoading(false);
      }
    },
    [mode, templateColumns]
  );

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleColumnDescriptionChange = (index: number, description: string) => {
    setColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, description } : col))
    );
  };

  const handleUpload = () => {
    const missingDescriptions = columns.filter((col) => !col.description.trim());
    if (missingDescriptions.length > 0) {
      setError(
        `Describe todas las columnas. Faltan: ${missingDescriptions.map((c) => c.name).join(', ')}`
      );
      return;
    }

    onUpload({
      name: fileName || 'Sin nombre',
      data: allData,
      columns,
      isQueryable,
    });

    reset();
  };

  const hasFile = fileName && columns.length > 0;

  return (
    <div className="space-y-6">
      {/* Template download button */}
      {mode === 'template' && templateColumns && (
        <div className="flex items-center gap-3">
          <TemplateDownloader
            templateName="plantilla"
            columns={templateColumns.map((c) => ({ name: c, example: '' }))}
          />
          <span className="text-sm text-surface-500">
            Descarga la plantilla para asegurar el formato correcto
          </span>
        </div>
      )}

      {/* Drop zone */}
      {!hasFile && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12',
            'transition-colors duration-200 cursor-pointer',
            isDragOver
              ? 'border-primary-500 bg-primary-50/50'
              : 'border-surface-200 bg-surface-50/50 hover:border-surface-300 hover:bg-surface-50',
            isLoading && 'pointer-events-none opacity-60'
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileSelect}
          />

          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 text-primary-500 animate-spin" />
              <p className="text-sm text-surface-600">Procesando archivo...</p>
            </div>
          ) : (
            <>
              <FileSpreadsheet
                className={cn(
                  'h-12 w-12 mb-4',
                  isDragOver ? 'text-primary-500' : 'text-surface-400'
                )}
              />
              <p className="text-base font-medium text-surface-700">
                Arrastra tu archivo Excel aquí
              </p>
              <p className="mt-1 text-sm text-surface-500">
                <span className="text-primary-500 font-medium hover:underline">
                  o selecciona un archivo
                </span>
              </p>
              <p className="mt-3 text-xs text-surface-400">
                Formatos: .xlsx, .xls, .csv
              </p>
            </>
          )}
        </motion.div>
      )}

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3"
          >
            <AlertCircle className="h-5 w-5 text-danger-500 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-700">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File preview */}
      <AnimatePresence>
        {hasFile && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* File info bar */}
            <div className="flex items-center justify-between rounded-lg border border-surface-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-accent-500" />
                <div>
                  <p className="text-sm font-medium text-surface-800">{fileName}</p>
                  <p className="text-xs text-surface-500">
                    {allData.length} filas &middot; {columns.length} columnas
                  </p>
                </div>
              </div>
              <button
                onClick={reset}
                className="rounded-md p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Preview table */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-surface-700">
                Vista previa (primeras 5 filas)
              </h3>
              <div className="overflow-x-auto rounded-lg border border-surface-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50">
                      {columns.map((col) => (
                        <th
                          key={col.name}
                          className="whitespace-nowrap px-4 py-2.5 text-left font-medium text-surface-600"
                        >
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="border-b border-surface-100 last:border-b-0"
                      >
                        {columns.map((col) => (
                          <td
                            key={col.name}
                            className="whitespace-nowrap px-4 py-2 text-surface-700"
                          >
                            {String(row[col.name] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Column descriptions */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-surface-700">
                  Describe cada columna
                </h3>
                <p className="text-xs text-surface-500 mt-0.5">
                  Estas descripciones se usan en el prompt del agente de IA para que sepa qué datos puede consultar
                </p>
              </div>
              <div className="space-y-3">
                {columns.map((col, index) => (
                  <div
                    key={col.name}
                    className="flex items-start gap-4 rounded-lg border border-surface-100 bg-white p-4"
                  >
                    <div className="shrink-0 pt-1">
                      <span className="inline-flex items-center rounded-md bg-surface-100 px-2 py-1 text-xs font-mono font-medium text-surface-700">
                        {col.name}
                      </span>
                      <span className="ml-2 text-[10px] text-surface-400 uppercase tracking-wider">
                        {col.dataType}
                      </span>
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder={`¿Qué contiene la columna "${col.name}"?`}
                        value={col.description}
                        onChange={(e) =>
                          handleColumnDescriptionChange(index, e.target.value)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Queryable toggle */}
            <Toggle
              enabled={isQueryable}
              onChange={setIsQueryable}
              label="¿Consultable por la IA?"
              description="Permite que el agente de IA consulte esta base de conocimiento para responder preguntas"
            />

            {/* Upload button */}
            <div className="flex justify-end">
              <Button onClick={handleUpload} icon={<CheckCircle2 className="h-4 w-4" />}>
                Confirmar y cargar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { ExcelUploader };
export type { ExcelUploaderProps, UploadPayload, DetectedColumn };
