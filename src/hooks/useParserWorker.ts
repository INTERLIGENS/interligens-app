"use client";

import { useEffect, useRef, useCallback } from "react";

export type ParsedEntity = {
  type:
    | "WALLET"
    | "TX_HASH"
    | "HANDLE"
    | "URL"
    | "DOMAIN"
    | "ALIAS"
    | "EMAIL"
    | "IP"
    | "CONTRACT"
    | "OTHER";
  value: string;
  confidence: number;
  extractionMethod: string;
};

export type WorkerResult = {
  parseStatus: "PARSED" | "PARTIAL" | "MANUAL_REQUIRED" | "FAILED";
  entities: ParsedEntity[];
  entitiesFound: number;
  parseMode?: string;
  error?: string;
};

export function useParserWorker() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    workerRef.current = new Worker(
      new URL("../lib/vault/parser.worker.ts", import.meta.url),
      { type: "module" }
    );
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const parseFile = useCallback((file: File): Promise<WorkerResult> => {
    return new Promise((resolve, reject) => {
      const w = workerRef.current;
      if (!w) {
        reject(new Error("worker-not-ready"));
        return;
      }
      const handle = (e: MessageEvent<WorkerResult>) => {
        w.removeEventListener("message", handle);
        resolve(e.data);
      };
      w.addEventListener("message", handle);
      w.postMessage({ file });
    });
  }, []);

  return { parseFile };
}
