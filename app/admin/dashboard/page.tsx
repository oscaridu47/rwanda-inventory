"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  approveBusiness,
  getBusinesses,
  rejectBusiness,
  suspendBusiness,
  updateBusiness,
  type Business,
} from "@/app/lib/businesses";

import {
  getAdminSession,
  logoutAdmin,
} from "@/app/lib/admin";

type StoredUser = {
  id: string;
  name: string;
  username: string;
  password: string;
  role: "owner" | "manager" | "staff" | "worker";
  active: boolean;
  createdAt: string;
};

const USERS_STORAGE_KEY =
  "rwanda-inventory-users";

export default function AdminDashboardPage() {
  const router = useRouter();

  const [businesses, setBusinesses] =
    useState<Business[]>([]);

  const [selectedBusinessId, setSelectedBusinessId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const session = getAdminSession();

    if (!session) {
      router.replace("/admin");
      return;
    }

    loadBusinesses();
    setLoading(false);
  }, [router]);

  function loadBusinesses() {
    setBusinesses(getBusinesses());
  }

  function activateBusinessOwner(
    ownerUserId: string,
  ) {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedUsers =
        localStorage.getItem(
          USERS_STORAGE_KEY,
        );

      if (!storedUsers) {
        return;
      }

      const users: StoredUser[] =
        JSON.parse(storedUsers);

      if (!Array.isArray(users)) {
        return;
      }

      const updatedUsers = users.map(
        (user) => {
          if (user.id !== ownerUserId) {
            return user;
          }

          return {
            ...user,
            active: true,
          };
        },
      );

      localStorage.setItem(
        USERS_STORAGE_KEY,
        JSON.stringify(updatedUsers),
      );
    } catch {
      // Ignore malformed local storage data.
    }
  }

  function handleMarkPaymentPaid(
    business: Business,
  ) {
    const updated = updateBusiness(
      business.id,
      {
        paymentStatus: "paid",
      },
    );

    if (updated) {
      loadBusinesses();
    }
  }

  function handleApprove(
    business: Business,
  ) {
    if (business.paymentStatus !== "paid") {
      window.alert(
        "Payment must be marked as paid before approving this business.",
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Approve ${business.businessName}? The business owner will be allowed to access RwandaInventory.`,
      );

    if (!confirmed) {
      return;
    }

    const updated = approveBusiness(
      business.id,
      30,
    );

    if (!updated) {
      window.alert(
        "The business could not be approved.",
      );
      return;
    }

    activateBusinessOwner(
      business.ownerUserId,
    );

    loadBusinesses();

    window.alert(
      `${business.businessName} has been approved and activated for 30 days.`,
    );
  }

  function handleReject(
    business: Business,
  ) {
    const confirmed =
      window.confirm(
        `Reject ${business.businessName}?`,
      );

    if (!confirmed) {
      return;
    }

    const updated = rejectBusiness(
      business.id,
    );

    if (updated) {
      loadBusinesses();
      setSelectedBusinessId(null);
    }
  }

  function handleSuspend(
    business: Business,
  ) {
    const confirmed =
      window.confirm(
        `Suspend ${business.businessName}? The business will no longer be active.`,
      );

    if (!confirmed) {
      return;
    }

    const updated = suspendBusiness(
      business.id,
    );

    if (updated) {
      loadBusinesses();
    }
  }

  function handleReactivate(
    business: Business,
  ) {
    const confirmed =
      window.confirm(
        `Reactivate ${business.businessName}?`,
      );

    if (!confirmed) {
      return;
    }

    const updated = updateBusiness(
      business.id,
      {
        status: "active",
        paymentStatus: "paid",
      },
    );

    if (updated) {
      activateBusinessOwner(
        business.ownerUserId,
      );

      loadBusinesses();
    }
  }

  function handleLogout() {
    logoutAdmin();
    router.replace("/admin");
  }

  function formatDate(
    date: string | null,
  ) {
    if (!date) {
      return "Not started";
    }

    return new Date(
      date,
    ).toLocaleString();
  }

  function getStatusClass(
    status: Business["status"],
  ) {
    if (status === "active") {
      return "bg-green-100 text-green-800";
    }

    if (status === "pending") {
      return "bg-yellow-100 text-yellow-800";
    }

    if (status === "suspended") {
      return "bg-orange-100 text-orange-800";
    }

    return "bg-red-100 text-red-800";
  }

  function getPaymentClass(
    paymentStatus: Business["paymentStatus"],
  ) {
    if (paymentStatus === "paid") {
      return "bg-green-100 text-green-800";
    }

    if (paymentStatus === "overdue") {
      return "bg-red-100 text-red-800";
    }

    return "bg-yellow-100 text-yellow-800";
  }

  const totalBusinesses =
    businesses.length;

  const pendingBusinesses =
    businesses.filter(
      (business) =>
        business.status === "pending",
    ).length;

  const activeBusinesses =
    businesses.filter(
      (business) =>
        business.status === "active",
    ).length;

  const paidBusinesses =
    businesses.filter(
      (business) =>
        business.paymentStatus === "paid",
    ).length;

  const pendingPayments =
    businesses.filter(
      (business) =>
        business.paymentStatus === "pending",
    ).length;

  const suspendedBusinesses =
    businesses.filter(
      (business) =>
        business.status === "suspended",
    ).length;

  const rejectedBusinesses =
    businesses.filter(
      (business) =>
        business.status === "rejected",
    ).length;

  const selectedBusiness =
    businesses.find(
      (business) =>
        business.id === selectedBusinessId,
    ) ?? null;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          Loading admin dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              RwandaInventory Admin
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              Manage businesses and platform access
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Admin Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Businesses
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {totalBusinesses}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Pending Approval
            </p>

            <p className="mt-2 text-3xl font-bold text-yellow-600">
              {pendingBusinesses}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Active Businesses
            </p>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {activeBusinesses}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Paid Businesses
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-600">
              {paidBusinesses}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Pending Payments
            </p>

            <p className="mt-2 text-3xl font-bold text-yellow-600">
              {pendingPayments}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Suspended
            </p>

            <p className="mt-2 text-3xl font-bold text-orange-600">
              {suspendedBusinesses}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Rejected
            </p>

            <p className="mt-2 text-3xl font-bold text-red-600">
              {rejectedBusinesses}
            </p>
          </div>
        </section>

        <section className="rounded-xl bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <h2 className="text-xl font-bold text-gray-900">
              Businesses
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Review businesses registered on RwandaInventory.
            </p>
          </div>

          {businesses.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">
                No businesses have registered yet.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {businesses.map(
                (business) => (
                  <div
                    key={business.id}
                    className="p-6"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-bold text-gray-900">
                            {
                              business.businessName
                            }
                          </h3>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                              business.status,
                            )}`}
                          >
                            {business.status
                              .charAt(0)
                              .toUpperCase() +
                              business.status.slice(
                                1,
                              )}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getPaymentClass(
                              business.paymentStatus,
                            )}`}
                          >
                            Payment:{" "}
                            {business.paymentStatus
                              .charAt(0)
                              .toUpperCase() +
                              business.paymentStatus.slice(
                                1,
                              )}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-gray-500">
                              Plan
                            </p>

                            <p className="font-medium text-gray-900">
                              {business.plan}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-500">
                              Registered
                            </p>

                            <p className="font-medium text-gray-900">
                              {formatDate(
                                business.createdAt,
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-500">
                              Subscription Start
                            </p>

                            <p className="font-medium text-gray-900">
                              {formatDate(
                                business.subscriptionStartDate,
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-500">
                              Subscription End
                            </p>

                            <p className="font-medium text-gray-900">
                              {formatDate(
                                business.subscriptionEndDate,
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
                          <div>
                            <p className="text-gray-500">
                              Owner ID
                            </p>

                            <p className="break-all font-mono text-xs text-gray-800">
                              {
                                business.ownerUserId
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-500">
                              Business ID
                            </p>

                            <p className="break-all font-mono text-xs text-gray-800">
                              {business.id}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:w-56 lg:flex-col">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedBusinessId(
                              business.id,
                            )
                          }
                          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                        >
                          Manage Business
                        </button>

                        {business.paymentStatus !==
                          "paid" &&
                          business.status !==
                            "rejected" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleMarkPaymentPaid(
                                  business,
                                )
                              }
                              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                            >
                              Mark Payment Paid
                            </button>
                          )}

                        {business.status ===
                          "pending" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleApprove(
                                business,
                              )
                            }
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                          >
                            Approve
                          </button>
                        )}

                        {business.status ===
                          "pending" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleReject(
                                business,
                              )
                            }
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                          >
                            Reject
                          </button>
                        )}

                        {business.status ===
                          "active" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleSuspend(
                                business,
                              )
                            }
                            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
                          >
                            Suspend
                          </button>
                        )}

                        {business.status ===
                          "suspended" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleReactivate(
                                business,
                              )
                            }
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </div>

                    {selectedBusinessId ===
                      business.id && (
                      <div className="mt-6 rounded-xl border bg-gray-50 p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-bold text-gray-900">
                              Business Management
                            </h4>

                            <p className="text-sm text-gray-600">
                              {
                                business.businessName
                              }
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedBusinessId(
                                null,
                              )
                            }
                            className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Close
                          </button>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-lg bg-white p-4">
                            <p className="text-xs text-gray-500">
                              Current Status
                            </p>

                            <p className="mt-1 font-semibold text-gray-900">
                              {business.status}
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-4">
                            <p className="text-xs text-gray-500">
                              Payment
                            </p>

                            <p className="mt-1 font-semibold text-gray-900">
                              {
                                business.paymentStatus
                              }
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-4">
                            <p className="text-xs text-gray-500">
                              Plan
                            </p>

                            <p className="mt-1 font-semibold text-gray-900">
                              {business.plan}
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-4">
                            <p className="text-xs text-gray-500">
                              Subscription
                            </p>

                            <p className="mt-1 font-semibold text-gray-900">
                              {business.subscriptionEndDate
                                ? `Until ${formatDate(
                                    business.subscriptionEndDate,
                                  )}`
                                : "Not started"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          {business.paymentStatus !==
                            "paid" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleMarkPaymentPaid(
                                  business,
                                )
                              }
                              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                            >
                              Confirm Payment
                            </button>
                          )}

                          {business.status ===
                            "pending" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleApprove(
                                  business,
                                )
                              }
                              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                            >
                              Approve Business
                            </button>
                          )}

                          {business.status ===
                            "pending" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleReject(
                                  business,
                                )
                              }
                              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                            >
                              Reject Business
                            </button>
                          )}

                          {business.status ===
                            "active" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleSuspend(
                                  business,
                                )
                              }
                              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
                            >
                              Suspend Business
                            </button>
                          )}

                          {business.status ===
                            "suspended" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleReactivate(
                                  business,
                                )
                              }
                              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                            >
                              Reactivate Business
                            </button>
                          )}
                        </div>

                        <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
                          <p className="text-sm text-blue-900">
                            After payment is confirmed and
                            the business is approved, the
                            owner account will be activated
                            and the 30-day subscription will
                            start.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </section>

        {selectedBusiness && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Selected business
            </p>

            <p className="mt-1 font-semibold text-gray-900">
              {selectedBusiness.businessName}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}