"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  getCurrentUser,
  getCurrentBusinessId,
  logout,
  type User,
} from "@/app/lib/auth";

import {
  getBusinessById,
  type Business,
} from "@/app/lib/businesses";

import { hasPermission } from "@/app/lib/permissions";

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] =
    useState<User | null>(null);

  const [business, setBusiness] =
    useState<Business | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const currentUser =
      getCurrentUser();

    if (!currentUser) {
      router.replace("/auth");
      return;
    }

    setUser(currentUser);

    /*
     * Get the business connected to
     * this logged-in account.
     *
     * This works for both:
     * - Owner
     * - Manager
     * - Staff
     * - Worker
     */
    const businessId =
      getCurrentBusinessId();

    if (businessId) {
      const currentBusiness =
        getBusinessById(
          businessId,
        );

      setBusiness(currentBusiness);
    } else {
      setBusiness(null);
    }

    setLoading(false);
  }, [router]);

  function handleLogout() {
    logout();
    router.replace("/auth");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          Loading RwandaInventory...
        </p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const isOwner =
    user.role === "owner";

  /*
   * IMPORTANT:
   *
   * The third argument is user.permissions.
   *
   * This means the Owner's custom
   * permissions are used instead of
   * only the default role permissions.
   */

  const canViewProducts =
    hasPermission(
      user.role,
      "products.view",
      user.permissions,
    );

  const canCreateProducts =
    hasPermission(
      user.role,
      "products.create",
      user.permissions,
    );

  const canViewStock =
    hasPermission(
      user.role,
      "stock.view",
      user.permissions,
    );

  const canViewSales =
    hasPermission(
      user.role,
      "sales.view",
      user.permissions,
    );

  const canCreateSales =
    hasPermission(
      user.role,
      "sales.create",
      user.permissions,
    );

  const canViewReports =
    hasPermission(
      user.role,
      "reports.view",
      user.permissions,
    );

  const canManageAccounts =
    hasPermission(
      user.role,
      "accounts.manage",
      user.permissions,
    );

  const canManageSettings =
    hasPermission(
      user.role,
      "settings.manage",
      user.permissions,
    );

  const canViewExpenses =
    hasPermission(
      user.role,
      "expenses.view",
      user.permissions,
    );

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              RwandaInventory
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {business
                ? business.businessName
                : "Business Dashboard"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-gray-900">
                {user.name}
              </p>

              <p className="text-xs capitalize text-gray-500">
                {user.role}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-8">
          <div className="rounded-2xl bg-black p-6 text-white">
            <p className="text-sm text-gray-300">
              Welcome back
            </p>

            <h2 className="mt-1 text-3xl font-bold">
              {user.name}
            </h2>

            <p className="mt-2 text-gray-300">
              Manage your business, products,
              stock and sales from one place.
            </p>

            {business && (
              <div className="mt-5 flex flex-wrap gap-3">
                <span className="rounded-full bg-white/10 px-4 py-2 text-sm">
                  Business:{" "}
                  {business.businessName}
                </span>

                <span className="rounded-full bg-white/10 px-4 py-2 text-sm capitalize">
                  Status:{" "}
                  {business.status}
                </span>

                <span className="rounded-full bg-white/10 px-4 py-2 text-sm">
                  Plan: {business.plan}
                </span>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-gray-900">
              Business Management
            </h2>

            <p className="mt-1 text-gray-600">
              Choose what you want to manage.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {canViewProducts && (
              <Link
                href="/products"
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-4xl">
                  📦
                </div>

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  Products
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  Register, edit and manage
                  products in your business.
                </p>
              </Link>
            )}

            {canCreateProducts && (
              <Link
                href="/products/add"
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-4xl">
                  ➕
                </div>

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  Add Product
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  Register a new product,
                  barcode, price and stock.
                </p>
              </Link>
            )}

            {canViewStock && (
              <Link
                href="/stock"
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-4xl">
                  📥
                </div>

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  Stock
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  Receive stock, make
                  adjustments and check stock
                  history.
                </p>
              </Link>
            )}

            {canViewSales && (
              <Link
                href="/sales"
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-4xl">
                  🛒
                </div>

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  Sales
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  View and manage business
                  sales.
                </p>
              </Link>
            )}

            {canCreateSales && (
              <Link
                href="/sales/new"
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-4xl">
                  💰
                </div>

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  Record Sale
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  Record a new customer sale
                  and automatically update
                  stock.
                </p>
              </Link>
            )}

            {canViewReports && (
              <Link
                href="/reports"
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-4xl">
                  📊
                </div>

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  Reports
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  View sales, stock and
                  business performance
                  reports.
                </p>
              </Link>
            )}

            {canViewExpenses && (
              <Link
                href="/expenses"
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-4xl">
                  💵
                </div>

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  Expenses
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  View and manage business
                  expenses.
                </p>
              </Link>
            )}

            {canManageAccounts && (
              <Link
                href="/accounts"
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-4xl">
                  👥
                </div>

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  Employee Accounts
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  Create and manage Manager,
                  Staff and Worker accounts.
                </p>
              </Link>
            )}

            {canManageSettings && (
              <Link
                href="/settings"
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-4xl">
                  ⚙️
                </div>

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  Settings
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  Manage business settings,
                  units and packaging.
                </p>
              </Link>
            )}

            {isOwner && business && (
              <Link
                href="/subscription"
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-4xl">
                  🔐
                </div>

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  Subscription
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  View your plan, payment
                  status and subscription
                  expiry.
                </p>
              </Link>
            )}
          </div>
        </section>

        {!business && (
          <section className="mt-8 rounded-xl border border-yellow-200 bg-yellow-50 p-5">
            <h3 className="font-bold text-yellow-900">
              Business not connected
            </h3>

            <p className="mt-1 text-sm text-yellow-800">
              Your account is not currently
              connected to a business.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}