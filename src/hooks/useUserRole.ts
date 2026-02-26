'use client';

import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';

/**
 * Role hierarchy helpers for Maasai Heritage Market.
 * CEO > Manager > Agent / Seller > Buyer
 */
export function useUserRole() {
  const { user, profile, loading } = useAuth();

  const role: UserRole | null = profile?.role ?? null;

  // ── Specific role checks ──────────────────────────────────
  const isCEO     = role === 'ceo' || role === 'admin'; // 'admin' kept for backwards-compat
  const isManager = role === 'manager';
  const isAgent   = role === 'agent';
  const isSeller  = role === 'seller';
  const isBuyer   = role === 'buyer';

  // ── Composite checks ─────────────────────────────────────
  /** CEO + Manager */
  const isStaff        = isCEO || isManager;
  /** CEO + Manager + Agent (internal ops) */
  const isOpsTeam      = isCEO || isManager || isAgent;
  /** Can access /admin routes */
  const canAccessAdmin  = isCEO;
  /** Can access /manager routes */
  const canAccessManager = isCEO || isManager;
  /** Can access /agent routes */
  const canAccessAgent   = isAgent;

  // ── Permission helpers ────────────────────────────────────
  /** Can approve or reject listings / verifications */
  const canApproveListings      = isCEO || isManager;
  /** Can assign roles to users */
  const canAssignRoles          = isCEO;
  /** Can assign agents to orders */
  const canAssignAgents         = isCEO || isManager;
  /** Can view all orders across the platform */
  const canViewAllOrders        = isCEO || isManager;
  /** Can update order status */
  const canUpdateOrderStatus    = isCEO || isManager || isAgent;
  /** Can modify platform settings */
  const canEditPlatformSettings = isCEO;
  /** Can handle disputes */
  const canHandleDisputes       = isCEO || isManager;
  /** Can view platform analytics */
  const canViewAnalytics        = isCEO || isManager;

  // ── Agent-specific ───────────────────────────────────────
  /** Agent's assigned town */
  const agentTown = isAgent ? (profile?.town ?? null) : null;

  return {
    // Raw
    role,
    profile,
    user,
    loading,
    // Role flags
    isCEO,
    isManager,
    isAgent,
    isSeller,
    isBuyer,
    // Composite
    isStaff,
    isOpsTeam,
    // Route access
    canAccessAdmin,
    canAccessManager,
    canAccessAgent,
    // Permissions
    canApproveListings,
    canAssignRoles,
    canAssignAgents,
    canViewAllOrders,
    canUpdateOrderStatus,
    canEditPlatformSettings,
    canHandleDisputes,
    canViewAnalytics,
    // Agent
    agentTown,
  } as const;
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
