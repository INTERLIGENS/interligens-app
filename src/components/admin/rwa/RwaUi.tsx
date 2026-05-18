"use client";
import Link from "next/link";
import React from "react";

export function PageShell({
  title,
  sub,
  right,
  children,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold text-orange-400">{title}</h1>
            {sub && <p className="text-gray-400 text-sm mt-1">{sub}</p>}
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="text-xs text-gray-500 space-x-1">
      {items.map((it, i) => (
        <span key={i}>
          {it.href ? (
            <Link href={it.href} className="hover:text-orange-400">
              {it.label}
            </Link>
          ) : (
            <span className="text-gray-300">{it.label}</span>
          )}
          {i < items.length - 1 && <span className="mx-1 text-gray-700">/</span>}
        </span>
      ))}
    </nav>
  );
}

export function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          {title}
        </h2>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const color =
    status === "PUBLISHED" || status === "VERIFIED_OFFICIAL"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : status === "REVIEW"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : status === "DEPRECATED" ||
        status === "REVOKED" ||
        status === "SUSPECTED_OLD"
      ? "bg-red-500/15 text-red-400 border-red-500/30"
      : "bg-gray-700/30 text-gray-400 border-gray-700";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${color}`}
    >
      {status}
    </span>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500";

export function PrimaryBtn({
  children,
  disabled,
  onClick,
  type,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      className="text-xs uppercase tracking-wider px-4 py-2 rounded bg-orange-500 text-black font-semibold hover:bg-orange-400 disabled:bg-gray-700 disabled:text-gray-500"
    >
      {children}
    </button>
  );
}

export function GhostBtn({
  children,
  onClick,
  danger,
  disabled,
  type,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const color = danger
    ? "border-red-700 text-red-400 hover:border-red-500"
    : "border-gray-700 text-gray-300 hover:border-orange-500 hover:text-orange-400";
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      className={`text-xs uppercase tracking-wider px-3 py-2 rounded border ${color} disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

export function Msg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  const ok = msg.startsWith("✓");
  return (
    <div
      className={`rounded-lg p-3 text-sm ${
        ok
          ? "bg-gray-900 border border-gray-800 text-emerald-400"
          : "bg-red-900/30 border border-red-700 text-red-400"
      }`}
    >
      {msg}
    </div>
  );
}
