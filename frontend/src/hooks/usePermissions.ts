import { useMemo } from 'react';
import { useAuth } from '../components/AuthProvider';

export type AdminRole = 'superadmin' | 'admin' | 'operator' | 'readonly' | 'unknown';

export interface Permissions {
  role: AdminRole;
  canEdit: boolean;
  canDelete: boolean;
  canManageAdmins: boolean;
  canViewBilling: boolean;
  canManageNodes: boolean;
  canManageSettings: boolean;
  isReadOnly: boolean;
}

interface JwtPayload {
  sub?: string;
  role?: string;
  admin?: {
    role?: string;
    id?: string;
    email?: string;
  };
  exp?: number;
  [key: string]: unknown;
}

function base64UrlDecode(input: string): string {
  // Convert URL-safe base64 to standard base64
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with '=' if needed
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  try {
    // atob gives us a binary string; decode UTF-8 properly
    const binary = atob(padded);
    // Try to decode as UTF-8
    try {
      return decodeURIComponent(
        Array.from(binary)
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
    } catch {
      return binary;
    }
  } catch {
    return '';
  }
}

function decodeJwt(token: string | null): JwtPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const decoded = base64UrlDecode(parts[1]!);
    if (!decoded) return null;
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

function normaliseRole(raw: string | undefined): AdminRole {
  if (!raw) return 'unknown';
  const lower = raw.toLowerCase();
  if (lower === 'superadmin' || lower === 'super_admin' || lower === 'owner') {
    return 'superadmin';
  }
  if (lower === 'admin') return 'admin';
  if (lower === 'operator' || lower === 'support') return 'operator';
  if (lower === 'readonly' || lower === 'read_only' || lower === 'viewer') {
    return 'readonly';
  }
  return 'unknown';
}

export function usePermissions(): Permissions {
  const { token } = useAuth();

  return useMemo<Permissions>(() => {
    const payload = decodeJwt(token);
    const rawRole = payload?.admin?.role ?? payload?.role;
    const role = normaliseRole(
      typeof rawRole === 'string' ? rawRole : undefined,
    );

    // If we can't find a role at all, default to admin so existing deployments
    // don't break. Only restrict when we have an explicit read-only role.
    const effectiveRole: AdminRole = role === 'unknown' ? 'admin' : role;

    const isReadOnly = effectiveRole === 'readonly';
    const isOperator = effectiveRole === 'operator';
    const isAdmin = effectiveRole === 'admin' || effectiveRole === 'superadmin';
    const isSuperAdmin = effectiveRole === 'superadmin';

    return {
      role: effectiveRole,
      canEdit: !isReadOnly,
      canDelete: !isReadOnly && !isOperator,
      canManageAdmins: isSuperAdmin,
      canViewBilling: !isReadOnly || isAdmin,
      canManageNodes: isAdmin,
      canManageSettings: isAdmin,
      isReadOnly,
    };
  }, [token]);
}
