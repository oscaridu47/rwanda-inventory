import type {
  AppRole,
  Permission,
} from "./permissions";
import { getBusinessByOwnerUserId } from "./businesses";

export type User = {
  id: string;
  name: string;
  username: string;
  password: string;
  businessId?: string | null;
  role: AppRole;
  permissions?: Permission[];
  active: boolean;
  createdAt: string;
};

const USERS_STORAGE_KEY =
  "rwanda-inventory-users";

const SESSION_STORAGE_KEY =
  "rwanda-inventory-session";

const USERS_CHANGED_EVENT =
  "rwanda-inventory-users-changed";

/*
 * Get all users.
 */
export function getUsers(): User[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedUsers =
      localStorage.getItem(
        USERS_STORAGE_KEY,
      );

    if (!storedUsers) {
      return [];
    }

    const users = JSON.parse(
      storedUsers,
    );

    if (!Array.isArray(users)) {
      return [];
    }

    return users;
  } catch {
    return [];
  }
}

/*
 * Save all users.
 */
function saveUsers(users: User[]): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    USERS_STORAGE_KEY,
    JSON.stringify(users),
  );

  notifyUsersChanged();
}

/*
 * Get a user by ID.
 */
export function getUserById(
  userId: string,
): User | null {
  if (!userId) {
    return null;
  }

  return (
    getUsers().find(
      (user) => user.id === userId,
    ) ?? null
  );
}

/*
 * Get all users belonging to a business.
 */
export function getUsersByBusinessId(
  businessId: string,
): User[] {
  if (!businessId) {
    return [];
  }

  return getUsers().filter(
    (user) =>
      user.businessId === businessId,
  );
}

/*
 * Get the currently logged-in user.
 */
export function getCurrentUser(): User | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const sessionUserId =
      localStorage.getItem(
        SESSION_STORAGE_KEY,
      );

    if (!sessionUserId) {
      return null;
    }

    const user = getUserById(
      sessionUserId,
    );

    if (!user || !user.active) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/*
 * Get the current user's role.
 */
export function getCurrentRole(): AppRole | null {
  const user = getCurrentUser();

  if (!user) {
    return null;
  }

  return user.role;
}

/*
 * Get the current business ID.
 *
 * For newer accounts:
 *     user.businessId
 *
 * For older Owner accounts:
 *     find the business whose ownerUserId
 *     matches the current user.
 *
 * This allows old Owner accounts to continue
 * working without deleting existing data.
 */
export function getCurrentBusinessId(): string | null {
  const user = getCurrentUser();

  if (!user) {
    return null;
  }

  /*
   * New account structure.
   */
  if (user.businessId) {
    return user.businessId;
  }

  /*
   * Backward compatibility for an Owner created
   * before businessId was added.
   */
  if (user.role === "owner") {
    const business =
      getBusinessByOwnerUserId(user.id);

    if (business) {
      /*
       * Save the business connection so we don't
       * need to discover it again next time.
       */
      const users = getUsers();

      const updatedUsers =
        users.map((item) => {
          if (item.id !== user.id) {
            return item;
          }

          return {
            ...item,
            businessId: business.id,
          };
        });

      saveUsers(updatedUsers);

      return business.id;
    }
  }

  return null;
}

/*
 * Get the current user's permissions.
 */
export function getCurrentUserPermissions(): Permission[] {
  const user = getCurrentUser();

  if (!user) {
    return [];
  }

  return user.permissions ?? [];
}

/*
 * Get permissions for a specific user.
 */
export function getUserPermissions(
  userId: string,
): Permission[] {
  const user = getUserById(userId);

  if (!user) {
    return [];
  }

  return user.permissions ?? [];
}

/*
 * Check whether someone is logged in.
 */
export function isLoggedIn(): boolean {
  return getCurrentUser() !== null;
}

/*
 * Notify the application that users changed.
 */
export function notifyUsersChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new Event(USERS_CHANGED_EVENT),
  );
}

/*
 * Subscribe to user changes.
 */
export function subscribeToUsers(
  callback: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(
    USERS_CHANGED_EVENT,
    callback,
  );

  return () => {
    window.removeEventListener(
      USERS_CHANGED_EVENT,
      callback,
    );
  };
}

/*
 * Log out the current user.
 */
export function logout(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(
    SESSION_STORAGE_KEY,
  );
}