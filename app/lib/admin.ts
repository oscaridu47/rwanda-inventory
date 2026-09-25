export type AdminSession = {
  adminId: string;
  username: string;
  name: string;
};

export type AdminAccount = {
  id: string;
  name: string;
  username: string;
  password: string;
  createdAt: string;
};

const ADMIN_SESSION_KEY =
  "rwanda-inventory-admin-session";

const ADMIN_SETUP_KEY =
  "rwanda-inventory-admin";

function createAdminId() {
  return `admin-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 10)}`;
}

export function getAdminAccount(): AdminAccount | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const saved = localStorage.getItem(
      ADMIN_SETUP_KEY,
    );

    if (!saved) {
      return null;
    }

    const admin = JSON.parse(saved);

    if (
      !admin ||
      typeof admin !== "object" ||
      !admin.id ||
      !admin.username ||
      typeof admin.password !== "string"
    ) {
      return null;
    }

    return admin as AdminAccount;
  } catch {
    return null;
  }
}

export function createAdminAccount({
  name,
  username,
  password,
}: {
  name: string;
  username: string;
  password: string;
}): AdminAccount | null {
  if (typeof window === "undefined") {
    return null;
  }

  const existingAdmin = getAdminAccount();

  if (existingAdmin) {
    return null;
  }

  const cleanName = name.trim();
  const cleanUsername =
    username.trim().toLowerCase();

  if (!cleanName || !cleanUsername || !password) {
    return null;
  }

  const admin: AdminAccount = {
    id: createAdminId(),
    name: cleanName,
    username: cleanUsername,
    password,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(
    ADMIN_SETUP_KEY,
    JSON.stringify(admin),
  );

  return admin;
}

export function loginAdmin(
  username: string,
  password: string,
): AdminSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const admin = getAdminAccount();

  if (!admin) {
    return null;
  }

  const cleanUsername =
    username.trim().toLowerCase();

  if (admin.username !== cleanUsername) {
    return null;
  }

  if (admin.password !== password) {
    return null;
  }

  const session: AdminSession = {
    adminId: admin.id,
    username: admin.username,
    name: admin.name,
  };

  localStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify(session),
  );

  return session;
}

export function getAdminSession():
  | AdminSession
  | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const saved = localStorage.getItem(
      ADMIN_SESSION_KEY,
    );

    if (!saved) {
      return null;
    }

    const session = JSON.parse(saved);

    if (
      !session ||
      !session.adminId ||
      !session.username
    ) {
      return null;
    }

    return session as AdminSession;
  } catch {
    return null;
  }
}

export function logoutAdmin() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(
    ADMIN_SESSION_KEY,
  );
}

export function isAdminLoggedIn(): boolean {
  return getAdminSession() !== null;
}