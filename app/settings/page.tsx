"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import {
  getCurrentUser,
  type User,
} from "@/app/lib/auth";

import {
  getBusinessByOwnerUserId,
  updateBusiness,
  type Business,
} from "@/app/lib/businesses";

import PermissionGuard from "@/app/components/PermissionGuard";

function SettingsContent() {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] =
    useState<Business | null>(null);

  const [businessName, setBusinessName] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      setLoading(false);
      return;
    }

    setUser(currentUser);

    const currentBusiness =
      getBusinessByOwnerUserId(
        currentUser.id,
      );

    setBusiness(currentBusiness);

    if (currentBusiness) {
      setBusinessName(
        currentBusiness.businessName,
      );
    }

    setLoading(false);
  }, []);

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!user || !business) {
      setError(
        "Your business could not be found.",
      );
      return;
    }

    const cleanBusinessName =
      businessName.trim();

    if (!cleanBusinessName) {
      setError(
        "Business name cannot be empty.",
      );
      return;
    }

    const updatedBusiness =
      updateBusiness(
        business.id,
        {
          businessName:
            cleanBusinessName,
        },
      );

    if (!updatedBusiness) {
      setError(
        "The business information could not be updated.",
      );
      return;
    }

    setBusiness(updatedBusiness);

    setSuccess(
      "Business information updated successfully.",
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          Loading settings...
        </p>
      </main>
    );
  }

  if (!user || !business) {
    return (
      <main className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-xl bg-white p-6 shadow">
            <h1 className="text-2xl font-bold text-gray-900">
              Business Settings
            </h1>

            <p className="mt-2 text-gray-600">
              No business is connected to this
              account.
            </p>

            <Link
              href="/"
              className="mt-5 inline-block rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Business Settings
            </h1>

            <p className="mt-2 text-gray-600">
              Manage your shop's basic
              information.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-center font-medium text-gray-700 hover:bg-gray-50"
          >
            Dashboard
          </Link>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Business Information
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Update the information displayed
              for your business.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-5"
            >
              <div>
                <label
                  htmlFor="businessName"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Business / Shop Name
                </label>

                <input
                  id="businessName"
                  type="text"
                  value={businessName}
                  onChange={(event) =>
                    setBusinessName(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  placeholder="Enter business name"
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
                Save Changes
              </button>
            </form>
          </section>

          <section className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Business Status
            </h2>

            <div className="mt-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">
                  Business Name
                </p>

                <p className="mt-1 font-semibold text-gray-900">
                  {business.businessName}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Status
                </p>

                <p className="mt-1 font-semibold capitalize text-gray-900">
                  {business.status}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Subscription Plan
                </p>

                <p className="mt-1 font-semibold text-gray-900">
                  {business.plan}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Payment Status
                </p>

                <p className="mt-1 font-semibold capitalize text-gray-900">
                  {business.paymentStatus}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Subscription Expires
                </p>

                <p className="mt-1 font-semibold text-gray-900">
                  {business.subscriptionEndDate
                    ? new Date(
                        business.subscriptionEndDate,
                      ).toLocaleDateString()
                    : "Not active"}
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900">
            Packaging & Units
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Configure how products are sold using
            pieces, boxes, packs, kilograms,
            litres and other units.
          </p>

          <Link
            href="/settings/packaging"
            className="mt-5 inline-block rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
          >
            Manage Packaging
          </Link>
        </section>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <PermissionGuard permission="settings.manage">
      <SettingsContent />
    </PermissionGuard>
  );
}