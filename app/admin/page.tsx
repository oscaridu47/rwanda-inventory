"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  isPlatformAdmin,
} from "@/app/lib/auth";

import { supabase } from "@/app/lib/supabase";

export default function AdminPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] =
    useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (!cancelled) {
            setCheckingSession(false);
          }

          return;
        }

        const platformAdmin =
          await isPlatformAdmin();

        if (cancelled) {
          return;
        }

        if (platformAdmin) {
          router.replace("/admin/dashboard");
          return;
        }

        /*
         * A normal business user is not allowed
         * to enter the platform-admin area.
         */
        await supabase.auth.signOut();

        if (!cancelled) {
          setCheckingSession(false);
        }
      } catch {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    void checkExistingSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Email is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    setLoading(true);

    try {
      /*
       * Authenticate through Supabase Auth.
       */
      const {
        data,
        error: signInError,
      } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (signInError) {
        throw new Error(
          signInError.message ||
            "Invalid email or password.",
        );
      }

      if (!data.user || !data.session) {
        throw new Error(
          "Login succeeded but no active session was created.",
        );
      }

      /*
       * Confirm that this authenticated account
       * is actually the platform administrator.
       */
      const platformAdmin =
        await isPlatformAdmin();

      if (!platformAdmin) {
        await supabase.auth.signOut();

        throw new Error(
          "This account does not have platform administrator access.",
        );
      }

      /*
       * Only platform administrators can enter
       * the administration dashboard.
       */
      router.replace("/admin/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

          <p className="text-sm text-slate-600">
            Checking administrator session...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-slate-900">
              RwandaInventory
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Platform Administrator
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="admin-email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Administrator Email
              </label>

              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="email"
                disabled={loading}
                placeholder="admin@example.com"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Password
              </label>

              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete="current-password"
                disabled={loading}
                placeholder="Your password"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Signing in..."
                : "Administrator Sign In"}
            </button>
          </form>

          <div className="mt-6 border-t pt-6 text-center">
            <button
              type="button"
              onClick={() => router.push("/auth")}
              className="text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              Back to normal login
            </button>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          Secure platform administration powered by
          Supabase
        </p>
      </div>
    </main>
  );
}