"use client";

import { useRouter } from "next/navigation";
import { TulipLogo } from "@/components/TulipLogo";
import { AuthForm } from "@/components/AuthForm";

export default function AuthPage() {
  const router = useRouter();

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div className="card" style={{ padding: "2rem", width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <TulipLogo size={40} />
          <h1 style={{ fontWeight: 700, fontSize: "1.4rem" }}>Welcome to Tulip</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", textAlign: "center" }}>
            Safety-first journey planning for Delhi NCR
          </p>
        </div>

        <AuthForm
          onSuccess={() => {
            router.push("/");
            router.refresh();
          }}
        />
      </div>
    </main>
  );
}
