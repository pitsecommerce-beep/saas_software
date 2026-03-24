'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, RefreshCw, Link as LinkIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface InviteCodeProps {
  code: string;
  onRegenerate: () => void;
  canRegenerate: boolean;
}

function InviteCode({ code, onRegenerate, canRegenerate }: InviteCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="relative overflow-hidden">
      {/* Decorative gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-accent-500" />

      <div className="flex flex-col items-center text-center py-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 mb-4">
          <LinkIcon className="h-6 w-6 text-primary-500" />
        </div>

        <h3 className="text-lg font-semibold text-surface-900 mb-1">
          Codigo de invitacion
        </h3>
        <p className="text-sm text-surface-500 mb-5 max-w-xs">
          Comparte este codigo con tu equipo para que se unan
        </p>

        {/* Code display */}
        <div className="w-full max-w-sm rounded-xl bg-surface-50 border border-surface-200 px-6 py-4 mb-4">
          <p className="font-mono text-2xl font-bold tracking-widest text-surface-900 select-all">
            {code}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={handleCopy}
            icon={
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Check className="h-4 w-4" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Copy className="h-4 w-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            }
          >
            {copied ? 'Copiado!' : 'Copiar codigo'}
          </Button>

          {canRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Regenerar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export { InviteCode };
export type { InviteCodeProps };
