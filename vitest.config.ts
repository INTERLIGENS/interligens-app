import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    exclude: ["**/node_modules/**", "**/.claude/worktrees/**"],
    // Sels cryptographiques de la suite. requireSalt() lève quand la variable
    // est absente ou vide, et il le fait SANS exception NODE_ENV : le code de
    // production ne connaît pas la notion d'« environnement de test ». La suite
    // pose donc ses sels ici, exactement comme la Production les pose dans
    // Vercel — une seule règle, partout.
    //
    // Valeurs volontairement inertes et étiquetées « test » : elles ne doivent
    // jamais coïncider avec un sel réel, sinon un hash calculé en test
    // deviendrait comparable à un hash de production.
    //
    // ADMIN_TOKEN n'est PAS posé ici : plusieurs tests vérifient justement le
    // fail-closed quand il manque, et le poser globalement les rendrait verts
    // pour la mauvaise raison.
    env: {
      VAULT_AUDIT_SALT: "test-vault-audit-salt-not-a-real-secret",
      IP_HASH_SALT: "test-ip-hash-salt-not-a-real-secret",
    },
  },
});
