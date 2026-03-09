// src/app/admin/login/page.tsx
"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AdminLoginInner() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/admin/intel-vault";

  async function handleSubmit() {
    if (!token.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: token.trim() }),
      });
      if (!res.ok) {
        setError("Token invalide.");
        return;
      }
      router.push(redirect);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm space-y-4">
        <h1 className="text-white font-bold text-xl">INTERLIGENS Admin</h1>
        <p className="text-gray-400 text-sm">Token requis pour accéder à cette zone.</p>
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          placeholder="ADMIN_TOKEN"
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-orange-500"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-semibold py-2 rounded-lg text-sm transition"
        >
          {loading ? "Vérification…" : "Accéder"}
        </button>
      </div>
    </div>
  );
}

export default function AdminLogin() {
  return <Suspense><AdminLoginInner /></Suspense>
}
