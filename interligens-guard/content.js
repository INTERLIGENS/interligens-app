console.log('INTERLIGENS Guard loaded');
// INTERLIGENS Guard — Content Script
// Detects DEX pages, extracts Solana mint addresses, injects score badge.

(function () {
  "use strict";

  // ── C2: DEX Configuration ──────────────────────────────────────────────────

  var DEX_CONFIGS = {
    "pump.fun": {
      urlPattern: /pump\.fun\/coin\/([A-Za-z0-9]{32,44})/,
      mintFromUrl: function (url) {
        var m = url.match(/pump\.fun\/coin\/([A-Za-z0-9]{32,44})/);
        return m ? m[1] : null;
      },
      injectTarget: ".token-info, [class*=\"token\"], main"
    },
    "jup.ag": {
      urlPattern: /jup\.ag\/swap\/.+-([A-Za-z0-9]{32,44})/,
      mintFromUrl: function (url) {
        var m = url.match(/jup\.ag\/swap\/.+-([A-Za-z0-9]{32,44})/);
        return m ? m[1] : null;
      },
      injectTarget: "[class*=\"swap\"], [class*=\"token\"]"
    },
    "birdeye.so": {
      urlPattern: /birdeye\.so\/(?:solana\/)?token\/([A-Za-z0-9]{32,44})/,
      mintFromUrl: function (url) {
        var m = url.match(/birdeye\.so\/(?:solana\/)?token\/([A-Za-z0-9]{32,44})/);
        return m ? m[1] : null;
      },
      injectTarget: "[class*=\"header\"], [class*=\"token-detail\"]"
    },
    "dexscreener.com": {
      urlPattern: /dexscreener\.com\/solana\/([A-Za-z0-9]{32,44})/,
      mintFromUrl: function (url) {
        var m = url.match(/dexscreener\.com\/solana\/([A-Za-z0-9]{32,44})/);
        return m ? m[1] : null;
      },
      injectTarget: "[class*=\"header\"], [class*=\"pair\"]"
    },
    "raydium.io": {
      urlPattern: /raydium\.io\/(swap|liquidity)/,
      mintFromUrl: function (url) {
        var parts = url.split("?");
        if (parts.length < 2) return null;
        var params = new URLSearchParams(parts[1]);
        return params.get("inputMint") || params.get("outputMint") || null;
      },
      injectTarget: "[class*=\"swap-card\"]"
    }
  };

  var BADGE_ID = "interligens-guard-badge";
  var MM_BADGE_ID = "interligens-guard-mm-badge";
  var currentMint = null;
  var isScoring = false;

  // ── C3: Mint Extraction ────────────────────────────────────────────────────

  function getActiveDexConfig() {
    var hostname = window.location.hostname.replace(/^www\./, "");
    for (var key in DEX_CONFIGS) {
      if (hostname.indexOf(key) !== -1) {
        return DEX_CONFIGS[key];
      }
    }
    return null;
  }

  // Layer 1: extract mint from URL
  function mintFromUrl() {
    console.log("[INTERLIGENS Guard] Trying mint from URL:", window.location.href);
    var config = getActiveDexConfig();
    if (!config) {
      console.log("[INTERLIGENS Guard] No DEX config match for hostname:", window.location.hostname);
      return null;
    }
    var mint = config.mintFromUrl(window.location.href);
    console.log("[INTERLIGENS Guard] mintFromUrl result:", mint);
    return mint;
  }

  // Layer 2: extract mint from DOM (fallback)
  function mintFromDOM() {
    var text = document.body ? document.body.innerText : "";
    var base58Pattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
    var candidates = text.match(base58Pattern) || [];
    // Filter: keep only 32-44 chars, exclude tx signatures (87+ chars already excluded by regex)
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c.length >= 32 && c.length <= 44) {
        return c;
      }
    }
    return null;
  }

  // Layer 3: check session storage
  function mintFromSession() {
    try {
      var stored = sessionStorage.getItem("interligens_last_mint");
      return stored || null;
    } catch {
      return null;
    }
  }

  function detectMint() {
    return mintFromUrl() || mintFromDOM() || mintFromSession();
  }

  // ── C4: Badge Injection ────────────────────────────────────────────────────

  var VERDICT_COLORS = {
    RED: "#FF3B5C",
    ORANGE: "#FF6B00",
    GREEN: "#00C853"
  };

  function removeBadge() {
    var existing = document.getElementById(BADGE_ID);
    if (existing) existing.remove();
  }

  function createLoadingBadge() {
    removeBadge();

    var badge = document.createElement("div");
    badge.id = BADGE_ID;
    badge.style.cssText = [
      "position:fixed",
      "bottom:24px",
      "right:24px",
      "z-index:999999",
      "background:#000000",
      "border:2px solid #FF6B00",
      "border-radius:12px",
      "padding:12px 16px",
      "font-family:monospace",
      "color:#FFFFFF",
      "font-size:13px",
      "min-width:200px",
      "box-shadow:0 0 20px #FF6B0044",
      "animation:interligens-pulse 1.5s ease-in-out infinite"
    ].join(";");

    badge.innerHTML = [
      "<div style=\"display:flex;align-items:center;gap:8px;margin-bottom:6px\">",
      "  <span style=\"color:#FF6B00;font-weight:bold;font-size:11px\">INTERLIGENS</span>",
      "  <span style=\"color:#888;font-size:11px\">GUARD</span>",
      "</div>",
      "<div style=\"font-size:14px;color:#888\">Scanning token...</div>"
    ].join("");

    // Inject pulse animation
    if (!document.getElementById("interligens-guard-style")) {
      var style = document.createElement("style");
      style.id = "interligens-guard-style";
      style.textContent = "@keyframes interligens-pulse{0%,100%{opacity:1}50%{opacity:0.6}}";
      document.head.appendChild(style);
    }

    document.body.appendChild(badge);
    return badge;
  }

  function createScoreBadge(scoreData) {
    removeBadge();

    var color = VERDICT_COLORS[scoreData.verdict] || "#6B7280";
    var signalCount = scoreData.signals ? scoreData.signals.length : 0;
    var signalText = signalCount + " risk signal" + (signalCount !== 1 ? "s" : "") + " detected";
    var cachedText = scoreData.cached ? " (cached)" : "";

    var badge = document.createElement("div");
    badge.id = BADGE_ID;
    badge.style.cssText = [
      "position:fixed",
      "bottom:24px",
      "right:24px",
      "z-index:999999",
      "background:#000000",
      "border:2px solid " + color,
      "border-radius:12px",
      "padding:12px 16px",
      "font-family:monospace",
      "color:#FFFFFF",
      "font-size:13px",
      "cursor:pointer",
      "box-shadow:0 0 20px " + color + "44",
      "min-width:200px",
      "transition:transform 0.2s ease"
    ].join(";");

    badge.innerHTML = [
      "<div style=\"display:flex;align-items:center;gap:8px;margin-bottom:6px\">",
      "  <span style=\"color:#FF6B00;font-weight:bold;font-size:11px\">INTERLIGENS</span>",
      "  <span style=\"background:" + color + ";color:#000;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold\">" + scoreData.verdict + "</span>",
      "</div>",
      "<div style=\"font-size:28px;font-weight:bold;color:" + color + "\">" + scoreData.score + "<span style=\"font-size:14px;color:#666\">/100</span></div>",
      "<div style=\"font-size:11px;color:#888;margin-top:4px\">" + signalText + cachedText + "</div>",
      "<div style=\"font-size:10px;color:#444;margin-top:6px\">Click for details</div>"
    ].join("");

    // Hover effect
    badge.addEventListener("mouseenter", function () {
      badge.style.transform = "scale(1.03)";
    });
    badge.addEventListener("mouseleave", function () {
      badge.style.transform = "scale(1)";
    });

    // Click opens detailed view in a new tab
    badge.addEventListener("click", function () {
      var url = "https://app.interligens.com/scan";
      window.open(url, "_blank", "noopener,noreferrer");
    });

    document.body.appendChild(badge);
    return badge;
  }

  function createErrorBadge(message) {
    removeBadge();

    var badge = document.createElement("div");
    badge.id = BADGE_ID;
    badge.style.cssText = [
      "position:fixed",
      "bottom:24px",
      "right:24px",
      "z-index:999999",
      "background:#000000",
      "border:2px solid #333",
      "border-radius:12px",
      "padding:12px 16px",
      "font-family:monospace",
      "color:#666",
      "font-size:12px",
      "min-width:200px",
      "cursor:pointer"
    ].join(";");

    badge.innerHTML = [
      "<div style=\"display:flex;align-items:center;gap:8px;margin-bottom:4px\">",
      "  <span style=\"color:#FF6B00;font-weight:bold;font-size:11px\">INTERLIGENS</span>",
      "  <span style=\"color:#666;font-size:11px\">GUARD</span>",
      "</div>",
      "<div style=\"font-size:11px;color:#666\">" + message + "</div>"
    ].join("");

    // Click to dismiss
    badge.addEventListener("click", function () {
      removeBadge();
    });

    document.body.appendChild(badge);

    // Auto-dismiss after 8 seconds
    setTimeout(function () {
      var el = document.getElementById(BADGE_ID);
      if (el === badge) removeBadge();
    }, 8000);
  }

  // ── MM badge (Phase 10) ────────────────────────────────────────────────────
  // Additional badge rendered above the TigerScore badge when the MM public
  // endpoint returns a cached risk summary with displayScore >= 40. Fails
  // silently on 404 / error — the TigerScore badge never depends on it.

  var MM_BAND_COLORS = {
    RED: "#CC0000",
    ORANGE: "#FF6B00",
    // YELLOW / GREEN never render a MM badge per Phase 10 spec.
  };

  function removeMmBadge() {
    var existing = document.getElementById(MM_BADGE_ID);
    if (existing) existing.remove();
  }

  function createMmBadge(mmData) {
    removeMmBadge();
    if (!mmData || typeof mmData.displayScore !== "number") return;
    if (mmData.displayScore < 40) return;
    var band = mmData.band || "ORANGE";
    var bg = MM_BAND_COLORS[band] || "#FF6B00";
    var tooltip =
      mmData.disclaimer ||
      "MM Risk: patterns de manipulation on-chain détectés ou entité Market Maker documentée.";

    var badge = document.createElement("div");
    badge.id = MM_BADGE_ID;
    badge.title = tooltip;
    badge.style.cssText = [
      "position:fixed",
      // Positioned just above the TigerScore badge (which sits at bottom:24px).
      "bottom:170px",
      "right:24px",
      "z-index:999999",
      "background:" + bg,
      "color:#FFFFFF",
      "border-radius:10px",
      "padding:8px 12px",
      "font-family:monospace",
      "font-size:12px",
      "font-weight:bold",
      "box-shadow:0 0 18px " + bg + "66",
      "cursor:pointer",
      "display:flex",
      "align-items:center",
      "gap:8px",
      "max-width:240px",
    ].join(";");

    // Warning triangle glyph + label + score.
    badge.innerHTML = [
      "<span style=\"font-size:14px\">&#9888;</span>",
      "<span style=\"letter-spacing:1.5px\">MM Risk</span>",
      "<span style=\"background:rgba(0,0,0,0.28);padding:2px 6px;border-radius:4px\">" +
        String(mmData.displayScore) +
        " " +
        band +
        "</span>",
    ].join("");

    badge.addEventListener("click", function () {
      var target =
        mmData.entity && mmData.entity.slug
          ? "https://app.interligens.com/mm/" + mmData.entity.slug
          : "https://app.interligens.com/mm";
      window.open(target, "_blank", "noopener,noreferrer");
    });

    document.body.appendChild(badge);
  }

  function requestMmRisk(mint) {
    try {
      chrome.runtime.sendMessage(
        { type: "MM_RISK", mint: mint, chain: "SOLANA" },
        function (response) {
          if (chrome.runtime.lastError) return; // silent
          if (!response || !response.success) return;
          createMmBadge(response.data);
        },
      );
    } catch {
      // API unavailable — silent.
    }
  }

  // ── Main scan logic ────────────────────────────────────────────────────────

  function scanCurrentPage() {
    var mint = detectMint();
    console.log("[INTERLIGENS Guard] hostname:", window.location.hostname, "url:", window.location.href, "mint:", mint);

    if (!mint) {
      // No mint found — no badge needed
      if (currentMint) {
        removeBadge();
        removeMmBadge();
        currentMint = null;
      }
      return;
    }

    // Same mint already scored — skip
    if (mint === currentMint) return;

    // A fresh mint — clear the MM badge before re-rendering
    removeMmBadge();

    // Prevent concurrent scoring
    if (isScoring) return;

    currentMint = mint;
    isScoring = true;

    // Store for Layer 3 fallback
    try {
      sessionStorage.setItem("interligens_last_mint", mint);
    } catch {}

    // Show loading badge
    console.log("[INTERLIGENS Guard] createLoadingBadge() for mint:", mint);
    createLoadingBadge();
    console.log("[INTERLIGENS Guard] badge in DOM:", !!document.getElementById(BADGE_ID));

    // Request score from background service worker
    chrome.runtime.sendMessage(
      { type: "SCORE_TOKEN", mint: mint },
      function (response) {
        isScoring = false;

        if (chrome.runtime.lastError) {
          createErrorBadge("Extension error");
          return;
        }

        if (!response || !response.success) {
          var errMsg = (response && response.error) || "Score unavailable";
          createErrorBadge(errMsg);
          return;
        }

        createScoreBadge(response.data);
      }
    );

    // Parallel, non-blocking MM risk lookup. Fires-and-forgets regardless
    // of the TigerScore result. Fails silently on 404 / disabled.
    requestMmRisk(mint);
  }

  // ── SPA Navigation Observer ────────────────────────────────────────────────

  var lastUrl = window.location.href;

  function checkUrlChange() {
    var newUrl = window.location.href;
    if (newUrl !== lastUrl) {
      lastUrl = newUrl;
      // URL changed — re-scan after a short delay for SPA rendering
      currentMint = null;
      setTimeout(scanCurrentPage, 800);
    }
  }

  // Watch for SPA navigation via MutationObserver
  var observer = new MutationObserver(function () {
    checkUrlChange();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also poll for URL changes (some SPAs don't trigger DOM mutations on nav)
  setInterval(checkUrlChange, 2000);

  // ── Initial scan ───────────────────────────────────────────────────────────

  // Immediate scan — SPAs like Birdeye already have the token mounted on load
  console.log("[INTERLIGENS Guard] Running immediate scan");
  scanCurrentPage();

  // Fallback scan after 2s in case SPA hydration was still pending
  setTimeout(function () {
    console.log("[INTERLIGENS Guard] Running 2s fallback scan");
    scanCurrentPage();
  }, 2000);
})();
