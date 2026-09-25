export type AppRole =
  | "owner"
  | "manager"
  | "staff"
  | "worker";

export type Permission =
  | "dashboard.view"
  | "products.view"
  | "products.create"
  | "products.edit"
  | "products.delete"
  | "stock.view"
  | "stock.receive"
  | "stock.adjust"
  | "stock.history"
  | "sales.view"
  | "sales.create"
  | "sales.history"
  | "reports.view"
  | "expenses.view"
  | "expenses.create"
  | "expenses.delete"
  | "accounts.view"
  | "accounts.create"
  | "accounts.manage"
  | "settings.manage";

/*
 * These are the default permissions for each role.
 *
 * IMPORTANT:
 * Roles are now mainly job titles.
 * An employee can have a custom list of permissions
 * selected by the Business Owner.
 */

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  owner: [
    "dashboard.view",

    "products.view",
    "products.create",
    "products.edit",
    "products.delete",

    "stock.view",
    "stock.receive",
    "stock.adjust",
    "stock.history",

    "sales.view",
    "sales.create",
    "sales.history",

    "reports.view",

    "expenses.view",
    "expenses.create",
    "expenses.delete",

    "accounts.view",
    "accounts.create",
    "accounts.manage",

    "settings.manage",
  ],

  manager: [
    "dashboard.view",

    "products.view",
    "products.create",
    "products.edit",

    "stock.view",
    "stock.receive",
    "stock.adjust",
    "stock.history",

    "sales.view",
    "sales.create",
    "sales.history",

    "reports.view",

    "expenses.view",
    "expenses.create",

    "accounts.view",
  ],

  staff: [
    "dashboard.view",

    "products.view",

    "stock.view",
    "stock.receive",

    "sales.view",
    "sales.create",
    "sales.history",
  ],

  worker: [
    "dashboard.view",

    "products.view",

    "stock.view",
    "stock.receive",
  ],
};

/*
 * Returns the default permissions for a role.
 *
 * This is useful when creating a new employee.
 * The Owner can then change these permissions
 * before saving the employee.
 */
export function getPermissions(
  role: AppRole,
): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

/*
 * Check a role's default permissions.
 */
export function hasRolePermission(
  role: AppRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/*
 * Check an employee's actual permissions.
 *
 * If customPermissions are provided, they are used.
 * This is what allows the Owner to customize access.
 *
 * The Owner role always has full business permissions.
 */
export function hasPermission(
  role: AppRole,
  permission: Permission,
  customPermissions?: Permission[],
): boolean {
  if (role === "owner") {
    return true;
  }

  if (customPermissions) {
    return customPermissions.includes(permission);
  }

  return hasRolePermission(role, permission);
}

/*
 * Check whether the employee has at least
 * one of the requested permissions.
 */
export function roleHasAnyPermission(
  role: AppRole,
  permissions: Permission[],
  customPermissions?: Permission[],
): boolean {
  return permissions.some((permission) =>
    hasPermission(
      role,
      permission,
      customPermissions,
    ),
  );
}

/*
 * Check whether the employee has all
 * requested permissions.
 */
export function roleHasAllPermissions(
  role: AppRole,
  permissions: Permission[],
  customPermissions?: Permission[],
): boolean {
  return permissions.every((permission) =>
    hasPermission(
      role,
      permission,
      customPermissions,
    ),
  );
}

/*
 * Human-readable permission names.
 * These will be used later on the Owner's
 * employee access-management screen.
 */
export function getPermissionName(
  permission: Permission,
): string {
  const names: Record<Permission, string> = {
    "dashboard.view": "View Dashboard",

    "products.view": "View Products",
    "products.create": "Add Products",
    "products.edit": "Edit Products",
    "products.delete": "Delete Products",

    "stock.view": "View Stock",
    "stock.receive": "Receive Stock",
    "stock.adjust": "Adjust Stock",
    "stock.history": "View Stock History",

    "sales.view": "View Sales",
    "sales.create": "Create Sales",
    "sales.history": "View Sales History",

    "reports.view": "View Reports",

    "expenses.view": "View Expenses",
    "expenses.create": "Add Expenses",
    "expenses.delete": "Delete Expenses",

    "accounts.view": "View Employees",
    "accounts.create": "Create Employees",
    "accounts.manage": "Manage Employees",

    "settings.manage": "Manage Business Settings",
  };

  return names[permission];
}

/*
 * Returns all permissions in the order
 * we want to display them in the Owner dashboard.
 */
export function getAllPermissions(): Permission[] {
  return [
    "dashboard.view",

    "products.view",
    "products.create",
    "products.edit",
    "products.delete",

    "stock.view",
    "stock.receive",
    "stock.adjust",
    "stock.history",

    "sales.view",
    "sales.create",
    "sales.history",

    "reports.view",

    "expenses.view",
    "expenses.create",
    "expenses.delete",

    "accounts.view",
    "accounts.create",
    "accounts.manage",

    "settings.manage",
  ];
}

export function getRoleName(
  role: AppRole,
): string {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "manager") {
    return "Manager";
  }

  if (role === "staff") {
    return "Staff";
  }

  return "Worker";
}