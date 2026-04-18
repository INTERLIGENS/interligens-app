// INTERLIGENS Guard — Background Service Worker
// Handles API calls (avoids CORS from content scripts) and session cache.

const API_BASE = "https://app.interligens.com/api/v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (TigerScore)
const MM_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (MM risk)

// ── Score fetcher with session cache ────────────────────────────────────────

async function getScore(mint) {
  // 1. Check session cache
  const cacheKey = "score_" + mint;
  try {
    const cached = await chrome.storage.session.get(cacheKey);
    if (cached[cacheKey]) {
      const entry = cached[cacheKey];
      if (Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
        return { ...entry.data, cached: true };
      }
    }
  } catch {
    // storage.session may not be available in all contexts
  }

  // 2. Fetch from API
  const response = await fetch(API_BASE + "/score?mint=" + encodeURIComponent(mint));
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "API error " + response.status);
  }
  const data = await response.json();

  // 3. Store in session cache
  try {
    await chrome.storage.session.set({
      [cacheKey]: { data: data, fetchedAt: Date.now() }
    });
  } catch {
    // fail silently if storage unavailable
  }

  return data;
}

// ── MM risk fetcher with session cache (Phase 10) ─────────────────────────
// Read-only badge endpoint. Returns null when the user opted out or when the
// server has no cached MM analysis for the token — callers must render
// nothing in those cases.

async function isMmAlertsEnabled() {
  try {
    const res = await chrome.storage.local.get("mm_alerts_enabled");
    // Default: enabled. Only disabled when explicitly set to false.
    return res.mm_alerts_enabled !== false;
  } catch {
    return true;
  }
}

async function getMmRisk(mint, chain) {
  if (!mint) return null;
  if (!(await isMmAlertsEnabled())) return null;

  const cacheChain = (chain || "SOLANA").toUpperCase();
  const cacheKey = "mm_" + cacheChain + "_" + mint;

  // 1. Session cache first
  try {
    const cached = await chrome.storage.session.get(cacheKey);
    if (cached[cacheKey]) {
      const entry = cached[cacheKey];
      if (Date.now() - entry.fetchedAt < MM_CACHE_TTL_MS) {
        return { ...entry.data, cached: true };
      }
    }
  } catch {}

  // 2. Public badge endpoint — 404 means "no MM analysis", fail silently.
  const url =
    API_BASE +
    "/mm/public/badge?tokenAddress=" +
    encodeURIComponent(mint) +
    "&chain=" +
    encodeURIComponent(cacheChain) +
    "&subjectType=TOKEN";

  let response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }
  if (response.status === 404) return null;
  if (!response.ok) return null;

  let data;
  try {
    data = await response.json();
  } catch {
    return null;
  }
  if (
    typeof data !== "object" ||
    data === null ||
    typeof data.displayScore !== "number"
  ) {
    return null;
  }

  // 3. Store in session cache
  try {
    await chrome.storage.session.set({
      [cacheKey]: { data: data, fetchedAt: Date.now() },
    });
  } catch {}

  return data;
}

// ── Message listener ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === "SCORE_TOKEN") {
    getScore(request.mint)
      .then(function (data) {
        sendResponse({ success: true, data: data });
      })
      .catch(function (err) {
        sendResponse({ success: false, error: err.message });
      });
    return true; // keep channel open for async response
  }

  if (request.type === "MM_RISK") {
    getMmRisk(request.mint, request.chain)
      .then(function (data) {
        sendResponse({ success: true, data: data });
      })
      .catch(function () {
        // Always fail silently for the MM badge. The extension must keep
        // working even when MM is unreachable.
        sendResponse({ success: true, data: null });
      });
    return true;
  }

  if (request.type === "GET_ACTIVE_SCORE") {
    // Return cached score for a mint (used by popup)
    var cacheKey = "score_" + request.mint;
    chrome.storage.session.get(cacheKey).then(function (cached) {
      if (cached[cacheKey] && Date.now() - cached[cacheKey].fetchedAt < CACHE_TTL_MS) {
        sendResponse({ success: true, data: cached[cacheKey].data });
      } else {
        sendResponse({ success: false, error: "no_cache" });
      }
    }).catch(function () {
      sendResponse({ success: false, error: "storage_error" });
    });
    return true;
  }
});
