"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  createBusiness,
  getBusinessByOwnerUserId,
  type Business,
} from "@/app/lib/businesses";

type Role =
  | "owner"
  | "manager"
  | "staff"
  | "worker";

type User = {
  id: string;
  name: string;
  username: string;
  password: string;
  role: Role;
  active: boolean;
  createdAt: string;
};

const USERS_KEY = "rwanda-inventory-users";
const SESSION_KEY = "rwanda-inventory-session";

function createId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 10)}`;
}

function getUsers(): User[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved = localStorage.getItem(USERS_KEY);

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  localStorage.setItem(
    USERS_KEY,
    JSON.stringify(users),
  );
}

function getCurrentUserId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(SESSION_KEY);
}

function saveSession(userId: string) {
  localStorage.setItem(SESSION_KEY, userId);
}

function removeSession() {
  localStorage.removeItem(SESSION_KEY);
}

function roleName(role: Role) {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "manager") {
    return "Manager";
  }

  if (role === "worker") {
    return "Worker";
  }

  return "Staff";
}

function roleDescription(role: Role) {
  if (role === "owner") {
    return "Full business control";
  }

  if (role === "manager") {
    return "Manage day-to-day operations";
  }

  if (role === "worker") {
    return "Basic operational tasks";
  }

  return "Sales and inventory tasks";
}

function businessStatusName(
  status: Business["status"],
) {
  if (status === "pending") {
    return "Pending Approval";
  }

  if (status === "active") {
    return "Active";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Suspended";
}

export default function AuthPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] =
    useState<User | null>(null);

  const [currentBusiness, setCurrentBusiness] =
    useState<Business | null>(null);

  const [loading, setLoading] = useState(true);

  const [businessName, setBusinessName] =
    useState("");

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [role, setRole] =
    useState<"manager" | "staff" | "worker">(
      "staff",
    );

  const [showCreateBusiness, setShowCreateBusiness] =
    useState(false);

  const [showForgotPassword, setShowForgotPassword] =
    useState(false);

  const [resetUsername, setResetUsername] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmNewPassword, setConfirmNewPassword] =
    useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const savedUsers = getUsers();

    setUsers(savedUsers);

    const sessionUserId = getCurrentUserId();

    if (sessionUserId) {
      const loggedInUser = savedUsers.find(
        (user) =>
          user.id === sessionUserId &&
          user.active,
      );

      if (loggedInUser) {
        setCurrentUser(loggedInUser);

        if (loggedInUser.role === "owner") {
          const business =
            getBusinessByOwnerUserId(
              loggedInUser.id,
            );

          setCurrentBusiness(business);
        }
      }
    }

    setLoading(false);
  }, []);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function resetForms() {
    setBusinessName("");
    setName("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setResetUsername("");
    setNewPassword("");
    setConfirmNewPassword("");
  }

  function createOwner(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();

    if (users.length > 0) {
      setError(
        "A business account already exists on this browser. Please sign in or use the existing account.",
      );
      return;
    }

    if (!businessName.trim()) {
      setError(
        "Enter your business name.",
      );
      return;
    }

    if (!name.trim()) {
      setError(
        "Enter the owner's name.",
      );
      return;
    }

    if (username.trim().length < 3) {
      setError(
        "Username must contain at least 3 characters.",
      );
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match.",
      );
      return;
    }

    const cleanUsername =
      username.trim().toLowerCase();

    const alreadyExists = users.some(
      (user) =>
        user.username === cleanUsername,
    );

    if (alreadyExists) {
      setError(
        "That username is already being used.",
      );
      return;
    }

    const owner: User = {
      id: createId(),
      name: name.trim(),
      username: cleanUsername,
      password,
      role: "owner",

      // Owner cannot log in until
      // the business is approved.
      active: false,

      createdAt:
        new Date().toISOString(),
    };

    const updatedUsers = [owner];

    saveUsers(updatedUsers);

    const business = createBusiness({
      businessName:
        businessName.trim(),
      ownerUserId: owner.id,
      plan: "Basic",
    });

    if (!business) {
      setError(
        "The business registration could not be completed. Please try again.",
      );

      return;
    }

    setUsers(updatedUsers);
    setCurrentBusiness(business);

    resetForms();

    setShowCreateBusiness(false);

    setSuccess(
      "Business registration submitted. Your account is waiting for approval after payment.",
    );
  }

  function login(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();

    const cleanUsername =
      username.trim().toLowerCase();

    const foundUser = users.find(
      (user) =>
        user.username === cleanUsername,
    );

    if (!foundUser) {
      setError(
        "Incorrect username or password.",
      );
      return;
    }

    if (
      foundUser.password !== password
    ) {
      setError(
        "Incorrect username or password.",
      );
      return;
    }

    if (foundUser.role === "owner") {
      const business =
        getBusinessByOwnerUserId(
          foundUser.id,
        );

      if (!business) {
        setError(
          "No business record was found for this owner account.",
        );
        return;
      }

      if (
        business.status === "pending"
      ) {
        setError(
          "Your business registration is waiting for approval. Please complete payment and wait for approval.",
        );
        return;
      }

      if (
        business.status === "rejected"
      ) {
        setError(
          "Your business registration was rejected. Please contact RwandaInventory support.",
        );
        return;
      }

      if (
        business.status === "suspended"
      ) {
        setError(
          "Your business account has been suspended. Please contact RwandaInventory support.",
        );
        return;
      }

      if (
        business.status === "active" &&
        business.subscriptionEndDate
      ) {
        const expiryDate =
          new Date(
            business.subscriptionEndDate,
          );

        if (
          expiryDate.getTime() <
          Date.now()
        ) {
          setError(
            "Your subscription has expired. Please renew your subscription before signing in.",
          );
          return;
        }
      }
    }

    if (!foundUser.active) {
      setError(
        "This account is not active yet. If you are the business owner, your account may still be waiting for approval.",
      );
      return;
    }

    saveSession(foundUser.id);

    setCurrentUser(foundUser);

    if (foundUser.role === "owner") {
      setCurrentBusiness(
        getBusinessByOwnerUserId(
          foundUser.id,
        ),
      );
    }

    setPassword("");

    setSuccess(
      `Welcome, ${foundUser.name}.`,
    );
  }

  function logout() {
    removeSession();

    setCurrentUser(null);
    setCurrentBusiness(null);

    resetForms();

    setShowCreateBusiness(false);
    setShowForgotPassword(false);

    clearMessages();
  }

  function createTeamAccount(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();

    if (!currentUser) {
      return;
    }

    if (currentUser.role !== "owner") {
      setError(
        "Only the owner can create team accounts.",
      );
      return;
    }

    if (
      !currentBusiness ||
      currentBusiness.status !== "active"
    ) {
      setError(
        "The business must be active before team accounts can be created.",
      );
      return;
    }

    if (!name.trim()) {
      setError(
        "Enter the team member's name.",
      );
      return;
    }

    if (username.trim().length < 3) {
      setError(
        "Username must contain at least 3 characters.",
      );
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match.",
      );
      return;
    }

    const cleanUsername =
      username.trim().toLowerCase();

    const alreadyExists = users.some(
      (user) =>
        user.username === cleanUsername,
    );

    if (alreadyExists) {
      setError(
        "That username is already being used.",
      );
      return;
    }

    const newUser: User = {
      id: createId(),
      name: name.trim(),
      username: cleanUsername,
      password,
      role,
      active: true,
      createdAt:
        new Date().toISOString(),
    };

    const updatedUsers = [
      ...users,
      newUser,
    ];

    saveUsers(updatedUsers);

    setUsers(updatedUsers);

    resetForms();

    setSuccess(
      `${newUser.name} was created as ${roleName(
        newUser.role,
      )}.`,
    );
  }

  function changeUserStatus(
    userId: string,
  ) {
    if (!currentUser) {
      return;
    }

    if (currentUser.role !== "owner") {
      return;
    }

    const target = users.find(
      (user) => user.id === userId,
    );

    if (!target) {
      return;
    }

    if (target.role === "owner") {
      setError(
        "The owner account cannot be deactivated.",
      );
      return;
    }

    const updatedUsers = users.map(
      (user) =>
        user.id === userId
          ? {
              ...user,
              active: !user.active,
            }
          : user,
    );

    saveUsers(updatedUsers);

    setUsers(updatedUsers);

    setSuccess(
      `${target.name} is now ${
        target.active
          ? "deactivated"
          : "active"
      }.`,
    );
  }

  function deleteUser(userId: string) {
    if (!currentUser) {
      return;
    }

    if (currentUser.role !== "owner") {
      return;
    }

    const target = users.find(
      (user) => user.id === userId,
    );

    if (!target) {
      return;
    }

    if (target.role === "owner") {
      setError(
        "The owner account cannot be deleted.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete ${target.name}'s account?`,
    );

    if (!confirmed) {
      return;
    }

    const updatedUsers = users.filter(
      (user) => user.id !== userId,
    );

    saveUsers(updatedUsers);

    setUsers(updatedUsers);

    setSuccess(
      `${target.name}'s account was deleted.`,
    );
  }

  function resetPassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();

    const cleanUsername =
      resetUsername.trim().toLowerCase();

    const foundUser = users.find(
      (user) =>
        user.username === cleanUsername,
    );

    if (!foundUser) {
      setError(
        "No account was found with that username.",
      );
      return;
    }

    if (!foundUser.active) {
      setError(
        "This account is not active. If you are waiting for business approval, password reset is not available yet.",
      );
      return;
    }

    if (newPassword.length < 6) {
      setError(
        "New password must contain at least 6 characters.",
      );
      return;
    }

    if (
      newPassword !==
      confirmNewPassword
    ) {
      setError(
        "Passwords do not match.",
      );
      return;
    }

    const updatedUsers = users.map(
      (user) =>
        user.id === foundUser.id
          ? {
              ...user,
              password: newPassword,
            }
          : user,
    );

    saveUsers(updatedUsers);

    setUsers(updatedUsers);

    setShowForgotPassword(false);

    setResetUsername("");
    setNewPassword("");
    setConfirmNewPassword("");

    setUsername(foundUser.username);

    setSuccess(
      "Password changed successfully. You can now sign in.",
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p>
          Loading RwandaInventory...
        </p>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto flex min-h-[90vh] max-w-md items-center">
          <div className="w-full rounded-2xl bg-white p-8 shadow">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900">
                RwandaInventory
              </h1>

              <p className="mt-2 text-gray-600">
                {showCreateBusiness
                  ? "Create your business account"
                  : showForgotPassword
                    ? "Reset your password"
                    : "Sign in to your account"}
              </p>
            </div>

            {showCreateBusiness ? (
              <form
                onSubmit={createOwner}
                className="mt-8 space-y-5"
              >
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Business Name
                  </label>

                  <input
                    type="text"
                    value={businessName}
                    onChange={(event) =>
                      setBusinessName(
                        event.target.value,
                      )
                    }
                    placeholder="Your shop or business name"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Business Owner Name
                  </label>

                  <input
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value,
                      )
                    }
                    placeholder="Your full name"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Owner Username
                  </label>

                  <input
                    type="text"
                    value={username}
                    onChange={(event) =>
                      setUsername(
                        event.target.value,
                      )
                    }
                    placeholder="Choose a username"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Password
                  </label>

                  <input
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    placeholder="At least 6 characters"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Confirm Password
                  </label>

                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value,
                      )
                    }
                    placeholder="Repeat password"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
                  Your business account will remain
                  pending until RwandaInventory
                  confirms your payment and approves
                  the account.
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white"
                >
                  Submit Business Registration
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCreateBusiness(false);
                    clearMessages();
                    resetForms();
                  }}
                  className="w-full rounded-lg border border-gray-300 px-5 py-3 font-medium"
                >
                  Back to Sign In
                </button>
              </form>
            ) : showForgotPassword ? (
              <form
                onSubmit={resetPassword}
                className="mt-8 space-y-5"
              >
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Username
                  </label>

                  <input
                    type="text"
                    value={resetUsername}
                    onChange={(event) =>
                      setResetUsername(
                        event.target.value,
                      )
                    }
                    placeholder="Your username"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    New Password
                  </label>

                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(
                        event.target.value,
                      )
                    }
                    placeholder="At least 6 characters"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Confirm New Password
                  </label>

                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(event) =>
                      setConfirmNewPassword(
                        event.target.value,
                      )
                    }
                    placeholder="Repeat new password"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white"
                >
                  Change Password
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    clearMessages();
                    resetForms();
                  }}
                  className="w-full rounded-lg border border-gray-300 px-5 py-3 font-medium"
                >
                  Back to Sign In
                </button>
              </form>
            ) : (
              <form
                onSubmit={login}
                className="mt-8 space-y-5"
              >
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Username
                  </label>

                  <input
                    type="text"
                    value={username}
                    onChange={(event) =>
                      setUsername(
                        event.target.value,
                      )
                    }
                    placeholder="Username"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Password
                  </label>

                  <input
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    placeholder="Password"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white"
                >
                  Sign In
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    clearMessages();
                  }}
                  className="w-full text-sm font-medium text-blue-700 hover:text-blue-900"
                >
                  Forgot password?
                </button>

                <div className="border-t pt-5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateBusiness(true);
                      clearMessages();
                      resetForms();
                    }}
                    className="w-full rounded-lg border border-gray-300 px-5 py-3 font-medium hover:bg-gray-50"
                  >
                    Create Business Account
                  </button>

                  {users.length > 0 && (
                    <p className="mt-3 text-center text-xs text-gray-500">
                      This browser already has a
                      business account.
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Account Management
            </h1>

            <p className="mt-2 text-gray-600">
              Welcome, {currentUser.name}
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium"
          >
            Log Out
          </button>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Current User
            </p>

            <p className="mt-2 text-xl font-bold">
              {currentUser.name}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Role
            </p>

            <p className="mt-2 text-xl font-bold">
              {roleName(currentUser.role)}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Total Accounts
            </p>

            <p className="mt-2 text-xl font-bold">
              {users.length}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Access
            </p>

            <p className="mt-2 text-sm font-semibold">
              {roleDescription(
                currentUser.role,
              )}
            </p>
          </div>
        </div>

        {currentUser.role === "owner" && (
          <>
            {currentBusiness && (
              <div className="mt-8 rounded-xl bg-white p-6 shadow">
                <h2 className="text-xl font-semibold">
                  Business Status
                </h2>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-gray-500">
                      Business
                    </p>

                    <p className="mt-1 font-semibold">
                      {currentBusiness.businessName}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">
                      Status
                    </p>

                    <p className="mt-1 font-semibold">
                      {businessStatusName(
                        currentBusiness.status,
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">
                      Payment
                    </p>

                    <p className="mt-1 font-semibold">
                      {currentBusiness.paymentStatus ===
                      "paid"
                        ? "Paid"
                        : "Pending"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold">
                Create Team Account
              </h2>

              <p className="mt-2 text-gray-600">
                Create a Manager, Staff, or Worker
                account for your business.
              </p>

              <form
                onSubmit={createTeamAccount}
                className="mt-6 grid gap-4 md:grid-cols-2"
              >
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Full Name
                  </label>

                  <input
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value,
                      )
                    }
                    placeholder="Full name"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Username
                  </label>

                  <input
                    type="text"
                    value={username}
                    onChange={(event) =>
                      setUsername(
                        event.target.value,
                      )
                    }
                    placeholder="Username"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Role
                  </label>

                  <select
                    value={role}
                    onChange={(event) =>
                      setRole(
                        event.target.value as
                          | "manager"
                          | "staff"
                          | "worker",
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                  >
                    <option value="manager">
                      Manager
                    </option>

                    <option value="staff">
                      Staff
                    </option>

                    <option value="worker">
                      Worker
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Password
                  </label>

                  <input
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    placeholder="Password"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Confirm Password
                  </label>

                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value,
                      )
                    }
                    placeholder="Confirm password"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white"
                  >
                    Create Account
                  </button>
                </div>
              </form>

              {error && (
                <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                  {success}
                </div>
              )}
            </div>

            <div className="mt-8 rounded-xl bg-white p-6 shadow">
              <h2 className="text-xl font-semibold">
                Team Accounts
              </h2>

              <div className="mt-6 space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-semibold">
                        {user.name}
                      </p>

                      <p className="text-sm text-gray-500">
                        @{user.username} ·{" "}
                        {roleName(user.role)}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {roleDescription(
                          user.role,
                        )}
                      </p>

                      <p
                        className={`mt-1 text-sm ${
                          user.active
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {user.active
                          ? "Active"
                          : "Deactivated"}
                      </p>
                    </div>

                    {user.role !== "owner" && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            changeUserStatus(
                              user.id,
                            )
                          }
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                        >
                          {user.active
                            ? "Deactivate"
                            : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteUser(
                              user.id,
                            )
                          }
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {currentUser.role !== "owner" && (
          <div className="mt-8 rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold">
              Your Account
            </h2>

            <p className="mt-2 text-gray-600">
              You are logged in as{" "}
              <strong>
                {roleName(currentUser.role)}
              </strong>
              .
            </p>

            <p className="mt-2 text-sm text-gray-500">
              {roleDescription(
                currentUser.role,
              )}
              . Account management is available
              only to the owner.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/"
            className="rounded-lg bg-white px-5 py-3 shadow"
          >
            Dashboard
          </a>

          <a
            href="/products"
            className="rounded-lg bg-white px-5 py-3 shadow"
          >
            Products
          </a>

          <a
            href="/stock"
            className="rounded-lg bg-white px-5 py-3 shadow"
          >
            Stock
          </a>

          <a
            href="/sales"
            className="rounded-lg bg-black px-5 py-3 text-white"
          >
            Sales
          </a>
        </div>
      </div>
    </main>
  );
}