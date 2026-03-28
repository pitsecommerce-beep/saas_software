'use client';

import { useEffect, useState } from 'react';
import type { UserRole } from '@/types';
import { motion } from 'framer-motion';
import { Users, ShieldCheck, ShoppingCart, Truck, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useDemoStore } from '@/stores/demoStore';
import { useAuthStore } from '@/stores/authStore';
import { useTeamStore } from '@/stores/teamStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TeamMembers } from '@/components/team/TeamMembers';
import { InviteCode } from '@/components/team/InviteCode';

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
  const { isDemoMode } = useDemoStore();
  const { profile, team, fetchTeam } = useAuthStore();
  const {
    members,
    invitations,
    loading,
    fetchMembers,
    fetchInvitations,
    removeMember,
    updateMemberRole,
    acceptInvitation,
    rejectInvitation,
    regenerateInviteCode,
  } = useTeamStore();

  const [inviteCode, setInviteCode] = useState(team?.invite_code ?? '');
  const [regenerating, setRegenerating] = useState(false);

  // Fetch real data from Supabase on mount
  useEffect(() => {
    if (isDemoMode || !team?.id) return;
    fetchMembers(team.id);
    fetchInvitations(team.id);
  }, [isDemoMode, team?.id, fetchMembers, fetchInvitations]);

  // Keep invite code in sync with team data
  useEffect(() => {
    if (team?.invite_code) {
      setInviteCode(team.invite_code);
    }
  }, [team?.invite_code]);

  const currentUserRole: UserRole = profile?.role ?? 'vendedor';

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

  const handleRemove = async (memberId: string) => {
    await removeMember(memberId);
  };

  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    await updateMemberRole(memberId, newRole);
  };

  const handleRegenerate = async () => {
    if (!team?.id || regenerating) return;
    setRegenerating(true);
    try {
      const newCode = await regenerateInviteCode(team.id);
      setInviteCode(newCode);
      // Refresh team data in authStore so it stays in sync
      await fetchTeam();
    } catch (err) {
      console.error('Error regenerating invite code:', err);
    } finally {
      setRegenerating(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    await acceptInvitation(invitationId);
  };

  const handleRejectInvitation = async (invitationId: string) => {
    await rejectInvitation(invitationId);
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
        {loading && members.length === 0 ? (
          <Card>
            <p className="text-sm text-surface-500 text-center py-4">
              Cargando miembros...
            </p>
          </Card>
        ) : members.length === 0 ? (
          <Card>
            <p className="text-sm text-surface-500 text-center py-4">
              No hay miembros en el equipo
            </p>
          </Card>
        ) : (
          <TeamMembers
            members={members}
            currentUserRole={currentUserRole}
            onRemove={handleRemove}
            onRoleChange={handleRoleChange}
          />
        )}
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
                            className={
                              invitation.role === 'gerente'
                                ? 'bg-primary-500 text-white border-primary-500'
                                : invitation.role === 'vendedor'
                                  ? 'bg-accent-500 text-white border-accent-500'
                                  : 'bg-warning-500 text-white border-warning-500'
                            }
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
