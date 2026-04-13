"use client";

import { useEffect, useRef } from "react";

type Props = {
  entity: { type: string; value: string };
  onClose: () => void;
};

type Section = {
  title: string;
  links: { label: string; url: string }[];
};

function detectChain(address: string): "EVM" | "SOL" | "BTC" | "UNKNOWN" {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return "EVM";
  if (address.startsWith("bc1") || /^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,39}$/.test(address)) {
    return "BTC";
  }
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return "SOL";
  return "UNKNOWN";
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

function stripHandle(value: string): string {
  return value.replace(/^@+/, "").trim();
}

function buildSections(entity: { type: string; value: string }): Section[] {
  const { type, value } = entity;
  const sections: Section[] = [];

  if (type === "WALLET") {
    const chain = detectChain(value);
    if (chain === "EVM") {
      sections.push({
        title: "On-chain",
        links: [
          { label: "Etherscan", url: `https://etherscan.io/address/${value}` },
          { label: "Arbiscan", url: `https://arbiscan.io/address/${value}` },
          { label: "Basescan", url: `https://basescan.org/address/${value}` },
          { label: "DeBank", url: `https://debank.com/profile/${value}` },
          {
            label: "Arkham",
            url: `https://platform.arkhamintelligence.com/explorer/address/${value}`,
          },
          {
            label: "Breadcrumbs",
            url: `https://www.breadcrumbs.app/reports/${value}`,
          },
        ],
      });
    } else if (chain === "SOL") {
      sections.push({
        title: "On-chain",
        links: [
          { label: "Solscan", url: `https://solscan.io/account/${value}` },
          { label: "SolanaFM", url: `https://solana.fm/address/${value}` },
          { label: "Birdeye", url: `https://birdeye.so/profile/${value}` },
        ],
      });
    } else if (chain === "BTC") {
      sections.push({
        title: "On-chain",
        links: [
          {
            label: "Blockchain.com",
            url: `https://www.blockchain.com/explorer/addresses/btc/${value}`,
          },
          {
            label: "Blockchair",
            url: `https://blockchair.com/bitcoin/address/${value}`,
          },
        ],
      });
    }
    sections.push({
      title: "OSINT",
      links: [{ label: "IntelX", url: `https://intelx.io/?s=${encode(value)}` }],
    });
  } else if (type === "TX_HASH") {
    sections.push({
      title: "On-chain",
      links: [
        { label: "Etherscan TX", url: `https://etherscan.io/tx/${value}` },
        { label: "Solscan TX", url: `https://solscan.io/tx/${value}` },
        { label: "Socketscan", url: `https://socketscan.io/tx/${value}` },
        {
          label: "Range",
          url: `https://app.range.org/transactions?search=${encode(value)}`,
        },
      ],
    });
  } else if (type === "HANDLE") {
    const h = stripHandle(value);
    sections.push({
      title: "Identity",
      links: [
        { label: "Twitter/X", url: `https://twitter.com/${h}` },
        { label: "Telegram", url: `https://t.me/${h}` },
        { label: "Mugetsu", url: `https://mugetsu.io/search?q=${encode(h)}` },
        {
          label: "TelegramDB",
          url: `https://telegramdb.org/search?q=${encode(h)}`,
        },
      ],
    });
  } else if (type === "URL" || type === "DOMAIN") {
    sections.push({
      title: "Archive",
      links: [
        {
          label: "Wayback Machine",
          url: `https://web.archive.org/web/*/${value}`,
        },
        { label: "Archive.today", url: `https://archive.ph/${value}` },
        {
          label: "URLscan",
          url: `https://urlscan.io/search/#page.domain:${encode(value)}`,
        },
        {
          label: "VirusTotal",
          url: `https://www.virustotal.com/gui/domain/${encode(value)}`,
        },
      ],
    });
  } else if (type === "EMAIL") {
    sections.push({
      title: "OSINT",
      links: [{ label: "IntelX", url: `https://intelx.io/?s=${encode(value)}` }],
    });
  } else if (type === "CONTRACT") {
    sections.push({
      title: "On-chain",
      links: [
        {
          label: "Etherscan contract",
          url: `https://etherscan.io/address/${value}#code`,
        },
        {
          label: "GoPlus",
          url: `https://gopluslabs.io/token-security/1/${value}`,
        },
      ],
    });
  }

  sections.push({
    title: "Universal",
    links: [
      { label: "IntelX", url: `https://intelx.io/?s=${encode(value)}` },
      {
        label: "Google",
        url: `https://www.google.com/search?q=${encode(value + " crypto scam")}`,
      },
    ],
  });

  return sections;
}

export default function EntityLaunchpad({ entity, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const sections = buildSections(entity);

  function openAll() {
    for (const section of sections) {
      for (const link of section.links) {
        window.open(link.url, "_blank", "noopener,noreferrer");
      }
    }
  }

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-2"
      style={{
        backgroundColor: "#0a0a0a",
        border: "1px solid rgba(255,107,0,0.2)",
        borderRadius: 8,
        padding: 16,
        width: 320,
      }}
    >
      {sections.map((section) => (
        <div key={section.title} style={{ marginBottom: 14 }}>
          <div
            style={{
              textTransform: "uppercase",
              fontSize: 10,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.3)",
              marginBottom: 6,
            }}
          >
            {section.title}
          </div>
          <div className="flex flex-col gap-1">
            {section.links.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-[#FF6B00]"
                style={{ fontSize: 13 }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={openAll}
        className="text-[#FF6B00]"
        style={{
          fontSize: 12,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        Open all surfaces →
      </button>
    </div>
  );
}
