// INTERLIGENS Guard — Popup Logic

(function () {
  "use strict";

  var VERDICT_COLORS = {
    RED: "#FF3B5C",
    ORANGE: "#FF6B00",
    GREEN: "#00C853"
  };

  var SEVERITY_COLORS = {
    CRITICAL: "#FF3B5C",
    HIGH: "#FF6B00",
    MEDIUM: "#FACC15",
    LOW: "#6B7280"
  };

  var contentEl = document.getElementById("content");
  var emptyState = document.getElementById("empty-state");
  var manualInput = document.getElementById("manual-input");
  var scanBtn = document.getElementById("scan-btn");
  var errorMsg = document.getElementById("error-msg");

  // ── Render score card ──────────────────────────────────────────────────────

  function renderScore(data) {
    var color = VERDICT_COLORS[data.verdict] || "#6B7280";
    var signals = data.signals || [];
    var sources = data.sources || [];
    var cachedLabel = data.cached ? " (cached)" : "";

    var html = "";

    // Score section
    html += "<div class=\"score-section\">";
    html += "  <span class=\"verdict-badge\" style=\"background:" + color + "\">" + data.verdict + "</span>";
    html += "  <div class=\"score-number\" style=\"color:" + color + "\">" + data.score + "<span class=\"score-sub\">/100</span></div>";
    if (data.symbol) {
      html += "  <div class=\"token-name\">" + (data.name || data.symbol) + " (" + data.symbol + ")" + cachedLabel + "</div>";
    } else {
      html += "  <div class=\"token-name\">" + truncateMint(data.mint) + cachedLabel + "</div>";
    }
    html += "</div>";

    // Signals
    if (signals.length > 0) {
      html += "<div class=\"signals\">";
      html += "  <div class=\"section-label\">Risk signals (" + signals.length + ")</div>";
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        var sColor = SEVERITY_COLORS[s.severity] || "#666";
        html += "<div class=\"signal-row\">";
        html += "  <span class=\"signal-dot\" style=\"background:" + sColor + "\"></span>";
        html += "  <span>" + s.label + "</span>";
        html += "  <span class=\"signal-sev\" style=\"color:" + sColor + "\">" + s.severity + "</span>";
        html += "</div>";
      }
      html += "</div>";
    }

    // Sources
    if (sources.length > 0) {
      html += "<div class=\"sources\">";
      html += "  <div class=\"section-label\">Sources</div>";
      html += "  <div class=\"source-tags\">";
      for (var j = 0; j < sources.length; j++) {
        html += "<span class=\"source-tag\">" + sources[j] + "</span>";
      }
      html += "  </div>";
      html += "</div>";
    }

    // Casefile link (if symbol exists, there might be a casefile)
    html += "<a class=\"casefile-link\" href=\"https://app.interligens.com/scan\" target=\"_blank\" rel=\"noopener noreferrer\">View full investigation &rarr;</a>";

    contentEl.innerHTML = html;
  }

  function truncateMint(mint) {
    if (!mint || mint.length < 12) return mint || "";
    return mint.slice(0, 6) + "..." + mint.slice(-4);
  }

  // ── Extract mint from active tab URL ───────────────────────────────────────

  var DEX_PATTERNS = [
    { re: /pump\.fun\/coin\/([A-Za-z0-9]{32,44})/, idx: 1 },
    { re: /jup\.ag\/swap\/.+-([A-Za-z0-9]{32,44})/, idx: 1 },
    { re: /birdeye\.so\/token\/([A-Za-z0-9]{32,44})/, idx: 1 },
    { re: /dexscreener\.com\/solana\/([A-Za-z0-9]{32,44})/, idx: 1 }
  ];

  function extractMintFromUrl(url) {
    for (var i = 0; i < DEX_PATTERNS.length; i++) {
      var m = url.match(DEX_PATTERNS[i].re);
      if (m) return m[DEX_PATTERNS[i].idx];
    }
    // Raydium: query params
    if (url.indexOf("raydium.io") !== -1) {
      var parts = url.split("?");
      if (parts.length > 1) {
        var params = new URLSearchParams(parts[1]);
        return params.get("inputMint") || params.get("outputMint") || null;
      }
    }
    return null;
  }

  // ── Score a mint ───────────────────────────────────────────────────────────

  function scoreMint(mint) {
    scanBtn.disabled = true;
    scanBtn.textContent = "SCANNING...";
    errorMsg.style.display = "none";
    emptyState.textContent = "Scanning...";

    chrome.runtime.sendMessage(
      { type: "SCORE_TOKEN", mint: mint },
      function (response) {
        scanBtn.disabled = false;
        scanBtn.textContent = "SCAN";

        if (chrome.runtime.lastError) {
          showError("Extension error: " + chrome.runtime.lastError.message);
          return;
        }

        if (!response || !response.success) {
          showError((response && response.error) || "Score unavailable");
          return;
        }

        renderScore(response.data);
      }
    );
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = "block";
    emptyState.textContent = "No score available";
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  // Try to get score from active tab
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs || !tabs[0] || !tabs[0].url) {
      emptyState.textContent = "Navigate to a DEX to auto-scan";
      return;
    }

    var mint = extractMintFromUrl(tabs[0].url);
    if (mint) {
      manualInput.value = mint;
      scoreMint(mint);
    } else {
      emptyState.textContent = "No Solana token detected on this page";
    }
  });

  // Manual scan
  scanBtn.addEventListener("click", function () {
    var mint = manualInput.value.trim();
    if (!mint) return;
    scoreMint(mint);
  });

  manualInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var mint = manualInput.value.trim();
      if (mint) scoreMint(mint);
    }
  });
})();
