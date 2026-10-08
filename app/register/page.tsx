"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/app/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();

  const [businessName, setBusinessName] =
    useState("");
  const [fullName, setFullName] =
    useState("");
  const [username, setUsername] =
    useState("");
  const [email, setEmail] =
    useState("");
  const [phone, setPhone] =
    useState("");
  const [address, setAddress] =
    useState("");

  const [loading, setLoading] =
    useState(true);
  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (cancelled) {
          return;
        }

        /*
         * This page requires an authenticated
         * Supabase account because the database
         * function uses auth.uid().
         */
        if (!session) {
          setError(
            "Please sign in first before completing business registration.",
          );
          setLoading(false);
          return;
        }

        const user = session.user;

        /*
         * Pre-fill email from the authenticated
         * Supabase account.
         */
        setEmail(
          user.email?.trim().toLowerCase() ?? "",
        );

        /*
         * Pre-fill information that may have
         * been supplied during Auth signup.
         */
        const metadata =
          user.user_metadata ?? {};

        if (
          typeof metadata.full_name ===
            "string" &&
          metadata.full_name.trim()
        ) {
          setFullName(
            metadata.full_name.trim(),
          );
        }

        if (
          typeof metadata.username ===
            "string" &&
          metadata.username.trim()
        ) {
          setUsername(
            metadata.username
              .trim()
              .toLowerCase(),
          );
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your account.",
          );
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const cleanBusinessName =
      businessName.trim();

    const cleanFullName =
      fullName.trim();

    const cleanUsername =
      username.trim().toLowerCase();

    const cleanEmail =
      email.trim().toLowerCase();

    const cleanPhone =
      phone.trim();

    const cleanAddress =
      address.trim();

    if (!cleanBusinessName) {
      setError(
        "Business name is required.",
      );
      return;
    }

    if (!cleanFullName) {
      setError(
        "Full name is required.",
      );
      return;
    }

    if (cleanUsername.length < 3) {
      setError(
        "Username must contain at least 3 characters.",
      );
      return;
    }

    if (!cleanEmail) {
      setError(
        "Email is required.",
      );
      return;
    }

    setSubmitting(true);

    try {
      /*
       * Get the currently authenticated user.
       *
       * We do NOT create another Auth account.
       */
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        throw new Error(
          "Your login session has expired. Please sign in again.",
        );
      }

      /*
       * Make sure the email used in the form
       * matches the authenticated account.
       */
      const authenticatedEmail =
        session.user.email
          ?.trim()
          .toLowerCase() ?? "";

      if (
        authenticatedEmail &&
        cleanEmail !== authenticatedEmail
      ) {
        throw new Error(
          "The email must match the authenticated account.",
        );
      }

      /*
       * Call the six-parameter Supabase function.
       *
       * This function:
       * - creates the business
       * - sets status = pending
       * - sets payment_status = pending
       * - sets plan = Basic
       * - creates/updates the owner profile
       * - creates the owner membership
       */
      const {
        data: business,
        error: businessError,
      } = await supabase.rpc(
        "create_business_with_owner",
        {
          p_business_name:
            cleanBusinessName,

          p_full_name:
            cleanFullName,

          p_username:
            cleanUsername,

          p_email:
            cleanEmail,

          p_phone:
            cleanPhone,

          p_address:
            cleanAddress,
        },
      );

      if (businessError) {
        throw new Error(
          businessError.message ||
            "Unable to create your business.",
        );
      }

      if (!business) {
        throw new Error(
          "Supabase did not return the new business.",
        );
      }

      /*
       * Registration is now complete.
       *
       * We sign out so the newly registered
       * pending business does not immediately
       * enter the application before approval.
       */
      await supabase.auth.signOut();

      setSuccess(
        "Your business has been registered successfully and is now pending platform approval. You can sign in after the platform administrator approves your business.",
      );

      setBusinessName("");
      setFullName("");
      setUsername("");
      setPhone("");
      setAddress("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete business registration.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

          <p className="text-sm text-slate-600">
            Checking your account...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl">
        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-slate-900">
              RwandaInventory
            </h1>

            <p className="mt-2 text-lg font-semibold text-slate-700">
              Register Your Business
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Complete your Business Owner setup
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
              {error}

              {!submitting && (
                <div className="mt-3">
                  <Link
                    href="/auth"
                    className="font-semibold underline"
                  >
                    Return to Business Owner Login
                  </Link>
                </div>
              )}
            </div>
          )}

          {success && (
            <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-700">
              {success}

              <div className="mt-4">
                <Link
                  href="/auth"
                  className="font-semibold underline"
                >
                  Go to Business Owner Login
                </Link>
              </div>
            </div>
          )}

          {!success && (
            <form
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              <div>
                <h2 className="mb-4 text-lg font-semibold text-slate-900">
                  Business Information
                </h2>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="business-name"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Business Name
                    </label>

                    <input
                      id="business-name"
                      type="text"
                      value={businessName}
                      onChange={(event) =>
                        setBusinessName(
                          event.target.value,
                        )
                      }
                      disabled={submitting}
                      placeholder="Example: Oscar Supermarket"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="business-phone"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Business Phone
                    </label>

                    <input
                      id="business-phone"
                      type="tel"
                      value={phone}
                      onChange={(event) =>
                        setPhone(
                          event.target.value,
                        )
                      }
                      disabled={submitting}
                      placeholder="+250..."
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="business-address"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Business Address
                    </label>

                    <textarea
                      id="business-address"
                      value={address}
                      onChange={(event) =>
                        setAddress(
                          event.target.value,
                        )
                      }
                      disabled={submitting}
                      placeholder="Business location"
                      rows={3}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">
                  Owner Information
                </h2>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="full-name"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Full Name
                    </label>

                    <input
                      id="full-name"
                      type="text"
                      value={fullName}
                      onChange={(event) =>
                        setFullName(
                          event.target.value,
                        )
                      }
                      disabled={submitting}
                      placeholder="Your full name"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="username"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Username
                    </label>

                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(event) =>
                        setUsername(
                          event.target.value,
                        )
                      }
                      disabled={submitting}
                      placeholder="Choose a username"
                      autoComplete="username"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Account Email
                    </label>

                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(
                          event.target.value,
                        )
                      }
                      disabled
                      autoComplete="email"
                      className="w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-700 outline-none"
                    />

                    <p className="mt-2 text-xs text-slate-500">
                      This is the email address of
                      your authenticated Supabase
                      account.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Your business will be created with
                a <strong>Basic</strong> plan and{" "}
                <strong>pending</strong> status.
                The platform administrator must
                approve it before normal business
                access is activated.
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Creating Business..."
                  : "Complete Business Registration"}
              </button>
            </form>
          )}

          <div className="mt-8 border-t pt-6 text-center">
            <Link
              href="/auth"
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              ← Business Owner Login
            </Link>
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