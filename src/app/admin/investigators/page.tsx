"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Application = {
  id: string;
  handle: string;
  displayName: string | null;
  email: string;
  country: string;
  languages: string[];
  specialties: string[];
  background: string;
  motivation: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
  submittedAt: string;
  internalNote: string | null;
};

type Profile = {
  id: string;
  handle: string;
  legalFirstName: string | null;
  legalLastName: string | null;
  primaryEmail: string | null;
  verificationStatus: string;
  accessLevel: string;
  accessState: string;
  workspaceActivatedAt: string | null;
  lastActiveAt: string | null;
  ndaAcceptance: { ndaVersion: string; ndaLanguage: string; signedAt: string } | null;
  betaTermsAcceptance: { termsVersion: string; termsLanguage: string; acceptedAt: string } | null;
};

function Badge({ value }: { value: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs bg-[#1a1a1a] text-gray-300 font-mono uppercase">
      {value.replace(/_/g, " ")}
    </span>
  );
}

export default function AdminInvestigatorsPage() {
  const [tab, setTab] = useState<"apps" | "profiles">("apps");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "applications") setTab("apps");
    else if (t === "profiles") setTab("profiles");
  }, []);

  const [applications, setApplications] = useState<Application[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true);
    try {
      const [appsRes, profsRes] = await Promise.all([
        fetch("/api/admin/investigators/applications"),
        fetch("/api/admin/investigators"),
      ]);
      if (appsRes.status === 401) {
        setError("Admin authentication required.");
        setLoading(false);
        return;
      }
      const apps = appsRes.ok ? await appsRes.json() : { applications: [] };
      const profs = profsRes.ok ? await profsRes.json() : { profiles: [] };
      setApplications(apps.applications ?? []);
      setProfiles(profs.profiles ?? []);
      setError(null);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function reviewApp(id: string, decision: "APPROVED" | "REJECTED" | "NEEDS_REVIEW") {
    setPendingAction(id);
    try {
      const res = await fetch(`/api/admin/investigators/applications/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, internalNote: noteDrafts[id] ?? undefined }),
      });
      if (res.ok) await loadAll();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-orange-400">Trusted Investigator Program</h1>
          <p className="text-gray-400 text-sm">Applications & active investigators</p>
        </div>

        {/* Tabs */}
        <div className="bg-[#111] rounded-xl border border-gray-800 p-5">
          <div className="flex gap-2 flex-wrap">
            {(["apps", "profiles"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === t ? "bg-orange-500 text-black" : "bg-[#1a1a1a] text-gray-300 hover:bg-gray-700"}`}
              >
                {t === "apps" ? `Applications (${applications.length})` : `Investigators (${profiles.length})`}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading && !error && <div className="text-gray-500 text-sm">Loading...</div>}

        {/* Applications tab */}
        {tab === "apps" && !loading && (
          <div>
            {applications.length === 0 ? (
              <div className="bg-[#111] rounded-xl border border-gray-800 p-8 text-center text-gray-500 text-sm">
                No applications yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="bg-[#111] rounded-xl border border-gray-800 p-5 space-y-3"
                  >
                    <div className="flex justify-between items-start gap-4 flex-wrap">
                      <div>
                        <div className="text-sm font-bold text-white mb-1">
                          @{app.handle}
                          {app.displayName && (
                            <span className="text-gray-400 font-normal ml-2">
                              · {app.displayName}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {app.email} · {app.country} · {new Date(app.submittedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge value={app.status} />
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {app.languages.map((l) => (
                        <span
                          key={l}
                          className="inline-block px-2 py-0.5 rounded text-xs bg-[#1a1a1a] text-gray-400 font-mono uppercase"
                        >
                          {l}
                        </span>
                      ))}
                      {app.specialties.map((s) => (
                        <span
                          key={s}
                          className="inline-block px-2 py-0.5 rounded text-xs bg-[#1a1a1a] text-orange-400 font-mono"
                        >
                          {s}
                        </span>
                      ))}
                    </div>

                    <details>
                      <summary className="text-gray-400 text-xs cursor-pointer hover:text-orange-400 transition">
                        Show full application
                      </summary>
                      <div className="mt-3 text-xs text-gray-400 leading-relaxed">
                        <div className="mb-2">
                          <strong className="text-white">Background:</strong>
                          <br />
                          {app.background}
                        </div>
                        <div>
                          <strong className="text-white">Motivation:</strong>
                          <br />
                          {app.motivation}
                        </div>
                      </div>
                    </details>

                    <textarea
                      value={noteDrafts[app.id] ?? app.internalNote ?? ""}
                      onChange={(e) =>
                        setNoteDrafts((d) => ({ ...d, [app.id]: e.target.value }))
                      }
                      placeholder="Internal review note..."
                      rows={2}
                      className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                    />

                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => reviewApp(app.id, "APPROVED")}
                        disabled={pendingAction === app.id}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reviewApp(app.id, "NEEDS_REVIEW")}
                        disabled={pendingAction === app.id}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#1a1a1a] text-gray-300 hover:bg-gray-700 transition"
                      >
                        Needs Review
                      </button>
                      <button
                        onClick={() => reviewApp(app.id, "REJECTED")}
                        disabled={pendingAction === app.id}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#1a1a1a] text-red-400 hover:bg-gray-700 transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profiles tab */}
        {tab === "profiles" && !loading && (
          <div>
            {profiles.length === 0 ? (
              <div className="bg-[#111] rounded-xl border border-gray-800 p-8 text-center text-gray-500 text-sm">
                No investigators yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {profiles.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/investigators/${p.id}`}
                    className="block bg-[#111] rounded-xl border border-gray-800 hover:border-orange-500 p-4 transition"
                  >
                    <div className="flex justify-between items-center gap-4 flex-wrap">
                      <div>
                        <div className="text-sm font-bold text-white">
                          @{p.handle}
                          {p.legalFirstName && (
                            <span className="text-gray-400 font-normal ml-2">
                              · {p.legalFirstName} {p.legalLastName}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 font-mono mt-1">
                          {p.primaryEmail ?? "—"} ·{" "}
                          {p.lastActiveAt
                            ? `last active ${new Date(p.lastActiveAt).toLocaleDateString()}`
                            : "never active"}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        <Badge value={p.verificationStatus} />
                        <Badge value={p.accessLevel} />
                        <Badge value={p.accessState} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
