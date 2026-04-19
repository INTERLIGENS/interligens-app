/**
 * Quick-reply templates used by the founder in /admin/inbox.
 *
 * Keep the list short — 4 templates × 1 keyboard slot (Ctrl/⌘+1..4).
 * If you add a template, reserve a new slot and update both this file and
 * the client shortcut handler.
 */

export type FounderTemplateKey = "ack" | "source" | "correction" | "resolved";

export type FounderTemplate = {
  key: FounderTemplateKey;
  shortcut: number;              // 1..4 — matches Ctrl/⌘+<digit>
  label: string;                 // short UI label
  body: string;                  // full message text inserted into the compose box
  overrideStatus?: "resolved";   // if set, the POST forces this thread status
};

export const FOUNDER_TEMPLATES: FounderTemplate[] = [
  {
    key: "ack",
    shortcut: 1,
    label: "Accusé de réception",
    body: "Merci pour le signalement, investigation en cours.",
  },
  {
    key: "source",
    shortcut: 2,
    label: "Demande de source",
    body: "Pouvez-vous fournir la source de cette information ?",
  },
  {
    key: "correction",
    shortcut: 3,
    label: "Correction apportée",
    body: "Correction apportée, merci pour le retour.",
  },
  {
    key: "resolved",
    shortcut: 4,
    label: "Résolution",
    body: "Thread résolu, dossier mis à jour.",
    overrideStatus: "resolved",
  },
];

export function getTemplateByShortcut(digit: number): FounderTemplate | undefined {
  return FOUNDER_TEMPLATES.find((t) => t.shortcut === digit);
}
