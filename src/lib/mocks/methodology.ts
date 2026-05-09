/**
 * /methodology — producer-side discipline page.
 *
 * Voice: "we publish", "we record", "the bucket label". Describes how
 * INTERLIGENS establishes claims, scores, and dossiers. Strictly
 * disjoint from /charter, which is reader-side ("you should read").
 *
 * Content is static and editorial, kept here so the page renders
 * without a backend. When the methodology becomes versioned, this
 * file is the single source of truth.
 */

import type { ClassificationContext } from "@/lib/contracts/website";
import { MOCK_CLASSIFICATION } from "@/lib/mocks/_context";

export type MethodologySection = {
  id: string;
  kicker: string;
  title: string;
  body: string;
};

export type MethodologyPillar = {
  label: string;
  title: string;
  body: string;
};

export const METHODOLOGY_CLASSIFICATION: ClassificationContext = MOCK_CLASSIFICATION;

export const METHODOLOGY_HERO = {
  kicker: "DISCIPLINE · METHODOLOGY",
  title: "How we build a claim.",
  dek: "INTERLIGENS publishes intelligence dossiers under a documented standard — Forensic Editorial v2. This page describes how a claim, a score, or a signal becomes part of the public record.",
};

export const METHODOLOGY_SECTIONS: MethodologySection[] = [
  {
    id: "standard",
    kicker: "01 · STANDARD",
    title: "Forensic Editorial v2.",
    body: "Every published claim pairs with an independently retrievable source. Confidence is scored per bucket, not per narrative. Severity comes from corroboration, not framing.\nThe standard is the contract: a reader should be able to rebuild any claim we publish from public sources alone.",
  },
  {
    id: "tigerscore",
    kicker: "02 · TIGERSCORE",
    title: "What a score actually says.",
    body: "TigerScore is a composite reading of on-chain behaviour, off-chain credibility, cluster proximity, and sanction exposure.\nIt is not a verdict. A score above 70 says: this entity has the behavioural signature of a coordinated extraction. It does not say a court has ruled. It does not say funds were stolen. It says the trail looks like it.",
  },
  {
    id: "open-evidence",
    kicker: "03 · OPEN EVIDENCE",
    title: "Three buckets, one trail.",
    body: "Every signal lands in one of three buckets — verified, corroborated, observed.\nVerified means we can hash it: an on-chain transaction, a signed message, a notarised capture. Corroborated means two independent sources agree. Observed means we logged a pattern but cannot prove its origin.\nThe label is in the artifact. We never silently mix tiers.",
  },
  {
    id: "observed-proceeds",
    kicker: "04 · OBSERVED PROCEEDS",
    title: "Money you can see, not money we name.",
    body: "Observed Proceeds is an analytical estimate — the volume that traversed wallets we attribute to a cluster, during a window we define.\nIt is not an indictment of the volume. It is not a damages claim. It is the perimeter of the trail, computed and stamped, so a third party can rebuild it from the same chain.",
  },
  {
    id: "constellation",
    kicker: "05 · CONSTELLATION",
    title: "The graph is the proof.",
    body: "Constellation maps the network around an entity — counterparties, peel chains, bridges, exits.\nEdges carry the kind of relation: transaction, money flow, suspicious, KOL relation. Nodes carry their role. The constellation is not decoration; it is the topology a reader walks to understand the case.",
  },
  {
    id: "casefile",
    kicker: "06 · CASEFILE",
    title: "What a casefile contains.",
    body: "A casefile under v2 ships with: a dossier hero, a flow stages timeline, a filing panel with hashes, an evidence rail, an annex grid, and the editorial standard footer.\nEvery figure appears with a hashref. Every claim links a bucket. The casefile is the artifact a court could read.",
  },
  {
    id: "publication",
    kicker: "07 · PUBLICATION",
    title: "What we publish, what we hold.",
    body: "We publish entities with sufficient bucket coverage. We hold entities still under verification.\nWe never publish a person under PERSON-type until the takedown window has run. We never publish identity claims when only a single source supports them. Publication is not a guess; it is a threshold.",
  },
  {
    id: "limitations",
    kicker: "08 · LIMITATIONS",
    title: "Where the method ends.",
    body: "We do not establish criminal liability. We do not certify damages. We do not name accomplices on circumstantial proximity alone.\nWe do not publish living individuals under medical, legal, or family categories. We do not run reverse anonymization on retail wallets.\nThe line is documented; the line is held.",
  },
];

export const METHODOLOGY_PILLARS: MethodologyPillar[] = [
  {
    label: "01 · REPRODUCIBILITY",
    title: "Hash, retrieve, rebuild.",
    body: "Every claim ships with a hashref. The capture, the on-chain tx, the third-party oracle response — all retrievable and stamped. A reader can rebuild the trail from public sources alone.",
  },
  {
    label: "02 · ANALYTICAL VS VERIFIED",
    title: "We label which is which.",
    body: "Analytical estimates carry an explicit ANALYTICAL · ESTIMATE marker. Verified facts carry a hash. Reading the wrong tier is the most expensive mistake; we make sure you cannot make it accidentally.",
  },
  {
    label: "03 · BOUNDARIES",
    title: "The method is the limit.",
    body: "INTERLIGENS does not litigate, indict, or advise. We document trails that are independently re-walkable. The reader does the rest.",
  },
];
