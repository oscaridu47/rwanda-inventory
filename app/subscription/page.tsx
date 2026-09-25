"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import PermissionGuard from "@/app/components/PermissionGuard";

import {
  getCurrentUser,
  type User,
} from "@/app/lib/auth";

import {
  getBusinessByOwnerUserId,
  type Business,
} from "@/app/lib/businesses";

function SubscriptionContent() {
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
      setLoading(false);
      return;
    }

    setUser(currentUser);

    const currentBusiness =
      getBusinessByOwnerUserId(
        currentUser.id,
      );

    setBusiness(currentBusiness);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          Loading subscription...
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
              Subscription
            </h1>

            <p className="mt-2 text-gray-600">
              No business is connected to
              this account.
            </p>

            <Link
              href="/"
              className="mt-5 inline-block rounded-lg bg-black px-5 py-3 font-medium text-white"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const startDate =
    business.subscriptionStartDate
      ? new Date(
          business.subscriptionStartDate,
        )
      : null;

  const endDate =
    business.subscriptionEndDate
      ? new Date(
          business.subscriptionEndDate,
        )
      : null;

  const now = new Date();

  const daysRemaining = endDate
    ? Math.max(
        0,
        Math.ceil(
          (endDate.getTime() -
            now.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : 0;

  const isExpired =
    endDate !== null &&
    endDate.getTime() < now.getTime();

  const isActive =
    business.status === "active" &&
    business.paymentStatus === "paid" &&
    !isExpired;

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Subscription
            </h1>

            <p className="mt-2 text-gray-600">
              Manage your RwandaInventory
              business subscription.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-center font-medium text-gray-700 hover:bg-gray-50"
          >
            Dashboard
          </Link>
        </div>

        <div className="mt-8 rounded-2xl bg-black p-6 text-white">
          <p className="text-sm text-gray-300">
            Business
          </p>

          <h2 className="mt-1 text-3xl font-bold">
            {business.businessName}
          </h2>

          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm">
              Plan: {business.plan}
            </span>

            <span className="rounded-full bg-white/10 px-4 py-2 text-sm capitalize">
              Payment:{" "}
              {business.paymentStatus}
            </span>

            <span className="rounded-full bg-white/10 px-4 py-2 text-sm capitalize">
              Status: {business.status}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Current Plan
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {business.plan}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Payment Status
            </p>

            <p className="mt-2 text-2xl font-bold capitalize text-gray-900">
              {business.paymentStatus}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Time Remaining
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {isActive
                ? `${daysRemaining} days`
                : "Expired"}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900">
            Subscription Details
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">
                Subscription Start
              </p>

              <p className="mt-1 font-semibold text-gray-900">
                {startDate
                  ? startDate.toLocaleDateString()
                  : "Not started"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Subscription Expiry
              </p>

              <p className="mt-1 font-semibold text-gray-900">
                {endDate
                  ? endDate.toLocaleDateString()
                  : "Not set"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Business Status
              </p>

              <p className="mt-1 font-semibold capitalize text-gray-900">
                {business.status}
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
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-semibold text-blue-900">
            Subscription Renewal
          </h2>

          <p className="mt-2 text-sm leading-6 text-blue-800">
            When your subscription needs to be
            renewed, contact RwandaInventory
            administration for payment
            instructions. Your subscription
            status will be updated after the
            payment has been confirmed.
          </p>

          <div className="mt-5">
            <Link
              href="/"
              className="inline-block rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>

        {!isActive && (
          <div className="mt-6 rounded-xl border border-yellow-200 bg-yellow-50 p-6">
            <h2 className="font-semibold text-yellow-900">
              Subscription requires attention
            </h2>

            <p className="mt-2 text-sm text-yellow-800">
              Your business subscription is
              currently not active. Check your
              payment status or contact
              RwandaInventory administration.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function SubscriptionPage() {
  return (
    <PermissionGuard permission="settings.manage">
      <SubscriptionContent />
    </PermissionGuard>
  );
}