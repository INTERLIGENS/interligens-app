"use client";

import { useState, useEffect, useCallback } from "react";
import { deriveKeys, type VaultKeys } from "@/lib/vault/crypto.client";
import {
  getVaultSession,
  setVaultSession,
  clearVaultSession,
} from "@/lib/vault/session.client";

export function useVaultSession() {
  const [keys, setKeys] = useState<VaultKeys | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getVaultSession().then((k) => {
      if (cancelled) return;
      setKeys(k);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const unlock = useCallback(
    async (passphrase: string, saltHex: string): Promise<void> => {
      const derived = await deriveKeys(passphrase, saltHex);
      await setVaultSession(derived);
      setKeys(derived);
    },
    []
  );

  const lock = useCallback(() => {
    clearVaultSession();
    setKeys(null);
  }, []);

  return {
    keys,
    isLocked: !isLoading && keys === null,
    isLoading,
    unlock,
    lock,
  };
}
