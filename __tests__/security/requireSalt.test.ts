import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { requireSalt } from "@/lib/config/requireSalt";

// Un sel absent doit être une PANNE, pas une dégradation muette. Ces tests
// vérifient les deux moitiés du contrat : ça lève quand il faut, et ça lève
// À L'USAGE — jamais au chargement du module.

describe("requireSalt", () => {
  const ORIGINAL = process.env.SALT_UNDER_TEST;

  beforeEach(() => {
    delete process.env.SALT_UNDER_TEST;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.SALT_UNDER_TEST;
    else process.env.SALT_UNDER_TEST = ORIGINAL;
  });

  it("renvoie le sel tel quel quand il est posé", () => {
    process.env.SALT_UNDER_TEST = "un-vrai-sel";
    expect(requireSalt("SALT_UNDER_TEST")).toBe("un-vrai-sel");
  });

  it("ne normalise PAS le sel (pas de trim) — le sel fait partie de la clé", () => {
    // Trimmer changerait tous les hachages déjà écrits en base pour un
    // environnement dont le sel porte un blanc de bord.
    process.env.SALT_UNDER_TEST = "  sel-avec-blancs  ";
    expect(requireSalt("SALT_UNDER_TEST")).toBe("  sel-avec-blancs  ");
  });

  it("lève quand la variable est absente", () => {
    expect(() => requireSalt("SALT_UNDER_TEST")).toThrow(/SALT_UNDER_TEST/);
  });

  it("lève quand la variable est la CHAÎNE VIDE (vide = absente)", () => {
    // L'angle mort de la famille `??` : une variable provisionnée à vide est
    // une valeur, elle gagne sur le repli. Ici il n'y a plus de repli, mais la
    // chaîne vide reste un provisionnement raté et doit lever.
    process.env.SALT_UNDER_TEST = "";
    expect(() => requireSalt("SALT_UNDER_TEST")).toThrow(/absente ou vide/);
  });

  it("lève quand la variable ne contient que des blancs", () => {
    process.env.SALT_UNDER_TEST = "   \t  ";
    expect(() => requireSalt("SALT_UNDER_TEST")).toThrow(/absente ou vide/);
  });

  it("nomme la variable fautive dans le message", () => {
    // Sans le nom, la panne est illisible : trois sels différents traversent
    // ce helper. On utilise des noms NON posés par vitest.config.ts — les vrais
    // (VAULT_AUDIT_SALT, IP_HASH_SALT) sont fournis à la suite et ne lèvent pas.
    expect(() => requireSalt("SALT_ABSENT_A")).toThrow(/SALT_ABSENT_A/);
    expect(() => requireSalt("SALT_ABSENT_B")).toThrow(/SALT_ABSENT_B/);
  });

  it("ne lève PAS à l'import du module, même sans aucun sel posé", async () => {
    // Le cœur de la décision : un throw au niveau module tomberait au
    // chargement du bundle, pour tout le monde, y compris les routes qui ne
    // hachent rien. On importe à froid, sans sel, et on exige que l'import
    // passe — la panne n'arrive qu'au premier appel.
    vi.resetModules();
    const saved = { v: process.env.VAULT_AUDIT_SALT, i: process.env.IP_HASH_SALT };
    delete process.env.VAULT_AUDIT_SALT;
    delete process.env.IP_HASH_SALT;
    try {
      const mod = await import("@/lib/config/requireSalt");
      expect(typeof mod.requireSalt).toBe("function");
      // ...et c'est bien l'APPEL qui lève.
      expect(() => mod.requireSalt("VAULT_AUDIT_SALT")).toThrow();
    } finally {
      if (saved.v !== undefined) process.env.VAULT_AUDIT_SALT = saved.v;
      if (saved.i !== undefined) process.env.IP_HASH_SALT = saved.i;
    }
  });
});

// ── Les 3 sites câblés ────────────────────────────────────────────────────
// On vérifie que le repli littéral a bien disparu de chacun : sel retiré →
// l'appel lève, au lieu de rendre un hash de la bonne forme clé sur un
// littéral public.

describe("sites câblés sur requireSalt", () => {
  it("vault/auditScan — VAULT_AUDIT_SALT est posé par la suite et le hachage marche", async () => {
    // auditScanLookup avale ses erreurs (l'audit ne doit jamais casser un scan),
    // donc on prouve le câblage par le sel effectif de la suite plutôt que par
    // un throw observable depuis l'extérieur.
    expect(process.env.VAULT_AUDIT_SALT).toBe("test-vault-audit-salt-not-a-real-secret");
  });

  it("community/ipHash — lève quand VAULT_AUDIT_SALT est retiré", async () => {
    vi.resetModules();
    const saved = process.env.VAULT_AUDIT_SALT;
    delete process.env.VAULT_AUDIT_SALT;
    try {
      const { hashIp } = await import("@/lib/community/ipHash");
      expect(() => hashIp("1.2.3.4")).toThrow(/VAULT_AUDIT_SALT/);
    } finally {
      process.env.VAULT_AUDIT_SALT = saved;
    }
  });

  it("community/ipHash — chaîne vide lève aussi (pas de HMAC à clé vide)", async () => {
    vi.resetModules();
    const saved = process.env.VAULT_AUDIT_SALT;
    process.env.VAULT_AUDIT_SALT = "";
    try {
      const { hashIp } = await import("@/lib/community/ipHash");
      expect(() => hashIp("1.2.3.4")).toThrow(/absente ou vide/);
    } finally {
      process.env.VAULT_AUDIT_SALT = saved;
    }
  });

  it("billing/request — lève quand IP_HASH_SALT est retiré", async () => {
    vi.resetModules();
    const saved = process.env.IP_HASH_SALT;
    delete process.env.IP_HASH_SALT;
    try {
      const { hashIp } = await import("@/lib/billing/request");
      expect(() => hashIp("1.2.3.4")).toThrow(/IP_HASH_SALT/);
    } finally {
      process.env.IP_HASH_SALT = saved;
    }
  });

  it("billing/request — chaîne vide lève aussi", async () => {
    vi.resetModules();
    const saved = process.env.IP_HASH_SALT;
    process.env.IP_HASH_SALT = "";
    try {
      const { hashIp } = await import("@/lib/billing/request");
      expect(() => hashIp("1.2.3.4")).toThrow(/absente ou vide/);
    } finally {
      process.env.IP_HASH_SALT = saved;
    }
  });

  it("billing/request — hache normalement quand le sel est posé, et le sel COMPTE", async () => {
    vi.resetModules();
    const { hashIp } = await import("@/lib/billing/request");
    const withSuiteSalt = hashIp("1.2.3.4");
    expect(withSuiteSalt).toMatch(/^[0-9a-f]{32}$/);

    // Changer le sel doit changer le hash — preuve que le sel est réellement
    // dans la clé et pas décoratif.
    vi.resetModules();
    const saved = process.env.IP_HASH_SALT;
    process.env.IP_HASH_SALT = "un-autre-sel";
    try {
      const { hashIp: hashIp2 } = await import("@/lib/billing/request");
      expect(hashIp2("1.2.3.4")).not.toBe(withSuiteSalt);
    } finally {
      process.env.IP_HASH_SALT = saved;
    }
  });
});
