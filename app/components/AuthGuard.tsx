"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const SESSION_STORAGE_KEY = "rwanda-inventory-session";

type Session = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "staff";
};

export default function AuthGuard({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    try {
      const storedSession = localStorage.getItem(
        SESSION_STORAGE_KEY,
      );

      if (!storedSession) {
        router.replace("/auth");
        return;
      }

      const session: Session = JSON.parse(storedSession);

      if (
        !session.userId ||
        !session.email ||
        !session.role
      ) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        router.replace("/auth");
        return;
      }

      setAuthenticated(true);
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      router.replace("/auth");
    } finally {
      setChecking(false);
    }
  }, [router]);

  if (checking) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <p>Checking your login...</p>
      </main>
    );
  }

  if (!authenticated) {
    return null;
  }

  return <>{children}</>;
}