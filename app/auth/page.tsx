
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

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] =
    useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

        const platformAdmin = await isPlatformAdmin();

        if (platformAdmin) {
          return true;
        }
      } catch {
        // Retry below.
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

        if (!session) {
          if (!cancelled) {
            setCheckingSession(false);
          }

          return;
        }

        const platformAdmin =
          await checkPlatformAdminWithRetry();

        if (platformAdmin) {
          if (!cancelled) {
            router.replace("/admin/dashboard");
          }

          return;
        }

        const user = await hydrateCurrentUser();

        if (cancelled) {
          return;
        }

        if (user) {
          router.replace("/");
          return;
        }

        // Keep the authenticated session so the owner
        // can complete business registration.
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

  function changeMode(nextMode: AuthMode) {
    setError("");
    setSuccess("");
    setMode(nextMode);
  }

  async function handleSignIn(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const {
        data,
        error: signInError,
      } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      if (!data.user || !data.session) {
        throw new Error(
          "Login succeeded but no active session was created.",
        );
      }

      const {
        data: { session: confirmedSession },
      } = await supabase.auth.getSession();

      if (!confirmedSession) {
        throw new Error(
          "The login session could not be confirmed. Please try again.",
        );
      }

      const platformAdmin =
        await checkPlatformAdminWithRetry(5);

      if (platformAdmin) {
        setSuccess("Admin login successful. Redirecting...");

        await new Promise((resolve) =>
          setTimeout(resolve, 150),
        );

        router.replace("/admin/dashboard");
        return;
      }

      const user = await hydrateCurrentUser();

      if (user) {
        setSuccess("Login successful. Redirecting...");

        await new Promise((resolve) =>
          setTimeout(resolve, 150),
        );

        router.replace("/");
        return;
      }

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

  async function handleSignUp(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const cleanFullName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFullName) {
      setError("Enter your full name.");
      return;
    }

    if (cleanUsername.length < 3) {
      setError(
        "Username must contain at least 3 characters.",
      );
      return;
    }

    if (!cleanEmail) {
      setError("Enter your email address.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Your password must contain at least 6 characters.",
      );
      return;
    }

    setLoading(true);

    try {
      const redirectTo =
        `${window.location.origin}/register`;

      const {
        data,
        error: signUpError,
      } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: cleanFullName,
            username: cleanUsername,
          },
        },
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      /*
       * With email confirmation enabled, Supabase
       * normally sends an email without creating an
       * active session. The owner must confirm first.
       */
      if (!data.session) {
        setSuccess(
          "Your account request has been submitted. Check your email and click the confirmation link. After confirming, you will return to RwandaInventory to complete your business registration. If you don't see the email, check your spam folder.",
        );

        setPassword("");
        return;
      }

      /*
       * If Supabase returns a session, continue to
       * business registration.
       */
      setSuccess(
        "Your account has been created. Continue with business registration.",
      );

      router.replace("/register");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create your account.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setSuccess("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Enter your email address first.");
      return;
    }

    setLoading(true);

    try {
      const redirectTo =
        `${window.location.origin}/auth/reset-password`;

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          { redirectTo },
        );

      if (resetError) {
        throw new Error(resetError.message);
      }

      setSuccess(
        "If an account exists for that email, password reset instructions will be sent to it.",
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
              {mode === "signin"
                ? "Sign in to your account"
                : "Create your business owner account"}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-700"
            >
              {success}
            </div>
          )}

          <form
            onSubmit={
              mode === "signin"
                ? handleSignIn
                : handleSignUp
            }
            className="space-y-5"
          >
            {mode === "signup" && (
              <>
                <div>
                  <label
                    htmlFor="signup-full-name"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Full Name
                  </label>

                  <input
                    id="signup-full-name"
                    type="text"
                    value={fullName}
                    onChange={(event) =>
                      setFullName(event.target.value)
                    }
                    autoComplete="name"
                    disabled={loading}
                    required
                    placeholder="Your full name"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="signup-username"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Username
                  </label>

                  <input
                    id="signup-username"
                    type="text"
                    value={username}
                    onChange={(event) =>
                      setUsername(event.target.value)
                    }
                    autoComplete="username"
                    disabled={loading}
                    required
                    minLength={3}
                    placeholder="Choose a username"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                  />
                </div>
              </>
            )}

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
                  setEmail(event.target.value)
                }
                autoComplete="email"
                disabled={loading}
                required
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
                  setPassword(event.target.value)
                }
                autoComplete={
                  mode === "signin"
                    ? "current-password"
                    : "new-password"
                }
                disabled={loading}
                required
                minLength={mode === "signup" ? 6 : undefined}
                placeholder={
                  mode === "signin"
                    ? "Your password"
                    : "Create a password"
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? mode === "signin"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "signin"
                  ? "Sign In"
                  : "Create Owner Account"}
            </button>
          </form>

          {mode === "signin" && (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="mt-5 w-full text-center text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              Forgot your password?
            </button>
          )}

          <div className="mt-6 border-t pt-6 text-center">
            {mode === "signin" ? (
              <>
                <p className="text-sm text-slate-600">
                  New to RwandaInventory?
                </p>

                <button
                  type="button"
                  onClick={() => changeMode("signup")}
                  disabled={loading}
                  className="mt-2 text-sm font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50"
                >
                  Create a Business Owner Account
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Already have an account?
                </p>

                <button
                  type="button"
                  onClick={() => changeMode("signin")}
                  disabled={loading}
                  className="mt-2 text-sm font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50"
                >
                  Return to Sign In
                </button>
              </>
            )}

            <div className="mt-5">
              <a
                href="/register"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Complete Business Registration
              </a>
            </div>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          Secure authentication powered by Supabase
        </p>
      </div>
    </main>
  );
}