'use client';

import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';

/**
 * Role hierarchy helpers for Maasai Heritage Market.
 * CEO > Manager > Agent / Seller > Buyer
 */
export function useUserRole() {
  const { user, profile, loading } = useAuth();

  const role: UserRole | null = profile?.role ?? null;

  return useMemo(() => {
    // ── Specific role checks ────────────────────────────────
    const isCEO     = role === 'ceo' || role === 'admin'; // 'admin' kept for backwards-compat
    const isManager = role === 'manager';
    const isAgent   = role === 'agent';
    const isSeller  = role === 'seller';
    const isBuyer   = role === 'buyer';

    // ── Composite checks ──────────────────────────────────
    const isStaff          = isCEO || isManager;
    const isOpsTeam        = isCEO || isManager || isAgent;
    const canAccessAdmin   = isCEO;
    const canAccessManager = isCEO || isManager;
    const canAccessAgent   = isAgent;

    // ── Permission helpers ─────────────────────────────────
    const canApproveListings      = isCEO || isManager;
    const canAssignRoles          = isCEO;
    const canAssignAgents         = isCEO || isManager;
    const canViewAllOrders        = isCEO || isManager;
    const canUpdateOrderStatus    = isCEO || isManager || isAgent;
    const canEditPlatformSettings = isCEO;
    const canHandleDisputes       = isCEO || isManager;
    const canViewAnalytics        = isCEO || isManager;
    const agentTown               = isAgent ? (profile?.town ?? null) : null;

    return {
      role, profile, user, loading,
      isCEO, isManager, isAgent, isSeller, isBuyer,
      isStaff, isOpsTeam,
      canAccessAdmin, canAccessManager, canAccessAgent,
      canApproveListings, canAssignRoles, canAssignAgents,
      canViewAllOrders, canUpdateOrderStatus, canEditPlatformSettings,
      canHandleDisputes, canViewAnalytics,
      agentTown,
    } as const;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, profile, user, loading]);
}

/** Server-side role check utility (use in Server Components / Route Handlers) */
export function hasRole(role: UserRole | null, ...allowedRoles: UserRole[]): boolean {
  if (!role) return false;
  // Treat 'admin' as 'ceo' for backwards compatibility
  const effectiveRole = role === 'admin' ? 'ceo' : role;
  return allowedRoles.some((r) => (r === 'ceo' ? effectiveRole === 'ceo' : effectiveRole === r));
}

export function isStaffRole(role: UserRole | null): boolean {
  return hasRole(role, 'ceo', 'admin', 'manager');
}
