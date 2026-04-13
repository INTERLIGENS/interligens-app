"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type ToastType = "error" | "success" | "info";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
};

type ToastContextValue = {
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  showInfo: (msg: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useVaultToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showError: () => {},
      showSuccess: () => {},
      showInfo: () => {},
    };
  }
  return ctx;
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: (id: string) => void;
}) {
  useEffect(() => {
    const t = setTimeout(() => onClose(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  const border =
    toast.type === "error"
      ? "rgba(255,59,92,0.4)"
      : toast.type === "success"
        ? "rgba(0,200,83,0.4)"
        : "rgba(255,107,0,0.3)";

  return (
    <div
      style={{
        backgroundColor: "#111",
        border: `1px solid ${border}`,
        padding: "12px 16px",
        borderRadius: 8,
        maxWidth: 320,
        fontSize: 13,
        color: "#FFFFFF",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        animation: "vaultToastSlideIn 180ms ease",
      }}
    >
      <span style={{ flex: 1, lineHeight: 1.5 }}>{toast.message}</span>
      <button
        onClick={() => onClose(toast.id)}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.4)",
          fontSize: 14,
          cursor: "pointer",
          padding: 0,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

export function VaultToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const duration = type === "error" ? 6000 : type === "success" ? 3000 : 4000;
    setToasts((prev) => [{ id, type, message, duration }, ...prev]);
  }, []);

  const close = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    showError: (msg) => push("error", msg),
    showSuccess: (msg) => push("success", msg),
    showInfo: (msg) => push("info", msg),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 80,
          right: 20,
          zIndex: 120,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        <style>{`
          @keyframes vaultToastSlideIn {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}</style>
        <div style={{ pointerEvents: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onClose={close} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
