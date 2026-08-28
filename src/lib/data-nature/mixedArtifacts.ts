// ─── S6-4 — le corpus des artefacts à affirmations mixtes, NOMMÉ ───────────
//
//        ROW-LEVEL MODEL INSUFFICIENT FOR MIXED-ASSERTION ARTIFACT
//
// Jusqu'ici cette liste n'existait que dans un README et le commentaire d'un
// .sql. « 34 » était un nombre, pas un corpus : un test qui aurait vérifié
// `count === 34` serait resté vert si on avait classé les 34 et ingéré 34
// autres. Ce fichier nomme les pièces, une par une.
//
// TRANSITOIRE par construction. Ces artefacts portent des affirmations de
// natures hétérogènes (INFERENCE calculée, ESTIMATE chiffrée, EDITORIAL_ASSERTION
// rédigée) qu'une colonne unique ne peut pas décrire. Ils sortiront d'ici quand
// un porteur au niveau assertion existera — chantier EvidenceItemAssertion,
// délibérément PAS ouvert aujourd'hui.
//
// S'y ajoute une règle qu'aucune colonne ne porte : un rapport généré par
// INTERLIGENS n'est JAMAIS preuve primaire de ses propres conclusions. Elle ne
// tenait que par le fait que ces lignes restaient non classées — une garantie
// par omission. assertNatureWritable en fait une garantie par refus.

export interface MixedAssertionArtifact {
  readonly id: string;
  readonly sha256: string;
  /** Clé R2 ou chemin d'origine — ce qui identifie la pièce pour un humain. */
  readonly ref: string;
}

/** Mesuré sur ep-square-band le 2026-08-29, en lecture seule. */
export const MIXED_ASSERTION_ARTIFACTS: readonly MixedAssertionArtifact[] = [
  { id: "evi_rep_bd69380a45529aebeba7bc52", sha256: "0467e0c8ae5597b7b9cfca6afe5d0216097747c0415492cf03356006a2f3b06f", ref: "reports/GordonGekko/CASE_GordonGekko_2026-07-20T04-38-57.pdf" },
  { id: "evi_rep_8c4183839506284476fd9be6", sha256: "7d144a52d803ae516657dab7dc980a2e5d776c9a2cc83f3512ba188a60e0722e", ref: "reports/GordonGekko/CASE_GordonGekko_2026-07-21T04-38-57.pdf" },
  { id: "evi_rep_db8903e7d04d67bbaeb13e5c", sha256: "597878d27d22ae63528f13439fe17bc51766a653171ac1b4fc5bab10be890eea", ref: "reports/GordonGekko/CASE_GordonGekko_2026-07-22T04-38-56.pdf" },
  { id: "evi_rep_4a9020d9fb351c09a48b4ec7", sha256: "ee39e120bea52c77a51c695a1f7dcf915ff9e9a26d9816002927ebb9d376ff6a", ref: "reports/GordonGekko/CASE_GordonGekko_2026-07-23T04-39-00.pdf" },
  { id: "evi_rep_dfce826c85edf4abe8d6819a", sha256: "e537f4b8780fc40492addaf17e61b29e62a71b3485c953a546d746c414def45f", ref: "reports/GordonGekko/CASE_GordonGekko_2026-07-24T04-38-56.pdf" },
  { id: "evi_rep_ffec12ea6f67b8b0b2e32189", sha256: "3fec02b25c4b842eb48fce63b4c640d3b37c40eed5bc2663ab6718eb860d00a8", ref: "reports/GordonGekko/CASE_GordonGekko_2026-07-25T04-38-57.pdf" },
  { id: "evi_rep_ea70992eeb591480a1550ec0", sha256: "a8c1359a721a3af5ce528782a7d68dcac3a6453863fe029070c7960f34a8342c", ref: "reports/GordonGekko/CASE_GordonGekko_2026-07-26T04-38-56.pdf" },
  { id: "evi_rep_d0f885cf12a4dbed39e158fa", sha256: "044d6a374bfaccffefa1402ccf027c068ab2853d7a3ff80d1baa9c467e4e772a", ref: "reports/GordonGekko/CASE_GordonGekko_2026-07-27T04-38-57.pdf" },
  { id: "evi_rep_dd624a8211dfc507b115397f", sha256: "26ae8764825c05e0caacca7f5f69c2bf60ce7b55c19ecdefffad0b916b9fcea7", ref: "reports/GordonGekko/CASE_GordonGekko_2026-07-28T04-38-56.pdf" },
  { id: "evi_rep_67a0c365c01c5e7145ef0d69", sha256: "9bccbc6c8951db2c906d4cd8ccc40db6dc9ecc7fc52263b730d23b389c984698", ref: "reports/GordonGekko/CASE_GordonGekko_2026-07-29T04-38-57.pdf" },
  { id: "evi_rep_2871a9bbab2d5e2523520921", sha256: "3dd0368ddfa6b8b0a974b6e76f4246c667305d08e37fc72e5a507b2316d4641e", ref: "reports/GordonGekko/CASE_GordonGekko_2026-07-30T04-47-10.pdf" },
  { id: "evi_rep_36f6fdeec224377ce9e37ebc", sha256: "c1450a0eb208e1b778559271e0e681de8329ba4e2fe67fd0d627fa36dc5c93d2", ref: "reports/GordonGekko/CASE_GordonGekko_2026-07-31T04-47-11.pdf" },
  { id: "evi_rep_074408cdee7e11251b8f3fc7", sha256: "fa5a85733cab3774d5696091eebd8f0f752c2d73883542fc78fd25ad8f0f468c", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-01T04-47-08.pdf" },
  { id: "evi_rep_fdf88984a506f06d0c8b2272", sha256: "466f7ec524a29c51ea46ab5fe0c206268368cdff173e68fe637cc81a81109ca0", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-02T04-47-08.pdf" },
  { id: "evi_rep_78d32fc700067ee7aa05c4e8", sha256: "aa07b8636aaeb0cc78485ba89d161716f6bd76b6272f42ba3bd4fa4e5bf9e7a1", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-03T04-47-07.pdf" },
  { id: "evi_rep_c0db0f791bad071d97c67d05", sha256: "9603c450f4e92ae3efc2070720c6a0102bd18a2718388c6e9eda89acae55b1e0", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-04T04-47-09.pdf" },
  { id: "evi_rep_628a4612997a097729ffc4c1", sha256: "4982b347dff3cf4be845892d69afcc5e4ed1f2eefacdcfa6d36bc09329313639", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-05T04-47-10.pdf" },
  { id: "evi_rep_64fed1d1c32dae0817d93957", sha256: "a40e74bf38b7b3df537da18b30f0ebca5f3cea17653d21300b46d09cca4db824", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-06T04-47-12.pdf" },
  { id: "evi_rep_745cce2d03a422fbc5df1321", sha256: "3b808dc816c1d0932548a67eb87be39df40fdcd8307c5f8ba75035360c7d0378", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-07T04-47-11.pdf" },
  { id: "evi_rep_8fd00fd52243bc15e2f6bd1a", sha256: "3744a82e667d19811cd45752fc79ace94375dd5dd3239a18f9f02256b188fccf", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-08T04-47-11.pdf" },
  { id: "evi_rep_a6d52194580af683f70d9e2f", sha256: "4986ee19c23de5e6b51484667edfd5125d05419a249447ef1e29f14b6adfb6d3", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-09T04-47-12.pdf" },
  { id: "evi_rep_1bb457669d0a68927f135342", sha256: "a6647a46707ad238a98be8403a7129473596c5a340f9831f2660ef358ab48904", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-10T04-47-10.pdf" },
  { id: "evi_rep_6c6e77a50ee7df33399ebaf8", sha256: "80b267b97d4ae4b634072a1ef1c9024e4519481e100cafe22557aab438c7fe08", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-11T04-47-11.pdf" },
  { id: "evi_rep_a59d67786963d7810e82485d", sha256: "d01aa3e5396f7b5c122f2dc1129a9418a0893499e867428c74529f0f63aec486", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-12T04-47-10.pdf" },
  { id: "evi_rep_669649c1dddcde26860cb02f", sha256: "362c756e1ee8288362c58b88f58f7e65efaead309afd391035b9fbe508fa017e", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-13T04-47-12.pdf" },
  { id: "evi_rep_e1396c4caf3d037ca3286420", sha256: "54141794c37fa2b229a7fcb996732ecbcd4493974f733d1bc1a03f16fc839214", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-14T04-47-12.pdf" },
  { id: "evi_rep_4bcbee4a1d170a067bd3d03a", sha256: "fb15de362388a62916bad530e16a6ba5da4ab9676ce804fb8837204a42b3c5c7", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-15T04-29-13.pdf" },
  { id: "evi_rep_6ffc5f5af8ba17acf5e69d1f", sha256: "b5598a394948450d6c18ceb287737d0864395427c8d2d50b900e3b53a0a928cf", ref: "reports/GordonGekko/CASE_GordonGekko_2026-08-16T04-22-56.pdf" },
  { id: "evi_rep_615f749a1d56e9abf5fc2b07", sha256: "7829a0be7f295c8122e8ed3de6dda56f99f10b9e611951c3fd2a89e8bb14b90d", ref: "reports/deployer_pool/CASE_deployer_pool_2026-07-30T04-49-57.pdf" },
  { id: "evi_rep_a3bc2b4a02ea4efd231e2b3d", sha256: "281816da1b7978c62fb7906e0a57963ca7f3c4f2d895d2cfe96bc4174e3fd9d6", ref: "reports/deployer_pool/CASE_deployer_pool_2026-07-31T04-50-05.pdf" },
  { id: "evi_rep_659bd95089cb927c37e25fed", sha256: "ee5e2a4d591978c9a16180444ae1c1af1eed5718d1a1bfef4f760cc6db1072e9", ref: "reports/deployer_pool/CASE_deployer_pool_2026-08-12T04-49-46.pdf" },
  { id: "evi_rep_4c21b0afe21112a9cb7cffd6", sha256: "71bef305d762edb57dbb2cc8c78d3ce7489dbb8c2360080c7fa4a760930effca", ref: "reports/deployer_pool/CASE_deployer_pool_2026-08-13T04-49-47.pdf" },
  { id: "cms7mdvaj00uas787vfwlm2sy", sha256: "1608ed3e9770d328774dc7629f25c009e4cada06234655e390dceb9b46792280", ref: "evidence/16/1608ed3e9770d328774dc7629f25c009e4cada06234655e390dceb9b46792280.json" },
  { id: "cms7mdurq00u5s78769o3ozxv", sha256: "9cc752c6584d8c2e1dbc2863e9ec7414a2e5db9a781f8e866716c48fa83d2407", ref: "evidence/9c/9cc752c6584d8c2e1dbc2863e9ec7414a2e5db9a781f8e866716c48fa83d2407.json" }
] as const;

const BY_ID = new Set(MIXED_ASSERTION_ARTIFACTS.map((a) => a.id));
const BY_SHA = new Set(MIXED_ASSERTION_ARTIFACTS.map((a) => a.sha256));

/**
 * Une pièce du corpus mixte se reconnaît par son id OU son sha256 — le sha256
 * étant l'identité de la preuve, une pièce déplacée reste reconnue.
 */
export function isMixedAssertionArtifact(row: {
  id?: string | null;
  sha256?: string | null;
}): boolean {
  if (row.id && BY_ID.has(row.id)) return true;
  if (row.sha256 && BY_SHA.has(row.sha256)) return true;
  return false;
}

export const MIXED_ASSERTION_REASON = "MIXED_ASSERTION_ARTIFACT" as const;
export const MIXED_ASSERTION_DETAIL = "ROW_LEVEL_MODEL_INSUFFICIENT" as const;
