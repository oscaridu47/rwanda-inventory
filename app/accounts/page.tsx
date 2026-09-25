"use client";

import { useEffect, useMemo, useState } from "react";
import PermissionGuard from "../components/PermissionGuard";
import {
  getCurrentBusinessId,
  getCurrentUser,
  getUsersByBusinessId,
  type User,
} from "../lib/auth";
import {
  getAllPermissions,
  getPermissionName,
  getRoleName,
  type Permission,
} from "../lib/permissions";

const USERS_STORAGE_KEY = "rwanda-inventory-users";
const USERS_CHANGED_EVENT =
  "rwanda-inventory-users-changed";

type EmployeeRole =
  | "manager"
  | "staff"
  | "worker";

const employeeRoles: EmployeeRole[] = [
  "manager",
  "staff",
  "worker",
];

function createUserId(): string {
  return `user-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function saveUsers(users: User[]): void {
  localStorage.setItem(
    USERS_STORAGE_KEY,
    JSON.stringify(users),
  );

  window.dispatchEvent(
    new Event(USERS_CHANGED_EVENT),
  );
}

function formatDate(date: string): string {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

export default function AccountsPage() {
  const [currentUser, setCurrentUser] =
    useState<User | null>(null);

  const [employees, setEmployees] =
    useState<User[]>([]);

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [selectedEmployeeId, setSelectedEmployeeId] =
    useState<string | null>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [role, setRole] =
    useState<EmployeeRole>("worker");

  const [selectedPermissions, setSelectedPermissions] =
    useState<Permission[]>([]);

  const [editingPermissions, setEditingPermissions] =
    useState<Permission[]>([]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const allPermissions = useMemo(
    () => getAllPermissions(),
    [],
  );

  function loadEmployees() {
    const user = getCurrentUser();

    setCurrentUser(user);

    if (!user || user.role !== "owner") {
      setEmployees([]);
      return;
    }

    const businessId =
      getCurrentBusinessId();

    if (!businessId) {
      setEmployees([]);
      return;
    }

    const businessEmployees =
      getUsersByBusinessId(businessId).filter(
        (employee) =>
          employee.role !== "owner",
      );

    setEmployees(businessEmployees);
  }

  useEffect(() => {
    loadEmployees();

    const handleUsersChanged = () => {
      loadEmployees();
    };

    window.addEventListener(
      USERS_CHANGED_EVENT,
      handleUsersChanged,
    );

    return () => {
      window.removeEventListener(
        USERS_CHANGED_EVENT,
        handleUsersChanged,
      );
    };
  }, []);

  function resetForm() {
    setName("");
    setUsername("");
    setPassword("");
    setRole("worker");
    setSelectedPermissions([]);
    setError("");
    setSuccess("");
  }

  function togglePermission(
    permission: Permission,
  ) {
    setSelectedPermissions((current) => {
      if (current.includes(permission)) {
        return current.filter(
          (item) => item !== permission,
        );
      }

      return [...current, permission];
    });
  }

  function toggleEditingPermission(
    permission: Permission,
  ) {
    setEditingPermissions((current) => {
      if (current.includes(permission)) {
        return current.filter(
          (item) => item !== permission,
        );
      }

      return [...current, permission];
    });
  }

  function selectAllPermissions() {
    setSelectedPermissions([
      ...allPermissions,
    ]);
  }

  function clearAllPermissions() {
    setSelectedPermissions([]);
  }

  function selectAllEditingPermissions() {
    setEditingPermissions([
      ...allPermissions,
    ]);
  }

  function clearAllEditingPermissions() {
    setEditingPermissions([]);
  }

  function createEmployee() {
    setError("");
    setSuccess("");

    const owner = getCurrentUser();

    if (!owner) {
      setError(
        "You must be logged in to manage employees.",
      );
      return;
    }

    if (owner.role !== "owner") {
      setError(
        "Only the Business Owner can create employees.",
      );
      return;
    }

    const businessId =
      getCurrentBusinessId();

    if (!businessId) {
      setError(
        "Your account is not connected to a business.",
      );
      return;
    }

    const cleanName = name.trim();
    const cleanUsername =
      username.trim().toLowerCase();
    const cleanPassword =
      password.trim();

    if (!cleanName) {
      setError(
        "Please enter the employee name.",
      );
      return;
    }

    if (!cleanUsername) {
      setError(
        "Please enter a username.",
      );
      return;
    }

    if (!cleanPassword) {
      setError(
        "Please enter a password.",
      );
      return;
    }

    if (cleanPassword.length < 4) {
      setError(
        "Password must contain at least 4 characters.",
      );
      return;
    }

    const allUsers = JSON.parse(
      localStorage.getItem(
        USERS_STORAGE_KEY,
      ) || "[]",
    ) as User[];

    const usernameExists =
      allUsers.some(
        (user) =>
          user.username.toLowerCase() ===
          cleanUsername,
      );

    if (usernameExists) {
      setError(
        "That username is already in use.",
      );
      return;
    }

    const employee: User = {
      id: createUserId(),
      name: cleanName,
      username: cleanUsername,
      password: cleanPassword,
      businessId,
      role,
      permissions: [
        ...selectedPermissions,
      ],
      active: true,
      createdAt:
        new Date().toISOString(),
    };

    saveUsers([
      ...allUsers,
      employee,
    ]);

    resetForm();
    setShowCreateForm(false);

    setSuccess(
      `${cleanName} was added successfully.`,
    );

    loadEmployees();
  }

  function toggleEmployeeStatus(
    employee: User,
  ) {
    const businessId =
      getCurrentBusinessId();

    if (!businessId) {
      return;
    }

    if (
      employee.businessId !==
      businessId
    ) {
      return;
    }

    const allUsers = JSON.parse(
      localStorage.getItem(
        USERS_STORAGE_KEY,
      ) || "[]",
    ) as User[];

    const updatedUsers =
      allUsers.map((user) => {
        if (user.id !== employee.id) {
          return user;
        }

        if (
          user.businessId !==
          businessId
        ) {
          return user;
        }

        return {
          ...user,
          active: !user.active,
        };
      });

    saveUsers(updatedUsers);

    setSuccess(
      `${employee.name} is now ${
        employee.active
          ? "deactivated"
          : "active"
      }.`,
    );

    loadEmployees();
  }

  function deleteEmployee(
    employee: User,
  ) {
    const businessId =
      getCurrentBusinessId();

    if (!businessId) {
      return;
    }

    if (
      employee.businessId !==
      businessId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${employee.name}'s account? This cannot be undone.`,
      );

    if (!confirmed) {
      return;
    }

    const allUsers = JSON.parse(
      localStorage.getItem(
        USERS_STORAGE_KEY,
      ) || "[]",
    ) as User[];

    const updatedUsers =
      allUsers.filter((user) => {
        if (user.id !== employee.id) {
          return true;
        }

        return (
          user.businessId !==
          businessId
        );
      });

    saveUsers(updatedUsers);

    setSuccess(
      `${employee.name}'s account was deleted.`,
    );

    if (
      selectedEmployeeId ===
      employee.id
    ) {
      setSelectedEmployeeId(null);
      setEditingPermissions([]);
    }

    loadEmployees();
  }

  function openEmployee(
    employee: User,
  ) {
    setSelectedEmployeeId(
      (current) =>
        current === employee.id
          ? null
          : employee.id,
    );

    setEditingPermissions([
      ...(employee.permissions ?? []),
    ]);

    setError("");
    setSuccess("");
  }

  function saveEmployeePermissions(
    employee: User,
  ) {
    setError("");
    setSuccess("");

    const owner = getCurrentUser();

    if (!owner) {
      setError(
        "You must be logged in.",
      );
      return;
    }

    if (owner.role !== "owner") {
      setError(
        "Only the Business Owner can change employee permissions.",
      );
      return;
    }

    const businessId =
      getCurrentBusinessId();

    if (!businessId) {
      setError(
        "Your account is not connected to a business.",
      );
      return;
    }

    if (
      employee.businessId !==
      businessId
    ) {
      setError(
        "You cannot manage an employee from another business.",
      );
      return;
    }

    const allUsers = JSON.parse(
      localStorage.getItem(
        USERS_STORAGE_KEY,
      ) || "[]",
    ) as User[];

    const updatedUsers =
      allUsers.map((user) => {
        if (user.id !== employee.id) {
          return user;
        }

        if (
          user.businessId !==
          businessId
        ) {
          return user;
        }

        return {
          ...user,
          permissions: [
            ...editingPermissions,
          ],
        };
      });

    saveUsers(updatedUsers);

    setSuccess(
      `Access for ${employee.name} was updated successfully.`,
    );

    loadEmployees();
  }

  /*
   * This was the missing variable that caused
   * the TypeScript errors in the previous version.
   */
  const selectedEmployee =
    employees.find(
      (employee) =>
        employee.id ===
        selectedEmployeeId,
    ) ?? null;

  return (
    <PermissionGuard permission="accounts.manage">
      <main
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding:
            "32px 20px 60px",
          fontFamily:
            "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom:
              "24px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "30px",
              }}
            >
              Employee Accounts
            </h1>

            <p
              style={{
                marginTop: "8px",
                color: "#666",
              }}
            >
              Manage employees and
              control exactly what
              they can access.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              resetForm();

              setShowCreateForm(
                (current) =>
                  !current,
              );
            }}
            style={{
              border: "none",
              borderRadius: "8px",
              padding:
                "11px 18px",
              background:
                "#111827",
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {showCreateForm
              ? "Close"
              : "+ Add Employee"}
          </button>
        </div>

        {currentUser?.businessId && (
          <div
            style={{
              background:
                "#f3f4f6",
              borderRadius: "10px",
              padding:
                "14px 16px",
              marginBottom:
                "20px",
              fontSize: "14px",
            }}
          >
            <strong>
              Business-specific
              access:
            </strong>{" "}
            Employees shown here
            belong only to your
            business.
          </div>
        )}

        {success && (
          <div
            style={{
              padding:
                "12px 14px",
              borderRadius:
                "8px",
              background:
                "#ecfdf5",
              border:
                "1px solid #a7f3d0",
              marginBottom:
                "18px",
            }}
          >
            {success}
          </div>
        )}

        {error && !showCreateForm && (
          <div
            style={{
              padding:
                "12px 14px",
              borderRadius:
                "8px",
              background:
                "#fef2f2",
              border:
                "1px solid #fecaca",
              color:
                "#991b1b",
              marginBottom:
                "18px",
            }}
          >
            {error}
          </div>
        )}

        {showCreateForm && (
          <section
            style={{
              border:
                "1px solid #ddd",
              borderRadius:
                "12px",
              padding: "22px",
              marginBottom:
                "28px",
              background:
                "white",
            }}
          >
            <h2
              style={{
                marginTop: 0,
              }}
            >
              Create Employee
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              <label>
                <div
                  style={{
                    marginBottom:
                      "6px",
                    fontWeight: 600,
                  }}
                >
                  Full Name
                </div>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value,
                    )
                  }
                  placeholder="Employee name"
                  style={{
                    width: "100%",
                    padding: "10px",
                    border:
                      "1px solid #ccc",
                    borderRadius:
                      "7px",
                  }}
                />
              </label>

              <label>
                <div
                  style={{
                    marginBottom:
                      "6px",
                    fontWeight: 600,
                  }}
                >
                  Username
                </div>

                <input
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value,
                    )
                  }
                  placeholder="Username"
                  autoComplete="off"
                  style={{
                    width: "100%",
                    padding: "10px",
                    border:
                      "1px solid #ccc",
                    borderRadius:
                      "7px",
                  }}
                />
              </label>

              <label>
                <div
                  style={{
                    marginBottom:
                      "6px",
                    fontWeight: 600,
                  }}
                >
                  Password
                </div>

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  placeholder="Password"
                  autoComplete="new-password"
                  style={{
                    width: "100%",
                    padding: "10px",
                    border:
                      "1px solid #ccc",
                    borderRadius:
                      "7px",
                  }}
                />
              </label>

              <label>
                <div
                  style={{
                    marginBottom:
                      "6px",
                    fontWeight: 600,
                  }}
                >
                  Role
                </div>

                <select
                  value={role}
                  onChange={(event) =>
                    setRole(
                      event.target
                        .value as EmployeeRole,
                    )
                  }
                  style={{
                    width: "100%",
                    padding: "10px",
                    border:
                      "1px solid #ccc",
                    borderRadius:
                      "7px",
                    background:
                      "white",
                  }}
                >
                  {employeeRoles.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {getRoleName(
                          item,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <div
              style={{
                marginTop: "24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap: "12px",
                  flexWrap:
                    "wrap",
                  marginBottom:
                    "12px",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin:
                        "0 0 4px",
                    }}
                  >
                    Approved Access
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color: "#666",
                      fontSize:
                        "14px",
                    }}
                  >
                    Choose exactly
                    what this
                    employee can
                    access.
                  </p>
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    gap: "8px",
                  }}
                >
                  <button
                    type="button"
                    onClick={
                      selectAllPermissions
                    }
                    style={{
                      padding:
                        "8px 12px",
                      border:
                        "1px solid #ccc",
                      borderRadius:
                        "7px",
                      background:
                        "white",
                      cursor:
                        "pointer",
                    }}
                  >
                    Select All
                  </button>

                  <button
                    type="button"
                    onClick={
                      clearAllPermissions
                    }
                    style={{
                      padding:
                        "8px 12px",
                      border:
                        "1px solid #ccc",
                      borderRadius:
                        "7px",
                      background:
                        "white",
                      cursor:
                        "pointer",
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(230px, 1fr))",
                  gap: "8px",
                }}
              >
                {allPermissions.map(
                  (permission) => (
                    <label
                      key={permission}
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: "9px",
                        padding:
                          "10px",
                        border:
                          "1px solid #e5e7eb",
                        borderRadius:
                          "7px",
                        cursor:
                          "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(
                          permission,
                        )}
                        onChange={() =>
                          togglePermission(
                            permission,
                          )
                        }
                      />

                      <span>
                        {getPermissionName(
                          permission,
                        )}
                      </span>
                    </label>
                  ),
                )}
              </div>
            </div>

            {error && (
              <div
                style={{
                  marginTop: "16px",
                  padding:
                    "11px 13px",
                  borderRadius:
                    "8px",
                  background:
                    "#fef2f2",
                  border:
                    "1px solid #fecaca",
                  color:
                    "#991b1b",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={
                createEmployee
              }
              style={{
                marginTop: "20px",
                padding:
                  "11px 18px",
                border: "none",
                borderRadius:
                  "8px",
                background:
                  "#111827",
                color: "white",
                cursor:
                  "pointer",
                fontWeight: 600,
              }}
            >
              Create Employee
            </button>
          </section>
        )}

        <section>
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              marginBottom:
                "14px",
            }}
          >
            <h2
              style={{
                margin: 0,
              }}
            >
              Your Employees
            </h2>

            <span
              style={{
                color: "#666",
                fontSize:
                  "14px",
              }}
            >
              {employees.length} employee
              {employees.length === 1
                ? ""
                : "s"}
            </span>
          </div>

          {employees.length === 0 ? (
            <div
              style={{
                border:
                  "1px dashed #ccc",
                borderRadius:
                  "10px",
                padding: "30px",
                textAlign:
                  "center",
                color: "#666",
              }}
            >
              No employees have
              been created yet.
            </div>
          ) : (
            <div
              style={{
                display:
                  "grid",
                gap: "14px",
              }}
            >
              {employees.map(
                (employee) => (
                  <div
                    key={employee.id}
                    style={{
                      border:
                        "1px solid #ddd",
                      borderRadius:
                        "10px",
                      padding:
                        "18px",
                      background:
                        "white",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: "16px",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin:
                              "0 0 6px",
                          }}
                        >
                          {employee.name}
                        </h3>

                        <div
                          style={{
                            color:
                              "#666",
                            fontSize:
                              "14px",
                          }}
                        >
                          @
                          {
                            employee.username
                          }
                        </div>

                        <div
                          style={{
                            marginTop:
                              "8px",
                            display:
                              "flex",
                            gap: "8px",
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <span
                            style={{
                              padding:
                                "4px 8px",
                              borderRadius:
                                "999px",
                              background:
                                "#f3f4f6",
                              fontSize:
                                "12px",
                            }}
                          >
                            {getRoleName(
                              employee.role,
                            )}
                          </span>

                          <span
                            style={{
                              padding:
                                "4px 8px",
                              borderRadius:
                                "999px",
                              background:
                                employee.active
                                  ? "#ecfdf5"
                                  : "#fef2f2",
                              fontSize:
                                "12px",
                            }}
                          >
                            {employee.active
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display:
                            "flex",
                          gap: "8px",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            openEmployee(
                              employee,
                            )
                          }
                          style={{
                            padding:
                              "8px 12px",
                            border:
                              "1px solid #ccc",
                            borderRadius:
                              "7px",
                            background:
                              "white",
                            cursor:
                              "pointer",
                          }}
                        >
                          {selectedEmployeeId ===
                          employee.id
                            ? "Hide Access"
                            : "Manage Access"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleEmployeeStatus(
                              employee,
                            )
                          }
                          style={{
                            padding:
                              "8px 12px",
                            border:
                              "1px solid #ccc",
                            borderRadius:
                              "7px",
                            background:
                              "white",
                            cursor:
                              "pointer",
                          }}
                        >
                          {employee.active
                            ? "Deactivate"
                            : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteEmployee(
                              employee,
                            )
                          }
                          style={{
                            padding:
                              "8px 12px",
                            border:
                              "1px solid #fecaca",
                            borderRadius:
                              "7px",
                            background:
                              "#fff5f5",
                            color:
                              "#991b1b",
                            cursor:
                              "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {selectedEmployee &&
                      selectedEmployee.id ===
                        employee.id && (
                        <div
                          style={{
                            marginTop:
                              "18px",
                            paddingTop:
                              "18px",
                            borderTop:
                              "1px solid #eee",
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              alignItems:
                                "center",
                              gap: "10px",
                              flexWrap:
                                "wrap",
                              marginBottom:
                                "14px",
                            }}
                          >
                            <div>
                              <strong>
                                Manage Access
                              </strong>

                              <p
                                style={{
                                  margin:
                                    "5px 0 0",
                                  color:
                                    "#666",
                                  fontSize:
                                    "13px",
                                }}
                              >
                                Select the
                                information
                                and actions
                                this employee
                                is allowed to
                                use.
                              </p>
                            </div>

                            <span
                              style={{
                                color:
                                  "#666",
                                fontSize:
                                  "13px",
                              }}
                            >
                              Created{" "}
                              {formatDate(
                                employee.createdAt,
                              )}
                            </span>
                          </div>

                          <div
                            style={{
                              display:
                                "flex",
                              gap: "8px",
                              flexWrap:
                                "wrap",
                              marginBottom:
                                "14px",
                            }}
                          >
                            <button
                              type="button"
                              onClick={
                                selectAllEditingPermissions
                              }
                              style={{
                                padding:
                                  "8px 12px",
                                border:
                                  "1px solid #ccc",
                                borderRadius:
                                  "7px",
                                background:
                                  "white",
                                cursor:
                                  "pointer",
                              }}
                            >
                              Select All
                            </button>

                            <button
                              type="button"
                              onClick={
                                clearAllEditingPermissions
                              }
                              style={{
                                padding:
                                  "8px 12px",
                                border:
                                  "1px solid #ccc",
                                borderRadius:
                                  "7px",
                                background:
                                  "white",
                                cursor:
                                  "pointer",
                              }}
                            >
                              Remove All
                            </button>
                          </div>

                          <div
                            style={{
                              display:
                                "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(230px, 1fr))",
                              gap: "8px",
                            }}
                          >
                            {allPermissions.map(
                              (
                                permission,
                              ) => {
                                const checked =
                                  editingPermissions.includes(
                                    permission,
                                  );

                                return (
                                  <label
                                    key={
                                      permission
                                    }
                                    style={{
                                      display:
                                        "flex",
                                      alignItems:
                                        "center",
                                      gap: "9px",
                                      padding:
                                        "11px",
                                      border:
                                        checked
                                          ? "1px solid #9ca3af"
                                          : "1px solid #e5e7eb",
                                      borderRadius:
                                        "7px",
                                      background:
                                        checked
                                          ? "#f3f4f6"
                                          : "white",
                                      cursor:
                                        "pointer",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={
                                        checked
                                      }
                                      onChange={() =>
                                        toggleEditingPermission(
                                          permission,
                                        )
                                      }
                                    />

                                    <span>
                                      {getPermissionName(
                                        permission,
                                      )}
                                    </span>
                                  </label>
                                );
                              },
                            )}
                          </div>

                          <div
                            style={{
                              marginTop:
                                "18px",
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              alignItems:
                                "center",
                              gap: "12px",
                              flexWrap:
                                "wrap",
                            }}
                          >
                            <span
                              style={{
                                color:
                                  "#666",
                                fontSize:
                                  "13px",
                              }}
                            >
                              {
                                editingPermissions.length
                              }{" "}
                              permission
                              {editingPermissions.length ===
                              1
                                ? ""
                                : "s"}{" "}
                              selected
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                saveEmployeePermissions(
                                  employee,
                                )
                              }
                              style={{
                                border:
                                  "none",
                                borderRadius:
                                  "8px",
                                padding:
                                  "11px 18px",
                                background:
                                  "#111827",
                                color:
                                  "white",
                                cursor:
                                  "pointer",
                                fontWeight:
                                  600,
                              }}
                            >
                              Save Permissions
                            </button>
                          </div>

                          {error && (
                            <div
                              style={{
                                marginTop:
                                  "14px",
                                padding:
                                  "11px 13px",
                                borderRadius:
                                  "8px",
                                background:
                                  "#fef2f2",
                                border:
                                  "1px solid #fecaca",
                                color:
                                  "#991b1b",
                              }}
                            >
                              {error}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </main>
    </PermissionGuard>
  );
}