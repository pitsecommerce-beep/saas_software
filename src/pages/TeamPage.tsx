'use client';

import { useState } from 'react';
import type { Profile, TeamInvitation, UserRole } from '@/types';
import { motion } from 'framer-motion';
import { Users, ShieldCheck, ShoppingCart, Truck, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TeamMembers } from '@/components/team/TeamMembers';
import { InviteCode } from '@/components/team/InviteCode';

// TODO: Replace with useTeamStore when Supabase is connected

const mockMembers: Profile[] = [
  {
    id: '1',
    email: 'carlos.garcia@empresa.com',
    full_name: 'Carlos Garcia',
    avatar_url: undefined,
    role: 'gerente',
    team_id: 'team-1',
    is_active: true,
    created_at: '2025-01-15T10:00:00Z',
  },
  {
    id: '2',
    email: 'ana.martinez@empresa.com',
    full_name: 'Ana Martinez',
    avatar_url: undefined,
    role: 'vendedor',
    team_id: 'team-1',
    is_active: true,
    created_at: '2025-02-20T14:30:00Z',
  },
  {
    id: '3',
    email: 'luis.hernandez@empresa.com',
    full_name: 'Luis Hernandez',
    avatar_url: undefined,
    role: 'vendedor',
    team_id: 'team-1',
    is_active: true,
    created_at: '2025-03-05T09:15:00Z',
  },
  {
    id: '4',
    email: 'maria.lopez@empresa.com',
    full_name: 'Maria Lopez',
    avatar_url: undefined,
    role: 'logistica',
    team_id: 'team-1',
    is_active: true,
    created_at: '2025-03-10T11:45:00Z',
  },
  {
    id: '5',
    email: 'pedro.ramirez@empresa.com',
    full_name: 'Pedro Ramirez',
    avatar_url: undefined,
    role: 'logistica',
    team_id: 'team-1',
    is_active: false,
    created_at: '2025-04-01T08:00:00Z',
  },
];

const mockInvitations: TeamInvitation[] = [
  {
    id: 'inv-1',
    team_id: 'team-1',
    email: 'sofia.torres@empresa.com',
    role: 'vendedor',
    status: 'pending',
    created_at: '2026-03-20T16:00:00Z',
  },
  {
    id: 'inv-2',
    team_id: 'team-1',
    email: 'diego.morales@empresa.com',
    role: 'logistica',
    status: 'pending',
    created_at: '2026-03-22T10:30:00Z',
  },
];

const roleLabels: Record<UserRole, string> = {
  gerente: 'Gerente',
  vendedor: 'Vendedor',
  logistica: 'Logistica',
};

const roleIcons: Record<UserRole, typeof ShieldCheck> = {
  gerente: ShieldCheck,
  vendedor: ShoppingCart,
  logistica: Truck,
};

const roleBadgeVariant: Record<UserRole, string> = {
  gerente: 'bg-primary-500 text-white border-primary-500',
  vendedor: 'bg-accent-500 text-white border-accent-500',
  logistica: 'bg-warning-500 text-white border-warning-500',
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

export default function TeamPage() {
  const [members, setMembers] = useState<Profile[]>(mockMembers);
  const [invitations, setInvitations] = useState<TeamInvitation[]>(mockInvitations);
  const [inviteCode, setInviteCode] = useState('EQUIPO-A7X9K2');

  const currentUserRole: UserRole = 'gerente';

  // Stats
  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.is_active).length;
  const roleCounts = members.reduce(
    (acc, m) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    },
    {} as Record<UserRole, number>
  );

  const handleRemove = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const handleRoleChange = (memberId: string, newRole: UserRole) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
  };

  const handleRegenerate = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let newCode = 'EQUIPO-';
    for (let i = 0; i < 6; i++) {
      newCode += chars[Math.floor(Math.random() * chars.length)];
    }
    setInviteCode(newCode);
  };

  const handleAcceptInvitation = (invitationId: string) => {
    setInvitations((prev) =>
      prev.map((inv) =>
        inv.id === invitationId ? { ...inv, status: 'accepted' as const } : inv
      )
    );
  };

  const handleRejectInvitation = (invitationId: string) => {
    setInvitations((prev) =>
      prev.map((inv) =>
        inv.id === invitationId ? { ...inv, status: 'rejected' as const } : inv
      )
    );
  };

  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending');

  const stats = [
    {
      label: 'Total Miembros',
      value: totalMembers,
      sublabel: `${activeMembers} activos`,
      icon: Users,
      color: 'text-primary-500',
      bg: 'bg-primary-50',
    },
    ...(['gerente', 'vendedor', 'logistica'] as UserRole[]).map((role) => {
      const Icon = roleIcons[role];
      return {
        label: roleLabels[role] + 's',
        value: roleCounts[role] || 0,
        sublabel: undefined as string | undefined,
        icon: Icon,
        color:
          role === 'gerente'
            ? 'text-primary-500'
            : role === 'vendedor'
              ? 'text-accent-500'
              : 'text-warning-500',
        bg:
          role === 'gerente'
            ? 'bg-primary-50'
            : role === 'vendedor'
              ? 'bg-accent-50'
              : 'bg-warning-50',
      };
    }),
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 p-6 max-w-6xl mx-auto"
    >
      {/* Page header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-surface-900">Equipo</h1>
        <p className="mt-1 text-sm text-surface-500">
          Administra los miembros de tu equipo e invitaciones
        </p>
      </motion.div>

      {/* Stats summary */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}
                >
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-surface-900">{stat.value}</p>
                  <p className="text-xs text-surface-500">{stat.label}</p>
                  {stat.sublabel && (
                    <p className="text-[10px] text-surface-400">{stat.sublabel}</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </motion.div>

      {/* Invite code section */}
      <motion.div variants={item} className="max-w-lg mx-auto">
        <InviteCode
          code={inviteCode}
          onRegenerate={handleRegenerate}
          canRegenerate={currentUserRole === 'gerente'}
        />
      </motion.div>

      {/* Team members section */}
      <motion.div variants={item} className="space-y-4">
        <h2 className="text-lg font-semibold text-surface-900">Miembros del Equipo</h2>
        <TeamMembers
          members={members}
          currentUserRole={currentUserRole}
          onRemove={handleRemove}
          onRoleChange={handleRoleChange}
        />
      </motion.div>

      {/* Pending invitations section */}
      <motion.div variants={item} className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-surface-900">
            Invitaciones Pendientes
          </h2>
          {pendingInvitations.length > 0 && (
            <Badge variant="info" size="sm">
              {pendingInvitations.length}
            </Badge>
          )}
        </div>

        {pendingInvitations.length === 0 ? (
          <Card>
            <p className="text-sm text-surface-500 text-center py-4">
              No hay invitaciones pendientes
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingInvitations.map((invitation, index) => (
              <motion.div
                key={invitation.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.25 }}
              >
                <Card>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-100">
                        <Clock className="h-4 w-4 text-surface-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-surface-900">
                          {invitation.email}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            className={roleBadgeVariant[invitation.role]}
                            size="sm"
                          >
                            {roleLabels[invitation.role]}
                          </Badge>
                          <span className="text-xs text-surface-400">
                            {new Date(invitation.created_at).toLocaleDateString('es-MX', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {currentUserRole === 'gerente' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRejectInvitation(invitation.id)}
                          icon={<XCircle className="h-4 w-4" />}
                        >
                          Rechazar
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAcceptInvitation(invitation.id)}
                          icon={<CheckCircle2 className="h-4 w-4" />}
                        >
                          Aceptar
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
