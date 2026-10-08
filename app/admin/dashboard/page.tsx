"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  isPlatformAdmin,
} from "@/app/lib/auth";

import { supabase } from "@/app/lib/supabase";

type BusinessStatus =
  | "pending"
  | "active"
  | "rejected"
  | "suspended"
  | string;

type PaymentStatus =
  | "pending"
  | "paid"
  | "unpaid"
  | string;

type BusinessRecord = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  currency: string | null;
  status: BusinessStatus;
  payment_status: PaymentStatus | null;
  plan: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  created_at: string;
  updated_at: string | null;
};

type FilterType =
  | "all"
  | "pending"
  | "active"
  | "rejected"
  | "suspended";

export default function AdminDashboardPage() {
  const router = useRouter();

  const [businesses, setBusinesses] =
    useState<BusinessRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [filter, setFilter] =
    useState<FilterType>("all");

  const [selectedBusinessId, setSelectedBusinessId] =
    useState<string | null>(null);

  const [checkingAdmin, setCheckingAdmin] =
    useState(true);

  /*
   * Load all businesses through the secure
   * platform-admin RPC.
   */
  const loadBusinesses =
    useCallback(async () => {
      setError("");

      try {
        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        if (!session) {
          router.replace("/auth");
          return;
        }

        const admin =
          await isPlatformAdmin();

        if (!admin) {
          router.replace("/");
          return;
        }

        const {
          data,
          error: rpcError,
        } =
          await supabase.rpc(
            "get_platform_businesses",
          );

        if (rpcError) {
          throw new Error(
            rpcError.message ||
              "Unable to load businesses.",
          );
        }

        const rows =
          (data ?? []) as BusinessRecord[];

        rows.sort((a, b) =>
          String(b.created_at).localeCompare(
            String(a.created_at),
          ),
        );

        setBusinesses(rows);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load businesses.",
        );
      } finally {
        setLoading(false);
        setCheckingAdmin(false);
      }
    }, [router]);

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  /*
   * Run an administrator action and then refresh
   * the business list from Supabase.
   */
  async function performBusinessAction(
    action:
      | "approve"
      | "reject"
      | "suspend"
      | "reactivate",
    business: BusinessRecord,
  ) {
    setError("");
    setSuccess("");

    let confirmation = "";

    if (action === "approve") {
      confirmation =
        `Approve ${business.name}? ` +
        "This will activate the business for 30 days.";
    }

    if (action === "reject") {
      confirmation =
        `Reject ${business.name}?`;
    }

    if (action === "suspend") {
      confirmation =
        `Suspend ${business.name}? ` +
        "The business will lose normal access.";
    }

    if (action === "reactivate") {
      confirmation =
        `Reactivate ${business.name}? ` +
        "This will activate the business for 30 days.";
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm(confirmation)
    ) {
      return;
    }

    setActionLoading(
      `${action}:${business.id}`,
    );

    try {
      if (action === "approve") {
        const {
          error: rpcError,
        } =
          await supabase.rpc(
            "approve_business",
            {
              p_business_id:
                business.id,
              p_subscription_days: 30,
            },
          );

        if (rpcError) {
          throw new Error(
            rpcError.message ||
              "Unable to approve business.",
          );
        }

        setSuccess(
          `${business.name} has been approved and activated for 30 days.`,
        );
      }

      if (action === "reject") {
        const {
          error: rpcError,
        } =
          await supabase.rpc(
            "reject_business",
            {
              p_business_id:
                business.id,
            },
          );

        if (rpcError) {
          throw new Error(
            rpcError.message ||
              "Unable to reject business.",
          );
        }

        setSuccess(
          `${business.name} has been rejected.`,
        );
      }

      if (action === "suspend") {
        const {
          error: rpcError,
        } =
          await supabase.rpc(
            "suspend_business",
            {
              p_business_id:
                business.id,
            },
          );

        if (rpcError) {
          throw new Error(
            rpcError.message ||
              "Unable to suspend business.",
          );
        }

        setSuccess(
          `${business.name} has been suspended.`,
        );
      }

      if (action === "reactivate") {
        const {
          error: rpcError,
        } =
          await supabase.rpc(
            "reactivate_business",
            {
              p_business_id:
                business.id,
              p_subscription_days: 30,
            },
          );

        if (rpcError) {
          throw new Error(
            rpcError.message ||
              "Unable to reactivate business.",
          );
        }

        setSuccess(
          `${business.name} has been reactivated for 30 days.`,
        );
      }

      await loadBusinesses();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete administrator action.",
      );
    } finally {
      setActionLoading("");
    }
  }

  async function handleLogout() {
    setError("");

    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/auth");
    }
  }

  const filteredBusinesses =
    useMemo(() => {
      if (filter === "all") {
        return businesses;
      }

      return businesses.filter(
        (business) =>
          business.status === filter,
      );
    }, [businesses, filter]);

  const counts = useMemo(() => {
    return {
      all: businesses.length,

      pending: businesses.filter(
        (business) =>
          business.status === "pending",
      ).length,

      active: businesses.filter(
        (business) =>
          business.status === "active",
      ).length,

      rejected: businesses.filter(
        (business) =>
          business.status === "rejected",
      ).length,

      suspended: businesses.filter(
        (business) =>
          business.status === "suspended",
      ).length,
    };
  }, [businesses]);

  function formatDate(
    value: string | null,
  ) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  function statusClasses(
    status: BusinessStatus,
  ) {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700";

      case "pending":
        return "bg-amber-100 text-amber-700";

      case "rejected":
        return "bg-red-100 text-red-700";

      case "suspended":
        return "bg-slate-200 text-slate-700";

      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  function paymentClasses(
    status: PaymentStatus | null,
  ) {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-700";

      case "pending":
        return "bg-amber-100 text-amber-700";

      case "unpaid":
        return "bg-red-100 text-red-700";

      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  if (checkingAdmin) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto flex min-h-[80vh] max-w-4xl items-center justify-center">
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

            <p className="text-sm text-slate-600">
              Checking platform administrator access...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              RwandaInventory
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Platform Administration
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-700">
            {success}
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <button
            type="button"
            onClick={() =>
              setFilter("all")
            }
            className={`rounded-2xl p-5 text-left shadow-sm transition ${
              filter === "all"
                ? "ring-2 ring-slate-900"
                : ""
            } bg-white`}
          >
            <p className="text-sm font-medium text-slate-500">
              All Businesses
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {counts.all}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setFilter("pending")
            }
            className={`rounded-2xl p-5 text-left shadow-sm transition ${
              filter === "pending"
                ? "ring-2 ring-amber-500"
                : ""
            } bg-white`}
          >
            <p className="text-sm font-medium text-slate-500">
              Pending
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-600">
              {counts.pending}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setFilter("active")
            }
            className={`rounded-2xl p-5 text-left shadow-sm transition ${
              filter === "active"
                ? "ring-2 ring-green-600"
                : ""
            } bg-white`}
          >
            <p className="text-sm font-medium text-slate-500">
              Active
            </p>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {counts.active}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setFilter("rejected")
            }
            className={`rounded-2xl p-5 text-left shadow-sm transition ${
              filter === "rejected"
                ? "ring-2 ring-red-500"
                : ""
            } bg-white`}
          >
            <p className="text-sm font-medium text-slate-500">
              Rejected
            </p>

            <p className="mt-2 text-3xl font-bold text-red-600">
              {counts.rejected}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setFilter("suspended")
            }
            className={`rounded-2xl p-5 text-left shadow-sm transition ${
              filter === "suspended"
                ? "ring-2 ring-slate-700"
                : ""
            } bg-white`}
          >
            <p className="text-sm font-medium text-slate-500">
              Suspended
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-700">
              {counts.suspended}
            </p>
          </button>
        </div>

        <section className="rounded-2xl bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Businesses
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Businesses are loaded directly from
                Supabase.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadBusinesses()
              }
              disabled={
                loading ||
                actionLoading !== ""
              }
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center">
              <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

              <p className="text-sm text-slate-500">
                Loading businesses...
              </p>
            </div>
          ) : filteredBusinesses.length ===
            0 ? (
            <div className="p-12 text-center">
              <p className="font-semibold text-slate-700">
                No businesses found.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                There are no businesses matching
                this filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Business
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Contact
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Payment
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Plan
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Subscription
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {filteredBusinesses.map(
                    (business) => {
                      const selected =
                        selectedBusinessId ===
                        business.id;

                      const approving =
                        actionLoading ===
                        `approve:${business.id}`;

                      const rejecting =
                        actionLoading ===
                        `reject:${business.id}`;

                      const suspending =
                        actionLoading ===
                        `suspend:${business.id}`;

                      const reactivating =
                        actionLoading ===
                        `reactivate:${business.id}`;

                      return (
                        <tbody
                          key={business.id}
                          className="contents"
                        >
                          <tr
                            className={`transition hover:bg-slate-50 ${
                              selected
                                ? "bg-slate-50"
                                : ""
                            }`}
                          >
                            <td className="px-6 py-5 align-top">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedBusinessId(
                                    selected
                                      ? null
                                      : business.id,
                                  )
                                }
                                className="text-left"
                              >
                                <p className="font-semibold text-slate-900">
                                  {
                                    business.name
                                  }
                                </p>

                                <p className="mt-1 max-w-xs text-xs text-slate-500">
                                  {business.address ||
                                    "No address provided"}
                                </p>

                                <p className="mt-1 break-all text-xs text-slate-400">
                                  {
                                    business.id
                                  }
                                </p>
                              </button>
                            </td>

                            <td className="px-6 py-5 align-top">
                              <p className="text-sm text-slate-700">
                                {business.phone ||
                                  "No phone"}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                Created{" "}
                                {formatDate(
                                  business.created_at,
                                )}
                              </p>
                            </td>

                            <td className="px-6 py-5 align-top">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClasses(
                                  business.status,
                                )}`}
                              >
                                {
                                  business.status
                                }
                              </span>
                            </td>

                            <td className="px-6 py-5 align-top">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${paymentClasses(
                                  business.payment_status,
                                )}`}
                              >
                                {
                                  business.payment_status ||
                                  "—"
                                }
                              </span>
                            </td>

                            <td className="px-6 py-5 align-top">
                              <p className="text-sm font-semibold text-slate-800">
                                {business.plan ||
                                  "—"}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {
                                  business.currency
                                }
                              </p>
                            </td>

                            <td className="px-6 py-5 align-top">
                              <p className="text-xs text-slate-600">
                                Start
                              </p>

                              <p className="text-sm font-medium text-slate-800">
                                {formatDate(
                                  business.subscription_start_date,
                                )}
                              </p>

                              <p className="mt-2 text-xs text-slate-600">
                                End
                              </p>

                              <p className="text-sm font-medium text-slate-800">
                                {formatDate(
                                  business.subscription_end_date,
                                )}
                              </p>
                            </td>

                            <td className="px-6 py-5 align-top">
                              <div className="flex min-w-[150px] flex-col gap-2">
                                {business.status ===
                                  "pending" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void performBusinessAction(
                                          "approve",
                                          business,
                                        )
                                      }
                                      disabled={
                                        actionLoading !==
                                        ""
                                      }
                                      className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {approving
                                        ? "Approving..."
                                        : "Approve"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        void performBusinessAction(
                                          "reject",
                                          business,
                                        )
                                      }
                                      disabled={
                                        actionLoading !==
                                        ""
                                      }
                                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {rejecting
                                        ? "Rejecting..."
                                        : "Reject"}
                                    </button>
                                  </>
                                )}

                                {business.status ===
                                  "active" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void performBusinessAction(
                                        "suspend",
                                        business,
                                      )
                                    }
                                    disabled={
                                      actionLoading !==
                                      ""
                                    }
                                    className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {suspending
                                      ? "Suspending..."
                                      : "Suspend"}
                                  </button>
                                )}

                                {business.status ===
                                  "suspended" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void performBusinessAction(
                                        "reactivate",
                                        business,
                                      )
                                    }
                                    disabled={
                                      actionLoading !==
                                      ""
                                    }
                                    className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {reactivating
                                      ? "Reactivating..."
                                      : "Reactivate"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {selected && (
                            <tr>
                              <td
                                colSpan={7}
                                className="bg-slate-50 px-6 py-5"
                              >
                                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Business ID
                                    </p>

                                    <p className="mt-1 break-all text-sm text-slate-800">
                                      {
                                        business.id
                                      }
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Business Phone
                                    </p>

                                    <p className="mt-1 text-sm text-slate-800">
                                      {business.phone ||
                                        "Not provided"}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Address
                                    </p>

                                    <p className="mt-1 text-sm text-slate-800">
                                      {business.address ||
                                        "Not provided"}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Status
                                    </p>

                                    <p className="mt-1 text-sm font-semibold capitalize text-slate-800">
                                      {
                                        business.status
                                      }
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Payment Status
                                    </p>

                                    <p className="mt-1 text-sm font-semibold capitalize text-slate-800">
                                      {
                                        business.payment_status ||
                                        "—"
                                      }
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Last Updated
                                    </p>

                                    <p className="mt-1 text-sm text-slate-800">
                                      {formatDate(
                                        business.updated_at,
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}