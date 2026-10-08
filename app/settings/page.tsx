"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";

import {
  getCurrentUser,
  type User,
} from "@/app/lib/auth";

import PermissionGuard from "@/app/components/PermissionGuard";

import { supabase } from "@/app/lib/supabase";

type BusinessStatus =
  | "pending"
  | "active"
  | "rejected"
  | "suspended";

type PaymentStatus =
  | "pending"
  | "paid"
  | "overdue";

type Business = {
  id: string;
  name: string;
  status: BusinessStatus;
  payment_status: PaymentStatus;
  plan: string;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  created_at: string;
};

function SettingsContent() {
  const [user, setUser] =
    useState<User | null>(null);

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

  const [saving, setSaving] =
    useState(false);

  async function loadBusiness() {
    setError("");

    try {
      const currentUser =
        getCurrentUser();

      if (!currentUser) {
        setLoading(false);
        return;
      }

      if (!currentUser.businessId) {
        throw new Error(
          "Your account is not connected to a business.",
        );
      }

      setUser(currentUser);

      const {
        data,
        error: businessError,
      } = await supabase
        .from("businesses")
        .select(
          `
            id,
            name,
            status,
            payment_status,
            plan,
            subscription_start_date,
            subscription_end_date,
            created_at
          `,
        )
        .eq(
          "id",
          currentUser.businessId,
        )
        .maybeSingle();

      if (businessError) {
        throw new Error(
          businessError.message,
        );
      }

      if (!data) {
        throw new Error(
          "Your business could not be found.",
        );
      }

      const loadedBusiness =
        data as Business;

      setBusiness(
        loadedBusiness,
      );

      setBusinessName(
        loadedBusiness.name,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load business settings.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBusiness();
  }, []);

  async function handleSubmit(
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

    if (
      cleanBusinessName ===
      business.name
    ) {
      setSuccess(
        "No changes were made.",
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: updatedBusiness,
        error: updateError,
      } =
        await supabase
          .from("businesses")
          .update({
            name: cleanBusinessName,
          })
          .eq(
            "id",
            business.id,
          )
          .select(
            `
              id,
              name,
              status,
              payment_status,
              plan,
              subscription_start_date,
              subscription_end_date,
              created_at
            `,
          )
          .maybeSingle();

      if (updateError) {
        throw new Error(
          updateError.message,
        );
      }

      if (!updatedBusiness) {
        throw new Error(
          "The business information could not be updated. You may not have permission to manage business settings.",
        );
      }

      const updated =
        updatedBusiness as Business;

      setBusiness(updated);
      setBusinessName(
        updated.name,
      );

      setSuccess(
        "Business information updated successfully.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The business information could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-gray-600">
            Loading settings...
          </p>
        </div>
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
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
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
                disabled={saving}
                className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Save Changes"}
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
                  {business.name}
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
                  {business.payment_status}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Subscription Expires
                </p>

                <p className="mt-1 font-semibold text-gray-900">
                  {business.subscription_end_date
                    ? new Date(
                        business.subscription_end_date,
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