'use client';

import { useState } from 'react';
import type { Profile, UserRole } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical, ShieldCheck, UserMinus, ChevronDown } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';

const roleConfig: Record<UserRole, { label: string; className: string }> = {
  gerente: { label: 'Gerente', className: 'bg-primary-500 text-white border-primary-500' },
  vendedor: { label: 'Vendedor', className: 'bg-accent-500 text-white border-accent-500' },
  logistica: { label: 'Logistica', className: 'bg-warning-500 text-white border-warning-500' },
};

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'gerente', label: 'Gerente' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'logistica', label: 'Logistica' },
];

interface TeamMembersProps {
  members: Profile[];
  currentUserRole: UserRole;
  onRemove: (memberId: string) => void;
  onRoleChange: (memberId: string, newRole: UserRole) => void;
}

function TeamMembers({ members, currentUserRole, onRemove, onRoleChange }: TeamMembersProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [roleDropdownId, setRoleDropdownId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const isGerente = currentUserRole === 'gerente';
  const memberToRemove = members.find((m) => m.id === confirmRemoveId);

  const handleRoleChange = (memberId: string, newRole: UserRole) => {
    onRoleChange(memberId, newRole);
    setRoleDropdownId(null);
    setMenuOpenId(null);
  };

  const handleConfirmRemove = () => {
    if (confirmRemoveId) {
      onRemove(confirmRemoveId);
      setConfirmRemoveId(null);
      setMenuOpenId(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member, index) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.3, ease: 'easeOut' }}
          >
            <Card className="relative">
              {/* Actions menu (gerente only) */}
              {isGerente && (
                <div className="absolute top-3 right-3">
                  <button
                    onClick={() =>
                      setMenuOpenId(menuOpenId === member.id ? null : member.id)
                    }
                    className="rounded-lg p-1.5 text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors duration-150"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  <AnimatePresence>
                    {menuOpenId === member.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-9 z-10 w-48 rounded-xl border border-surface-100 bg-white py-1.5 shadow-lg"
                      >
                        {/* Change role */}
                        <button
                          onClick={() =>
                            setRoleDropdownId(
                              roleDropdownId === member.id ? null : member.id
                            )
                          }
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                        >
                          <ShieldCheck className="h-4 w-4 text-surface-400" />
                          Cambiar rol
                          <ChevronDown className="ml-auto h-3.5 w-3.5 text-surface-400" />
                        </button>

                        <AnimatePresence>
                          {roleDropdownId === member.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden"
                            >
                              {roleOptions.map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => handleRoleChange(member.id, opt.value)}
                                  className={`flex w-full items-center gap-2 pl-9 pr-3 py-1.5 text-sm transition-colors ${
                                    member.role === opt.value
                                      ? 'text-primary-600 bg-primary-50 font-medium'
                                      : 'text-surface-600 hover:bg-surface-50'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="my-1 border-t border-surface-100" />

                        {/* Remove */}
                        <button
                          onClick={() => {
                            setConfirmRemoveId(member.id);
                            setMenuOpenId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger-600 hover:bg-danger-50 transition-colors"
                        >
                          <UserMinus className="h-4 w-4" />
                          Remover del equipo
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Member info */}
              <div className="flex flex-col items-center text-center pt-2">
                <Avatar
                  src={member.avatar_url}
                  name={member.full_name}
                  size="lg"
                />
                <h3 className="mt-3 text-sm font-semibold text-surface-900 truncate max-w-full">
                  {member.full_name}
                </h3>
                <p className="mt-0.5 text-xs text-surface-500 truncate max-w-full">
                  {member.email}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <Badge className={roleConfig[member.role].className}>
                    {roleConfig[member.role].label}
                  </Badge>
                  <Badge variant={member.is_active ? 'success' : 'neutral'} size="sm">
                    {member.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Remove confirmation modal */}
      <Modal
        isOpen={!!confirmRemoveId}
        onClose={() => setConfirmRemoveId(null)}
        title="Confirmar eliminacion"
        size="sm"
      >
        <p className="text-sm text-surface-600 mb-6">
          Estas seguro de que deseas remover a{' '}
          <span className="font-semibold text-surface-900">
            {memberToRemove?.full_name}
          </span>{' '}
          del equipo? Esta accion no se puede deshacer.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setConfirmRemoveId(null)}>
            Cancelar
          </Button>
          <Button variant="danger" size="sm" onClick={handleConfirmRemove}>
            Remover
          </Button>
        </div>
      </Modal>
    </>
  );
}

export { TeamMembers };
export type { TeamMembersProps };
