"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  hydrateCurrentUser,
  isPlatformAdmin,
} from "../lib/auth";

import { supabase } from "../lib/supabase";

export default function AuthPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] =
    useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /*
   * Check whether the authenticated Supabase user
   * is the RwandaInventory platform administrator.
   *
   * We retry because the session may take a short
   * moment to become available to the RPC.
   */
  async function checkPlatformAdminWithRetry(
    attempts = 4,
  ): Promise<boolean> {
    for (
      let attempt = 1;
      attempt <= attempts;
      attempt++
    ) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          return false;
        }

        const platformAdmin =
          await isPlatformAdmin();

        if (platformAdmin) {
          return true;
        }
      } catch {
        // Try again below.
      }

      if (attempt < attempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500),
        );
      }
    }

    return false;
  }

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        /*
         * No authenticated Supabase user.
         * Show the normal login page.
         */
        if (!session) {
          if (!cancelled) {
            setCheckingSession(false);
          }

          return;
        }

        /*
         * First check for the separate platform
         * administrator account.
         */
        const platformAdmin =
          await checkPlatformAdminWithRetry();

        if (platformAdmin) {
          if (!cancelled) {
            router.replace(
              "/admin/dashboard",
            );
          }

          return;
        }

        /*
         * Otherwise this should be a normal
         * business account.
         */
        const user =
          await hydrateCurrentUser();

        if (cancelled) {
          return;
        }

        /*
         * Existing valid business membership.
         */
        if (user) {
          router.replace("/");
          return;
        }

        /*
         * The Supabase account exists, but it does
         * not currently have a business membership.
         *
         * IMPORTANT:
         *
         * Do NOT sign the user out here.
         *
         * The business-registration page needs the
         * authenticated session because the database
         * function uses auth.uid().
         */
        router.replace("/register");
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to check your session.",
          );

          setCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

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
       * Sign in using Supabase Auth.
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
       * Confirm that the session is available before
       * performing platform-admin or business checks.
       */
      const {
        data: { session: confirmedSession },
      } = await supabase.auth.getSession();

      if (!confirmedSession) {
        throw new Error(
          "The login session could not be confirmed. Please try again.",
        );
      }

      /*
       * Platform administrator.
       */
      const platformAdmin =
        await checkPlatformAdminWithRetry(5);

      if (platformAdmin) {
        setSuccess(
          "Admin login successful. Redirecting...",
        );

        await new Promise((resolve) =>
          setTimeout(resolve, 150),
        );

        router.replace(
          "/admin/dashboard",
        );

        return;
      }

      /*
       * Normal business account.
       */
      const user =
        await hydrateCurrentUser();

      /*
       * Business account exists.
       */
      if (user) {
        setSuccess(
          "Login successful. Redirecting...",
        );

        await new Promise((resolve) =>
          setTimeout(resolve, 150),
        );

        router.replace("/");

        return;
      }

      /*
       * Authenticated Supabase account but no
       * business membership.
       *
       * Keep the session alive and allow the user
       * to complete business registration.
       */
      setSuccess(
        "Your account is authenticated. Continue with business registration.",
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 150),
      );

      router.replace("/register");
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

  async function handleForgotPassword() {
    setError("");
    setSuccess("");

    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail) {
      setError(
        "Enter your email address first.",
      );
      return;
    }

    setLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/reset-password`
          : undefined;

      const {
        error: resetError,
      } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          redirectTo
            ? {
                redirectTo,
              }
            : undefined,
        );

      if (resetError) {
        throw new Error(
          resetError.message,
        );
      }

      setSuccess(
        "Password reset instructions have been sent to your email.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send password reset instructions.",
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
            Checking your session...
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
              Sign in to your account
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              {success}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="login-email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Email
              </label>

              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                autoComplete="email"
                disabled={loading}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Password
              </label>

              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
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
                : "Sign In"}
            </button>
          </form>

          <button
            type="button"
            onClick={
              handleForgotPassword
            }
            disabled={loading}
            className="mt-5 w-full text-center text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Forgot your password?
          </button>

          <div className="mt-6 border-t pt-6 text-center">
            <a
              href="/register"
              className="text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              Register a Business
            </a>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          Secure authentication powered by
          Supabase
        </p>
      </div>
    </main>
  );
}