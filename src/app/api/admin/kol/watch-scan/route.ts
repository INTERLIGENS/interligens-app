import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminApi } from "@/lib/security/adminAuth"

const SUSPECT_KEYWORDS = [
  "launch", "launching", "launched", "gem", "buy", "presale", "stealth",
  "ca:", "contract:", "mint", "fair launch", "just launched", "new token",
  "100x", "1000x", "ape", "low cap", "microcap", "degen", "solana",
  "pump", "moon", "huge", "early", "alpha", "call"
]

const COST_PER_TWEET = 0.005
const COST_PER_USER_LOOKUP = 0.010
const MONTHLY_BUDGET = 75

async function checkBudget(): Promise<boolean> {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  try {
    const usage = await prisma.xApiUsage.findFirst({ where: { month } })
    return Number(usage?.estimatedUsd ?? 0) < 75
  } catch { return true }
}

async function trackUsage(tweets: number, userLookups: number) {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const cost = (tweets * 0.005) + (userLookups * 0.010)
  try {
    const existing = await prisma.xApiUsage.findUnique({ where: { month } })
    if (existing) {
      await prisma.xApiUsage.update({ where: { id: existing.id }, data: { estimatedUsd: { increment: cost }, callCount: { increment: tweets + userLookups }, lastCall: now } })
    } else {
      await prisma.xApiUsage.create({ data: { month, estimatedUsd: cost, callCount: tweets + userLookups, lastCall: now } })
    }
  } catch(e) { console.log("budget track error:", e) }
}

function hasSuspectKeyword(text: string): string[] {
  const lower = text.toLowerCase()
  return SUSPECT_KEYWORDS.filter(k => lower.includes(k))
}

export async function POST(req: NextRequest) {
  const auth = requireAdminApi(req)
  if (auth) return auth

  const adminToken = req.headers.get("x-admin-token") ?? ""
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3100"
  const xToken = process.env.X_BEARER_TOKEN
  if (!xToken) return NextResponse.json({ error: "No X_BEARER_TOKEN" }, { status: 500 })

  const budgetOk = await checkBudget()
  if (!budgetOk) return NextResponse.json({ error: "Monthly budget exhausted" }, { status: 429 })

  // Charger la watchlist active
  const sources = await prisma.watchSource.findMany({ where: { active: true } })
  const xSources = sources.filter(s => s.url.includes("x.com") || s.url.includes("twitter.com"))

  const results: any[] = []
  let totalTweets = 0
  let totalLookups = 0
  let alertsTriggered = 0

  for (const source of xSources) {
    const handle = source.url.split("/").pop()
    if (!handle) continue

    try {
      // User lookup
      const userRes = await fetch(
        `https://api.twitter.com/2/users/by/username/${handle}?user.fields=public_metrics`,
        { headers: { Authorization: `Bearer ${xToken}` }, signal: AbortSignal.timeout(8000) }
      )
      const userData = await userRes.json()
      const userId = userData?.data?.id
      totalLookups++

      if (!userId) {
        results.push({ handle, status: "not_found" })
        continue
      }

      // Fetch tweets (max 10 pour économiser le budget)
      const tweetsRes = await fetch(
        `https://api.twitter.com/2/users/${userId}/tweets?max_results=10&tweet.fields=created_at,text&exclude=retweets,replies`,
        { headers: { Authorization: `Bearer ${xToken}` }, signal: AbortSignal.timeout(8000) }
      )
      const tweetsData = await tweetsRes.json()
      const tweets = tweetsData?.data ?? []
      totalTweets += tweets.length

      // Archiver le texte des posts en KolEvidence si suspect
      const suspectTweets = []
      for (const tweet of tweets) {
        const keywords = hasSuspectKeyword(tweet.text)
        if (keywords.length === 0) continue

        // Vérifier si déjà archivé
        const existing = await prisma.kolEvidence.findFirst({
          where: { sourceUrl: `https://x.com/${handle}/status/${tweet.id}` }
        })
        if (existing) continue

        // Chercher si ce handle est un KOL connu
        const kol = await prisma.kolProfile.findFirst({
          where: { handle: { equals: handle, mode: "insensitive" } }
        })

        if (kol) {
          // Créer KolEvidence avec le post archivé
          await prisma.kolEvidence.create({
            data: {
              kolHandle: kol.handle,
              type: "social_post",
              label: `X post @${handle} — suspect keywords: ${keywords.slice(0,3).join(", ")}`,
              description: tweet.text.slice(0, 500),
              wallets: "[]",
              sourceUrl: `https://x.com/${handle}/status/${tweet.id}`,
              twitterPost: `https://x.com/${handle}/status/${tweet.id}`,
              postTimestamp: new Date(tweet.created_at),
            }
          })
          alertsTriggered++
        }

        suspectTweets.push({
          id: tweet.id,
          text: tweet.text.slice(0, 100),
          created_at: tweet.created_at,
          keywords,
          url: `https://x.com/${handle}/status/${tweet.id}`,
          kol_known: !!kol
        })
      }

      // Mettre à jour lastChecked
      await prisma.watchSource.update({
        where: { id: source.id },
        data: { lastChecked: new Date() }
      })

      results.push({
        handle,
        tweets: tweets.length,
        suspect: suspectTweets.length,
        alerts: suspectTweets,
        status: "ok"
      })

    } catch (e: any) {
      results.push({ handle, status: "error", error: e.message })
    }
  }

  // Tracker le coût
  await trackUsage(totalTweets, totalLookups)

  return NextResponse.json({
    scanned: xSources.length,
    totalTweets,
    totalLookups,
    estimatedCost: `$${((totalTweets * COST_PER_TWEET) + (totalLookups * COST_PER_USER_LOOKUP)).toFixed(3)}`,
    alertsTriggered,
    results
  })
}
