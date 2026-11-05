import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import {
  deleteCustomerAccount,
  logoutRemote,
  registerBusiness as registerBusinessRequest,
  registerCustomer,
  restoreSession,
  signIn as signInRequest,
} from '@/api/auth';
import type { BusinessSignupInput } from '@/api/onboarding';
import { clearPreferences, readActiveTenantId, writeActiveTenantId } from '@/lib/preferences';
import { clearSession } from '@/lib/session-store';
import { onUnauthorized } from '@/lib/http';
import type { Membership, SessionUser } from '@/types';
import { homePathForRole, resolveAdminRole, tenantMemberships, type SessionRole } from './roles';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'error'; message: string }
  | {
      status: 'authenticated';
      role: SessionRole;
      user: SessionUser;
      activeTenant: Membership | null;
    };

type AuthContextValue = {
  status: AuthState['status'];
  role: SessionRole | null;
  user: SessionUser | null;
  memberships: Membership[];
  activeTenant: Membership | null;
  bootError: string | null;
  signIn: (identifier: string, password: string) => Promise<SessionRole>;
  register: (input: {
    name: string;
    email?: string;
    mobileNumber?: string;
    password: string;
  }) => Promise<SessionRole>;
  registerBusiness: (input: BusinessSignupInput) => Promise<SessionRole>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<void>;
  retryBootstrap: () => void;
  selectTenant: (tenantId: string) => Promise<void>;
  goHome: (role?: SessionRole | null) => string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function resolveActiveTenant(
  user: SessionUser,
  savedTenantId: string | null,
  role: SessionRole,
): Membership | null {
  if (role !== 'tenant_admin') {
    return null;
  }
  const memberships = tenantMemberships(user);
  if (memberships.length === 0) {
    return null;
  }
  return memberships.find((membership) => membership.tenantId === savedTenantId) ?? memberships[0] ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [bootstrapNonce, setBootstrapNonce] = useState(0);
  const signingOut = useRef(false);
  const lastForegroundCheck = useRef(0);

  const bootstrap = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const [session, savedTenantId] = await Promise.all([restoreSession(), readActiveTenantId()]);

      if (!session) {
        await clearSession();
        await clearPreferences();
        setState({ status: 'anonymous' });
        return;
      }

      const role = session.role;
      if (role === 'tenant_admin' && tenantMemberships(session.user).length === 0) {
        await clearSession();
        setState({ status: 'anonymous' });
        return;
      }

      const activeTenant = resolveActiveTenant(session.user, savedTenantId, role);
      setState({ status: 'authenticated', role, user: session.user, activeTenant });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error && error.message.startsWith('Cannot reach')
            ? error.message
            : 'Neara could not verify your session. Check your connection and try again.',
      });
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap, bootstrapNonce]);

  const forceLocalSignOut = useCallback(async () => {
    if (signingOut.current) {
      return;
    }
    signingOut.current = true;
    try {
      await clearSession();
      await clearPreferences();
      setState({ status: 'anonymous' });
    } finally {
      signingOut.current = false;
    }
  }, []);

  // Any session-bound 401 means the server no longer trusts this session.
  useEffect(() => onUnauthorized(() => void forceLocalSignOut()), [forceLocalSignOut]);

  const applySession = useCallback(
    async (role: SessionRole, user: SessionUser) => {
      const savedTenantId = await readActiveTenantId();
      const activeTenant = resolveActiveTenant(user, savedTenantId, role);
      setState({ status: 'authenticated', role, user, activeTenant });
      return role;
    },
    [],
  );

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      const outcome = await signInRequest(identifier, password);
      await applySession(outcome.role, outcome.user);
      return outcome.role;
    },
    [applySession],
  );

  const register = useCallback(
    async (input: { name: string; email?: string; mobileNumber?: string; password: string }) => {
      const response = await registerCustomer(input);
      const user: SessionUser = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        mobileNumber: response.user.mobileNumber,
        platformRole: 'none',
        memberships: [],
      };
      await applySession('customer', user);
      return 'customer' as const;
    },
    [applySession],
  );

  const registerBusiness = useCallback(
    async (input: BusinessSignupInput) => {
      const outcome = await registerBusinessRequest(input);
      await applySession(outcome.role, outcome.user);
      return outcome.role;
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    if (state.status === 'authenticated') {
      // Best effort: local material is erased even if the API is unreachable.
      await logoutRemote(state.role).catch(() => undefined);
    }
    await clearSession();
    await clearPreferences();
    setState({ status: 'anonymous' });
  }, [state]);

  const deleteAccount = useCallback(async () => {
    await deleteCustomerAccount();
    await clearSession();
    await clearPreferences();
    setState({ status: 'anonymous' });
  }, []);

  const refresh = useCallback(async () => {
    const session = await restoreSession();
    if (!session) {
      await forceLocalSignOut();
      return;
    }
    const role = session.role === 'customer' ? 'customer' : resolveAdminRole(session.user);
    if (!role) {
      await forceLocalSignOut();
      return;
    }
    await applySession(role, session.user);
  }, [applySession, forceLocalSignOut]);

  // Revalidate a live session when the app returns to the foreground so a
  // revoked or expired server session cannot keep showing privileged screens.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || state.status !== 'authenticated') {
        return;
      }
      const now = Date.now();
      if (now - lastForegroundCheck.current < 60_000) {
        return;
      }
      lastForegroundCheck.current = now;
      refresh().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [state.status, refresh]);

  const selectTenant = useCallback(
    async (tenantId: string) => {
      if (state.status !== 'authenticated') {
        return;
      }
      const membership = tenantMemberships(state.user).find((item) => item.tenantId === tenantId);
      if (!membership) {
        // Never let a locally chosen tenant escape the server-issued membership list.
        return;
      }
      await writeActiveTenantId(membership.tenantId);
      setState({ ...state, activeTenant: membership });
    },
    [state],
  );

  const memberships = useMemo(
    () => (state.status === 'authenticated' ? tenantMemberships(state.user) : []),
    [state],
  );

  const value = useMemo<AuthContextValue>(() => {
    const role = state.status === 'authenticated' ? state.role : null;
    return {
      status: state.status,
      role,
      user: state.status === 'authenticated' ? state.user : null,
      memberships,
      activeTenant: state.status === 'authenticated' ? state.activeTenant : null,
      bootError: state.status === 'error' ? state.message : null,
      signIn,
      register,
      registerBusiness,
      signOut,
      deleteAccount,
      refresh,
      retryBootstrap: () => setBootstrapNonce((value) => value + 1),
      selectTenant,
      goHome: (overrideRole) => homePathForRole(overrideRole ?? role ?? 'customer'),
    };
  }, [state, memberships, signIn, register, registerBusiness, signOut, deleteAccount, refresh, selectTenant]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
