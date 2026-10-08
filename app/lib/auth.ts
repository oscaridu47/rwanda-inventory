"use client";

import type {
  AppRole,
  Permission,
} from "./permissions";

import { supabase } from "./supabase";

export type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  businessId?: string | null;
  role: AppRole;
  permissions?: Permission[];
  active: boolean;
  createdAt: string;
};

export type CachedBusiness = {
  id: string;
  businessName: string;
  ownerUserId: string;
  status: string;
  paymentStatus: string;
  plan: string;
  subscriptionStartDate?: string | null;
  subscriptionEndDate?: string | null;
  createdAt: string;
  updatedAt?: string;
};

/*
 * IMPORTANT
 *
 * Passwords are NO LONGER stored in localStorage.
 *
 * Supabase Auth is responsible for:
 * - passwords
 * - sessions
 * - authentication
 * - password recovery
 *
 * localStorage is used only as a temporary UI cache.
 */

const USER_CACHE_KEY =
  "rwanda-inventory-user-cache";

const SESSION_STORAGE_KEY =
  "rwanda-inventory-session";

const USERS_CHANGED_EVENT =
  "rwanda-inventory-users-changed";

const BUSINESS_STORAGE_KEY =
  "rwanda-inventory-businesses";

const LEGACY_USERS_STORAGE_KEY =
  "rwanda-inventory-users";

/*
 * -------------------------------------------------------
 * Internal helpers
 * -------------------------------------------------------
 */

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readCachedUsers(): User[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const stored =
      localStorage.getItem(
        USER_CACHE_KEY
      );

    if (!stored) {
      return [];
    }

    const parsed =
      JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

function writeCachedUsers(
  users: User[]
): void {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(
    USER_CACHE_KEY,
    JSON.stringify(users)
  );

  notifyUsersChanged();
}

function clearAuthenticationCache(): void {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(
    SESSION_STORAGE_KEY
  );

  localStorage.removeItem(
    USER_CACHE_KEY
  );

  notifyUsersChanged();
}

function removeLegacyPasswordStorage(): void {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(
    LEGACY_USERS_STORAGE_KEY
  );
}

function cacheBusiness(
  business: CachedBusiness
): void {
  if (!isBrowser()) {
    return;
  }

  try {
    const stored =
      localStorage.getItem(
        BUSINESS_STORAGE_KEY
      );

    let businesses: CachedBusiness[] = [];

    if (stored) {
      const parsed =
        JSON.parse(stored);

      if (Array.isArray(parsed)) {
        businesses = parsed;
      }
    }

    const existingIndex =
      businesses.findIndex(
        (item) =>
          item.id === business.id
      );

    if (existingIndex >= 0) {
      businesses[existingIndex] =
        business;
    } else {
      businesses.push(business);
    }

    localStorage.setItem(
      BUSINESS_STORAGE_KEY,
      JSON.stringify(businesses)
    );
  } catch {
    /*
     * Cache errors must never
     * break authentication.
     */
  }
}

function removeUserFromCache(
  userId: string
): void {
  if (!isBrowser()) {
    return;
  }

  const users =
    readCachedUsers();

  const updated =
    users.filter(
      (user) => user.id !== userId
    );

  writeCachedUsers(updated);
}

/*
 * -------------------------------------------------------
 * Public cache functions
 * -------------------------------------------------------
 */

export function cacheUsers(
  users: User[]
): void {
  if (!isBrowser()) {
    return;
  }

  const safeUsers =
    users.map(
      (user) => ({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        businessId:
          user.businessId ?? null,
        role: user.role,
        permissions:
          user.permissions ?? [],
        active: user.active,
        createdAt: user.createdAt,
      })
    );

  writeCachedUsers(
    safeUsers
  );
}

export function cacheCurrentUser(
  user: User
): void {
  if (!isBrowser()) {
    return;
  }

  const users =
    readCachedUsers();

  const existingIndex =
    users.findIndex(
      (item) =>
        item.id === user.id
    );

  if (existingIndex >= 0) {
    users[existingIndex] =
      user;
  } else {
    users.push(user);
  }

  writeCachedUsers(users);

  localStorage.setItem(
    SESSION_STORAGE_KEY,
    user.id
  );
}

export function cacheSupabaseBusiness(
  business: {
    id: string;
    name: string;
    status?: string | null;
    payment_status?: string | null;
    plan?: string | null;
    subscription_start_date?: string | null;
    subscription_end_date?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  },
  ownerUserId: string
): CachedBusiness {
  const cached: CachedBusiness = {
    id: business.id,
    businessName: business.name,
    ownerUserId,
    status:
      business.status ??
      "pending",
    paymentStatus:
      business.payment_status ??
      "pending",
    plan:
      business.plan ??
      "Basic",
    subscriptionStartDate:
      business.subscription_start_date ??
      null,
    subscriptionEndDate:
      business.subscription_end_date ??
      null,
    createdAt:
      business.created_at ??
      new Date().toISOString(),
    updatedAt:
      business.updated_at ??
      undefined,
  };

  cacheBusiness(cached);

  return cached;
}

/*
 * -------------------------------------------------------
 * User retrieval
 * -------------------------------------------------------
 */

export function getUsers(): User[] {
  return readCachedUsers();
}

export function getUserById(
  userId: string
): User | null {
  if (!userId) {
    return null;
  }

  return (
    getUsers().find(
      (user) =>
        user.id === userId
    ) ?? null
  );
}

export function getUsersByBusinessId(
  businessId: string
): User[] {
  if (!businessId) {
    return [];
  }

  return getUsers().filter(
    (user) =>
      user.businessId ===
      businessId
  );
}

export function getCurrentUser(): User | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const sessionUserId =
      localStorage.getItem(
        SESSION_STORAGE_KEY
      );

    if (!sessionUserId) {
      return null;
    }

    const user =
      getUserById(
        sessionUserId
      );

    if (!user) {
      return null;
    }

    if (!user.active) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export function getCurrentRole(): AppRole | null {
  const user =
    getCurrentUser();

  if (!user) {
    return null;
  }

  return user.role;
}

export function getCurrentBusinessId(): string | null {
  const user =
    getCurrentUser();

  if (!user) {
    return null;
  }

  return user.businessId ?? null;
}

export function getCurrentUserPermissions(): Permission[] {
  const user =
    getCurrentUser();

  if (!user) {
    return [];
  }

  return user.permissions ?? [];
}

export function getUserPermissions(
  userId: string
): Permission[] {
  const user =
    getUserById(userId);

  if (!user) {
    return [];
  }

  return user.permissions ?? [];
}

export function isLoggedIn(): boolean {
  return (
    getCurrentUser() !== null
  );
}

/*
 * -------------------------------------------------------
 * Supabase authentication hydration
 * -------------------------------------------------------
 */

export async function hydrateCurrentUser(): Promise<User | null> {
  removeLegacyPasswordStorage();

  const {
    data: {
      user: authUser,
    },
    error: authError,
  } =
    await supabase.auth.getUser();

  if (
    authError ||
    !authUser
  ) {
    clearAuthenticationCache();
    return null;
  }

  /*
   * Find active membership.
   */
  const {
    data: membership,
    error: membershipError,
  } =
    await supabase
      .from(
        "business_members"
      )
      .select(
        `
          id,
          business_id,
          role,
          permissions,
          active,
          created_at
        `
      )
      .eq(
        "user_id",
        authUser.id
      )
      .eq(
        "active",
        true
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

  if (
    membershipError ||
    !membership
  ) {
    clearAuthenticationCache();
    return null;
  }

  /*
   * Load profile.
   */
  const {
    data: profile,
  } =
    await supabase
      .from("profiles")
      .select(
        `
          id,
          full_name,
          username,
          email,
          created_at
        `
      )
      .eq(
        "id",
        authUser.id
      )
      .maybeSingle();

  /*
   * Load business.
   */
  const {
    data: business,
    error: businessError,
  } =
    await supabase
      .from("businesses")
      .select(
        `
          id,
          name,
          status,
          payment_status,
          plan,
          subscription_start_date,
          subscription_end_date,
          created_at,
          updated_at
        `
      )
      .eq(
        "id",
        membership.business_id
      )
      .maybeSingle();

  if (
    businessError ||
    !business
  ) {
    clearAuthenticationCache();
    return null;
  }

  const permissions: Permission[] =
    Array.isArray(
      membership.permissions
    )
      ? (
          membership.permissions as Permission[]
        )
      : [];

  const user: User = {
    id: authUser.id,

    name:
      profile?.full_name ??
      authUser.user_metadata
        ?.full_name ??
      authUser.email ??
      "User",

    username:
      profile?.username ??
      authUser.user_metadata
        ?.username ??
      authUser.email
        ?.split("@")[0] ??
      "user",

    email:
      profile?.email ??
      authUser.email ??
      "",

    businessId:
      membership.business_id,

    role:
      membership.role as AppRole,

    permissions,

    active:
      membership.active === true,

    createdAt:
      profile?.created_at ??
      authUser.created_at ??
      new Date().toISOString(),
  };

  cacheSupabaseBusiness(
    business,
    authUser.id
  );

  cacheCurrentUser(user);

  return user;
}

/*
 * -------------------------------------------------------
 * Current business
 * -------------------------------------------------------
 */

export async function getCurrentBusiness(): Promise<CachedBusiness | null> {
  const user =
    getCurrentUser();

  if (!user?.businessId) {
    return null;
  }

  const {
    data: business,
    error,
  } =
    await supabase
      .from("businesses")
      .select(
        `
          id,
          name,
          status,
          payment_status,
          plan,
          subscription_start_date,
          subscription_end_date,
          created_at,
          updated_at
        `
      )
      .eq(
        "id",
        user.businessId
      )
      .maybeSingle();

  if (
    error ||
    !business
  ) {
    return null;
  }

  return cacheSupabaseBusiness(
    business,
    user.id
  );
}

/*
 * -------------------------------------------------------
 * Platform administrator
 * -------------------------------------------------------
 */

export async function isPlatformAdmin(): Promise<boolean> {
  const {
    data,
    error,
  } =
    await supabase.rpc(
      "is_current_platform_admin"
    );

  if (error) {
    return false;
  }

  return data === true;
}

/*
 * -------------------------------------------------------
 * Logout
 * -------------------------------------------------------
 */

export function logout(): void {
  if (!isBrowser()) {
    return;
  }

  clearAuthenticationCache();

  void supabase.auth.signOut();
}

/*
 * -------------------------------------------------------
 * Notifications
 * -------------------------------------------------------
 */

export function notifyUsersChanged(): void {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(
    new Event(
      USERS_CHANGED_EVENT
    )
  );
}

export function subscribeToUsers(
  callback: () => void
): () => void {
  if (!isBrowser()) {
    return () => {};
  }

  window.addEventListener(
    USERS_CHANGED_EVENT,
    callback
  );

  return () => {
    window.removeEventListener(
      USERS_CHANGED_EVENT,
      callback
    );
  };
}

/*
 * -------------------------------------------------------
 * Remove cached user
 * -------------------------------------------------------
 */

export function removeCachedUser(
  userId: string
): void {
  if (!userId) {
    return;
  }

  removeUserFromCache(
    userId
  );
}