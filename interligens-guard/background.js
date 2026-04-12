// INTERLIGENS Guard — Background Service Worker
// Handles API calls (avoids CORS from content scripts) and session cache.

const API_BASE = "https://app.interligens.com/api/v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
