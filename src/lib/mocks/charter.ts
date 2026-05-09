/**
 * /charter — reader-side discipline page.
 *
 * Voice: "you should read", "the reader", "before you act". Strictly
 * disjoint from /methodology, which is producer-side ("we publish").
 * Methodology defines how INTERLIGENS builds a claim; charter defines
 * how a retail reader is expected to interpret one.
 */

export type CharterSection = {
  id: string;
  kicker: string;
  title: string;
  body: string;
};

export type CharterPillar = {
  label: string;
  title: string;
  body: string;
};

export const CHARTER_HERO = {
  kicker: "DISCIPLINE · CHARTER",
  title: "How to read what we publish.",
  dek: "This page is for the reader. It explains how to use a TigerScore, a constellation, or a published casefile to make a decision — and what these artifacts are not designed to tell you.",
};

export const CHARTER_SECTIONS: CharterSection[] = [
  {
    id: "reading-a-score",
    kicker: "01 · READING A SCORE",
    title: "What a number gives you.",
    body: "A TigerScore is a starting reading, not an ending one.\nNumbers above 70 are a stop signal, not a verdict — they say the entity has the behavioural signature of coordinated extraction. Numbers below 30 are an attention signal, not a green light — they say the trail did not surface aggression on the windows we measured.\nRead the score, then read the evidence.",
  },
  {
    id: "reading-the-buckets",
    kicker: "02 · READING THE BUCKETS",
    title: "Verified, corroborated, observed.",
    body: "When you read a casefile, the bucket label tells you what the claim is worth.\nVerified is hash-recoverable; you can rebuild it from the chain. Corroborated has two independent sources; you can choose to trust the cross-check. Observed is a logged pattern; you should treat it as a hypothesis, not a fact.\nWhen you see a single bucket, that is the strength of the claim — no more, no less.",
  },
  {
    id: "reading-a-constellation",
    kicker: "03 · READING A CONSTELLATION",
    title: "What the graph teaches you.",
    body: "Edges show the kind of relation, not the strength of involvement.\nA wallet sitting two hops from a deployer is not a co-deployer. A counterparty receiving a single transfer is not an accomplice. Read the constellation as a topology, not as a guilt list.\nThe casefile names which actors carry which role; the graph shows you why.",
  },
  {
    id: "cleared-cases",
    kicker: "04 · WHY CLEARED CASES ARE PUBLISHED",
    title: "The negative is part of the work.",
    body: "We publish cleared dossiers for two reasons.\nFirst, the absence of a flag is itself information — a frequently scrutinised entity that surfaces no aggression on multiple windows is more credible than an unscanned one.\nSecond, clearing publicly is the only way to be honest about the asymmetry; we cannot publish only the bad cases without inflating the apparent prevalence of fraud.",
  },
  {
    id: "before-you-act",
    kicker: "05 · BEFORE YOU ACT ON A SCAN",
    title: "What the platform cannot do for you.",
    body: "INTERLIGENS does not give investment advice, custody guidance, or legal direction.\nThe platform documents trails. The reader is expected to bring the rest: a position thesis, a risk tolerance, a regulatory context, a personal sense of what is acceptable.\nThe reading is yours; the action is yours.",
  },
  {
    id: "when-to-escalate",
    kicker: "06 · WHEN TO ESCALATE",
    title: "Beyond INTERLIGENS.",
    body: "When a casefile names a counterparty you have direct exposure to, escalate to your own counsel or compliance team.\nWhen you suspect a casefile has missed material context, file under the takedown channel.\nWhen you want a deeper, longer investigation, contact the editorial team directly.\nThe platform is a starting point; serious decisions belong elsewhere.",
  },
  {
    id: "respect",
    kicker: "07 · A NOTE ON PRUDENCE",
    title: "Read with care.",
    body: "Casefiles concern real people, real funds, and real consequences. A reader who forwards a published claim as a verdict has misread it.\nA reader who acts on a single signal without reading the evidence trail has misread it.\nThe discipline runs on both sides of the page — we publish carefully, you read carefully. That is the contract.",
  },
];

export const CHARTER_TIER_PILLARS: CharterPillar[] = [
  {
    label: "RED · AVOID",
    title: "A stop signal, not an indictment.",
    body: "An AVOID does not mean illegal. It means the trail looks like coordinated extraction and the evidence is heavy enough that a careful reader should not take the position. Use it as a hard stop, not as an accusation you forward.",
  },
  {
    label: "AMBER · CAUTION",
    title: "The most informative tier.",
    body: "An AMBER means we found enough to log, not enough to publish a verdict. The reader is expected to read the evidence rail and form their own posture. Skipping AMBER cases is skipping the half of the work that needs reading.",
  },
  {
    label: "GREEN · CLEARED",
    title: "Not a recommendation.",
    body: "A GREEN is a record that, on the windows we measured, the trail did not surface the patterns we score. New evidence can move a green; markets can change behaviour. Read green as 'no flag found yet', not 'safe to deploy capital'.",
  },
];
