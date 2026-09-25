"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "../lib/auth";
import {
  hasPermission,
  type Permission,
} from "../lib/permissions";

type PermissionGuardProps = {
  permission: Permission;
  children: ReactNode;
};

export default function PermissionGuard({
  permission,
  children,
}: PermissionGuardProps) {
  const router = useRouter();

  const [allowed, setAllowed] =
    useState<boolean | null>(null);

  useEffect(() => {
    const user = getCurrentUser();

    /*
     * No logged-in user
     */
    if (!user) {
      router.replace("/auth");
      return;
    }

    /*
     * IMPORTANT:
     *
     * Check the employee's CUSTOM permissions.
     *
     * This means the Owner can give a Worker,
     * Staff member, or Manager access to
     * specific features.
     */
    const permitted = hasPermission(
      user.role,
      permission,
      user.permissions,
    );

    setAllowed(permitted);
  }, [permission, router]);

  /*
   * While checking the account
   */
  if (allowed === null) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          fontFamily:
            "Arial, sans-serif",
        }}
      >
        Checking access...
      </div>
    );
  }

  /*
   * User does not have permission
   */
  if (!allowed) {
    return (
      <div
        style={{
          maxWidth: "600px",
          margin: "60px auto",
          padding: "30px 20px",
          textAlign: "center",
          fontFamily:
            "Arial, sans-serif",
        }}
      >
        <h1
          style={{
            marginBottom: "10px",
          }}
        >
          Access Denied
        </h1>

        <p
          style={{
            color: "#666",
            marginBottom: "20px",
          }}
        >
          Your account does not have
          permission to access this
          feature.
        </p>

        <button
          type="button"
          onClick={() =>
            router.push("/")
          }
          style={{
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            background: "#111827",
            color: "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  /*
   * Permission approved
   */
  return <>{children}</>;
}