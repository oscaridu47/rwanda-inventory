"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAdminAccount,
  getAdminAccount,
  getAdminSession,
  loginAdmin,
} from "@/app/lib/admin";

export default function AdminPage() {
  const router = useRouter();

  const [mode, setMode] = useState<
    "login" | "setup"
  >("login");

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const session = getAdminSession();

    if (session) {
      router.replace("/admin/dashboard");
      return;
    }

    const admin = getAdminAccount();

    if (!admin) {
      setMode("setup");
    } else {
      setMode("login");
    }
  }, [router]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function handleSetup(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();

    if (!name.trim()) {
      setError("Enter the admin name.");
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
      setError("Passwords do not match.");
      return;
    }

    const admin = createAdminAccount({
      name,
      username,
      password,
    });

    if (!admin) {
      setError(
        "An admin account already exists.",
      );
      return;
    }

    setSuccess(
      "Admin account created. You can now sign in.",
    );

    setName("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");

    setMode("login");
  }

  function handleLogin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();

    const session = loginAdmin(
      username,
      password,
    );

    if (!session) {
      setError(
        "Incorrect admin username or password.",
      );
      return;
    }

    router.replace("/admin/dashboard");
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto flex min-h-[90vh] max-w-md items-center">
        <div className="w-full rounded-2xl bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-black text-xl font-bold text-white">
              RI
            </div>

            <h1 className="mt-5 text-3xl font-bold text-gray-900">
              RwandaInventory
            </h1>

            <p className="mt-2 text-lg font-semibold text-gray-700">
              Admin Portal
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Platform administration
            </p>
          </div>

          {mode === "setup" ? (
            <form
              onSubmit={handleSetup}
              className="mt-8 space-y-5"
            >
              <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                This is the first-time setup for the
                RwandaInventory platform administrator.
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Admin Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Your name"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Admin Username
                </label>

                <input
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value,
                    )
                  }
                  placeholder="Choose admin username"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Admin Password
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
                className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
              >
                Create Admin Account
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleLogin}
              className="mt-8 space-y-5"
            >
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Admin Username
                </label>

                <input
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value,
                    )
                  }
                  placeholder="Admin username"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Admin Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  placeholder="Admin password"
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
                className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
              >
                Admin Sign In
              </button>
            </form>
          )}

          <div className="mt-8 border-t pt-6 text-center">
            <a
              href="/auth"
              className="text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              ← Business Owner Login
            </a>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            RwandaInventory Platform Administration
          </p>
        </div>
      </div>
    </main>
  );
}