"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import PermissionGuard from "../components/PermissionGuard";
import {
  getCurrentBusinessId,
  getCurrentUser,
  type User,
} from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  getAllPermissions,
  getPermissionName,
  type AppRole,
  type Permission,
} from "../lib/permissions";

type EmployeeRole = "manager" | "staff" | "worker";

type ApiEmployee = {
  id: string;
  userId?: string | null;
  name: string;
  username: string;
  email?: string | null;
  businessId: string;
  role: EmployeeRole;
  permissions: Permission[];
  active: boolean;
  createdAt: string;
};

type EmployeeForm = {
  name: string;
  username: string;
  email: string;
  password: string;
  role: EmployeeRole;
  permissions: Permission[];
};

const ROLE_OPTIONS: EmployeeRole[] = ["manager", "staff", "worker"];

const EMPTY_FORM: EmployeeForm = {
  name: "",
  username: "",
  email: "",
  password: "",
  role: "staff",
  permissions: [],
};

function apiEmployeeToUser(employee: ApiEmployee): User {
  return {
    id: employee.id,
    name: employee.name,
    username: employee.username,
    email: employee.email ?? "",
    role: employee.role,
    permissions: employee.permissions,
    businessId: employee.businessId,
    active: employee.active,
    createdAt: employee.createdAt,
  };
}

function roleLabel(role: AppRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "manager":
      return "Manager";
    case "staff":
      return "Staff";
    case "worker":
      return "Worker";
    default:
      return role;
  }
}

export default function AccountsPage() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [openPermissionsId, setOpenPermissionsId] = useState<string | null>(
    null
  );

  const currentUser = getCurrentUser();
  const businessId = getCurrentBusinessId();

  const permissions = useMemo(() => getAllPermissions(), []);

  async function getAccessToken(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }

  async function loadEmployees() {
    setLoading(true);
    setError("");

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const response = await fetch("/api/team-users", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load employees.");
      }

      const apiEmployees = Array.isArray(data?.employees)
        ? (data.employees as ApiEmployee[])
        : [];

      setEmployees(apiEmployees.map(apiEmployeeToUser));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load employees."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEmployees();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
    setSuccess("");
  }

  function updateForm<K extends keyof EmployeeForm>(
    field: K,
    value: EmployeeForm[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function toggleFormPermission(permission: Permission) {
    setForm((previous) => {
      const exists = previous.permissions.includes(permission);

      return {
        ...previous,
        permissions: exists
          ? previous.permissions.filter((item) => item !== permission)
          : [...previous.permissions, permission],
      };
    });
  }

  function selectAllFormPermissions() {
    setForm((previous) => ({
      ...previous,
      permissions: [...permissions],
    }));
  }

  function clearAllFormPermissions() {
    setForm((previous) => ({
      ...previous,
      permissions: [],
    }));
  }

  async function createEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const cleanName = form.name.trim();
    const cleanUsername = form.username.trim().toLowerCase();
    const cleanEmail = form.email.trim().toLowerCase();
    const cleanPassword = form.password;

    if (!cleanName) {
      setError("Employee name is required.");
      return;
    }

    if (!cleanUsername) {
      setError("Username is required.");
      return;
    }

    if (!cleanEmail) {
      setError("Email is required.");
      return;
    }

    if (!cleanPassword) {
      setError("Password is required.");
      return;
    }

    if (cleanPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (!businessId) {
      setError("No business is currently selected.");
      return;
    }

    setSaving(true);

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const response = await fetch("/api/team-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: cleanName,
          username: cleanUsername,
          email: cleanEmail,
          password: cleanPassword,
          role: form.role,
          permissions: form.permissions,
          businessId,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to create employee.");
      }

      if (data?.employee) {
        const createdEmployee = apiEmployeeToUser(
          data.employee as ApiEmployee
        );

        setEmployees((previous) => [...previous, createdEmployee]);
      } else {
        await loadEmployees();
      }

      setSuccess("Employee account created successfully.");
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create employee."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleEmployeeStatus(employee: User) {
    setError("");
    setSuccess("");

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const response = await fetch("/api/team-users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: employee.id,
          active: !employee.active,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to update employee status."
        );
      }

      setEmployees((previous) =>
        previous.map((item) =>
          item.id === employee.id
            ? {
                ...item,
                active: !item.active,
              }
            : item
        )
      );

      setSuccess(
        `${employee.name} is now ${
          employee.active ? "inactive" : "active"
        }.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update employee status."
      );
    }
  }

  async function saveEmployeePermissions(employee: User) {
    setError("");
    setSuccess("");

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const response = await fetch("/api/team-users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: employee.id,
          permissions: employee.permissions ?? [],
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update permissions.");
      }

      setSuccess(`Permissions updated for ${employee.name}.`);
      setOpenPermissionsId(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update permissions."
      );
    }
  }

  async function deleteEmployee(employee: User) {
    const confirmed = window.confirm(
      `Delete the employee account for "${employee.name}"?\n\nThis action cannot be easily undone.`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const response = await fetch(
        `/api/team-users?id=${encodeURIComponent(employee.id)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete employee.");
      }

      setEmployees((previous) =>
        previous.filter((item) => item.id !== employee.id)
      );

      if (editingId === employee.id) {
        resetForm();
      }

      if (openPermissionsId === employee.id) {
        setOpenPermissionsId(null);
      }

      setSuccess(`Employee ${employee.name} was deleted.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete employee."
      );
    }
  }

  function startEditing(employee: User) {
    setEditingId(employee.id);
    setEmployees((previous) => [...previous]);
    setSuccess("");
    setError("");
  }

  function updateEmployeePermission(
    employeeId: string,
    permission: Permission
  ) {
    setEmployees((previous) =>
      previous.map((employee) => {
        if (employee.id !== employeeId) {
          return employee;
        }

        const currentPermissions = employee.permissions ?? [];
        const exists = currentPermissions.includes(permission);

        return {
          ...employee,
          permissions: exists
            ? currentPermissions.filter((item) => item !== permission)
            : [...currentPermissions, permission],
        };
      })
    );
  }

  function selectAllEmployeePermissions(employeeId: string) {
    setEmployees((previous) =>
      previous.map((employee) =>
        employee.id === employeeId
          ? {
              ...employee,
              permissions: [...permissions],
            }
          : employee
      )
    );
  }

  function clearAllEmployeePermissions(employeeId: string) {
    setEmployees((previous) =>
      previous.map((employee) =>
        employee.id === employeeId
          ? {
              ...employee,
              permissions: [],
            }
          : employee
      )
    );
  }

  const visibleEmployees = employees.filter(
    (employee) => employee.id !== currentUser?.id
  );

  return (
    <PermissionGuard permission="accounts.manage">
      <main className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Employee Accounts
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Create and manage employee accounts for your business.
                </p>
              </div>

              <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-600">
                {employees.length} employee
                {employees.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              {success}
            </div>
          )}

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Create Employee
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Employee passwords are securely handled by Supabase
                Authentication.
              </p>
            </div>

            <form
              onSubmit={createEmployee}
              className="grid grid-cols-1 gap-5 md:grid-cols-2"
            >
              <div>
                <label
                  htmlFor="employee-name"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Full Name
                </label>

                <input
                  id="employee-name"
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    updateForm("name", event.target.value)
                  }
                  placeholder="Employee full name"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label
                  htmlFor="employee-username"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Username
                </label>

                <input
                  id="employee-username"
                  type="text"
                  value={form.username}
                  onChange={(event) =>
                    updateForm("username", event.target.value)
                  }
                  placeholder="employee_username"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label
                  htmlFor="employee-email"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Email
                </label>

                <input
                  id="employee-email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    updateForm("email", event.target.value)
                  }
                  placeholder="employee@example.com"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label
                  htmlFor="employee-password"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Temporary Password
                </label>

                <input
                  id="employee-password"
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    updateForm("password", event.target.value)
                  }
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label
                  htmlFor="employee-role"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Role
                </label>

                <select
                  id="employee-role"
                  value={form.role}
                  onChange={(event) =>
                    updateForm(
                      "role",
                      event.target.value as EmployeeRole
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Initial Permissions
                    </h3>

                    <p className="text-xs text-slate-500">
                      Choose what this employee can access.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllFormPermissions}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"
                    >
                      Select All
                    </button>

                    <button
                      type="button"
                      onClick={clearAllFormPermissions}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {permissions.map((permission) => {
                    const checked = form.permissions.includes(permission);

                    return (
                      <label
                        key={permission}
                        className="flex cursor-pointer items-center gap-3 rounded-lg bg-white p-3"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            toggleFormPermission(permission)
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />

                        <span className="text-sm text-slate-700">
                          {getPermissionName(permission)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create Employee"}
                </button>

                {(form.name ||
                  form.username ||
                  form.email ||
                  form.password ||
                  form.permissions.length > 0) && (
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={saving}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Clear Form
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="rounded-2xl bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Employees
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Manage employee status, roles, and permissions.
              </p>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Loading employees...
              </div>
            ) : visibleEmployees.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-medium text-slate-700">
                  No employee accounts yet.
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Create your first employee account above.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {visibleEmployees.map((employee) => {
                  const employeePermissions =
                    employee.permissions ?? [];

                  const permissionsOpen =
                    openPermissionsId === employee.id;

                  return (
                    <div key={employee.id} className="p-6">
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-slate-900">
                              {employee.name}
                            </h3>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                              {roleLabel(employee.role)}
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                employee.active
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {employee.active
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-col gap-1 text-sm text-slate-500 sm:flex-row sm:gap-4">
                            <span>
                              Username:{" "}
                              <span className="font-medium text-slate-700">
                                {employee.username}
                              </span>
                            </span>

                            {employee.email && (
                              <span>
                                Email:{" "}
                                <span className="font-medium text-slate-700">
                                  {employee.email}
                                </span>
                              </span>
                            )}

                            {editingId === employee.id && (
                              <span>
                                Account ID:{" "}
                                <span className="font-mono text-xs">
                                  {employee.id}
                                </span>
                              </span>
                            )}
                          </div>

                          <div className="mt-4">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Permissions
                            </p>

                            <div className="flex flex-wrap gap-2">
                              {employeePermissions.length === 0 ? (
                                <span className="text-sm text-slate-400">
                                  No permissions assigned
                                </span>
                              ) : (
                                employeePermissions.map(
                                  (permission) => (
                                    <span
                                      key={permission}
                                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                                    >
                                      {getPermissionName(permission)}
                                    </span>
                                  )
                                )
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              toggleEmployeeStatus(employee)
                            }
                            className={`rounded-lg px-4 py-2 text-sm font-medium ${
                              employee.active
                                ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            }`}
                          >
                            {employee.active
                              ? "Deactivate"
                              : "Activate"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              startEditing(employee);
                              setOpenPermissionsId(
                                permissionsOpen
                                  ? null
                                  : employee.id
                              );
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {permissionsOpen
                              ? "Close Permissions"
                              : "Permissions"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteEmployee(employee)
                            }
                            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {permissionsOpen && (
                        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h4 className="font-semibold text-slate-800">
                                Manage Permissions
                              </h4>

                              <p className="text-xs text-slate-500">
                                Changes are not saved until you click
                                Save Permissions.
                              </p>
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  selectAllEmployeePermissions(
                                    employee.id
                                  )
                                }
                                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"
                              >
                                Select All
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  clearAllEmployeePermissions(
                                    employee.id
                                  )
                                }
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Clear All
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {permissions.map((permission) => {
                              const checked =
                                employeePermissions.includes(
                                  permission
                                );

                              return (
                                <label
                                  key={permission}
                                  className="flex cursor-pointer items-center gap-3 rounded-lg bg-white p-3"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      updateEmployeePermission(
                                        employee.id,
                                        permission
                                      )
                                    }
                                    className="h-4 w-4 rounded border-slate-300"
                                  />

                                  <span className="text-sm text-slate-700">
                                    {getPermissionName(permission)}
                                  </span>
                                </label>
                              );
                            })}
                          </div>

                          <div className="mt-5 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                saveEmployeePermissions(employee)
                              }
                              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                            >
                              Save Permissions
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setOpenPermissionsId(null)
                              }
                              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </PermissionGuard>
  );
}