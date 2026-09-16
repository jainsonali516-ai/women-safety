"use client";

import { useRouter } from "next/navigation";
import { TulipLogo } from "@/components/TulipLogo";
import { AuthForm } from "@/components/AuthForm";
import { T } from "@/components/Translated";

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
          <h1 style={{ fontWeight: 700, fontSize: "1.4rem" }}>
            <T>Welcome to HerLane</T>
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", textAlign: "center" }}>
            <T>Safety-first journey planning for Delhi NCR</T>
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
