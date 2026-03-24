'use client';

import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface TemplateColumn {
  name: string;
  example: string;
}

interface TemplateDownloaderProps {
  templateName: string;
  columns: TemplateColumn[];
}

function TemplateDownloader({ templateName, columns }: TemplateDownloaderProps) {
  const handleDownload = () => {
    const headers = columns.map((col) => col.name);
    const exampleRow = columns.map((col) => col.example);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);

    // Auto-size columns based on content
    worksheet['!cols'] = columns.map((col) => ({
      wch: Math.max(col.name.length, col.example.length) + 4,
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla');

    XLSX.writeFile(workbook, `${templateName}.xlsx`);
  };

  return (
    <Button
      variant="secondary"
      size="md"
      icon={<Download className="h-4 w-4" />}
      onClick={handleDownload}
    >
      Descargar Plantilla
    </Button>
  );
}

export { TemplateDownloader };
export type { TemplateDownloaderProps, TemplateColumn };
