"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [checkingSession, setCheckingSession] =
    useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [hasRecoverySession, setHasRecoverySession] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkRecoverySession() {
      try {
        /*
         * Supabase may restore the recovery session
         * while processing the reset link.
         */
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (cancelled) {
          return;
        }

        if (sessionError) {
          setError(
            "We could not verify the password reset session. Please request a new reset email."
          );
          setCheckingSession(false);
          return;
        }

        if (session) {
          setHasRecoverySession(true);
          setCheckingSession(false);
          return;
        }

        /*
         * Give the auth client a moment to process the
         * recovery link and emit PASSWORD_RECOVERY.
         */
        const timeout = window.setTimeout(async () => {
          if (cancelled) {
            return;
          }

          const {
            data: { session: delayedSession },
          } = await supabase.auth.getSession();

          if (cancelled) {
            return;
          }

          if (delayedSession) {
            setHasRecoverySession(true);
            setError("");
          } else {
            setHasRecoverySession(false);
            setError(
              "This password reset link is invalid or has expired. Please request a new reset email."
            );
          }

          setCheckingSession(false);
        }, 1200);

        return () => {
          window.clearTimeout(timeout);
        };
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to verify the password reset session."
        );

        setCheckingSession(false);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) {
          return;
        }

        if (
          event === "PASSWORD_RECOVERY" &&
          session
        ) {
          setHasRecoverySession(true);
          setCheckingSession(false);
          setError("");
        }
      }
    );

    void checkRecoverySession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!hasRecoverySession) {
      setError(
        "Your password reset session is not valid. Please request a new reset email."
      );
      return;
    }

    if (!password) {
      setError("Please enter a new password.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Your new password must contain at least 6 characters."
      );
      return;
    }

    if (!confirmPassword) {
      setError(
        "Please confirm your new password."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        throw new Error(
          updateError.message ||
            "Unable to update your password."
        );
      }

      setSuccess(
        "Your password has been changed successfully."
      );

      setPassword("");
      setConfirmPassword("");

      /*
       * Give the user time to see the success message,
       * then return to the normal login page.
       */
      window.setTimeout(async () => {
        await supabase.auth.signOut();
        router.replace("/auth");
      }, 1800);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update your password."
      );
    } finally {
      setSaving(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

          <h1 className="text-xl font-bold text-slate-900">
            RwandaInventory
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Verifying your password reset link...
          </p>
        </div>
      </main>
    );
  }

  if (!hasRecoverySession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-slate-900">
              RwandaInventory
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Password reset
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => router.replace("/auth")}
            className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            Return to Sign In
          </button>
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
              Create a new password for your account
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-700">
              {success}
            </div>
          )}

          {!success && (
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  New Password
                </label>

                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  disabled={saving}
                  placeholder="Enter your new password"
                  minLength={6}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Confirm New Password
                </label>

                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  autoComplete="new-password"
                  disabled={saving}
                  placeholder="Enter the password again"
                  minLength={6}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Updating password..."
                  : "Update Password"}
              </button>
            </form>
          )}

          {success && (
            <div className="text-center">
              <p className="text-sm text-slate-500">
                You will be returned to the sign-in page
                shortly.
              </p>
            </div>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          Secure authentication powered by Supabase
        </p>
      </div>
    </main>
  );
}