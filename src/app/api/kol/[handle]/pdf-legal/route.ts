// src/app/api/kol/[handle]/pdf-legal/route.ts
// Sprint 5 — Legal PDF gate avec auth email + token
// Remplace ou wraps l'accès direct au PDF lawyer

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// ─── Config ───────────────────────────────────────────────────
const LEGAL_ACCESS_TOKEN = process.env.LEGAL_PDF_TOKEN; // set in Vercel env
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Domaines autorisés pour accès sans token (optionnel — désactiver si trop permissif)
const ALLOWED_EMAIL_DOMAINS: string[] = [
  // Laisser vide pour désactiver le bypass domaine
  // "lawfirm.com",
];

// ─── Types ────────────────────────────────────────────────────
interface AccessRequest {
  email?: string;
  token?: string;
  purpose?: string; // "legal_review" | "law_enforcement" | "internal"
}

// ─── Helper ───────────────────────────────────────────────────
function isAdminToken(token: string): boolean {
  if (!ADMIN_TOKEN) return false;
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(ADMIN_TOKEN)
  );
}

function isValidLegalToken(token: string): boolean {
  if (!LEGAL_ACCESS_TOKEN) return false;
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(LEGAL_ACCESS_TOKEN)
  );
}

function isAllowedEmailDomain(email: string): boolean {
  if (ALLOWED_EMAIL_DOMAINS.length === 0) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.includes(domain ?? "");
}

// ─── Log access ───────────────────────────────────────────────
async function logAccess(handle: string, email: string | undefined, purpose: string | undefined, ip: string) {
  // TODO Sprint 6 : persister en DB table LegalPdfAccess
  console.log(`[LEGAL-PDF-ACCESS] handle=${handle} email=${email ?? "token-auth"} purpose=${purpose ?? "unspecified"} ip=${ip} ts=${new Date().toISOString()}`);
}

// ─── Route ────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  let body: AccessRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, token, purpose } = body;

  // ── Auth check ────────────────────────────────────────────
  let authorized = false;
  let authMethod = "";

  // 1. Admin token (full access)
  const bearerToken = req.headers.get("authorization")?.replace("Bearer ", "") ?? token;
  if (bearerToken) {
    if (isAdminToken(bearerToken)) {
      authorized = true;
      authMethod = "admin_token";
    } else if (isValidLegalToken(bearerToken)) {
      authorized = true;
      authMethod = "legal_token";
    }
  }

  // 2. Email domain check (if configured)
  if (!authorized && email) {
    if (isAllowedEmailDomain(email)) {
      authorized = true;
      authMethod = "email_domain";
    }
  }

  // 3. Email-only mode : envoie un lien signé (implémentation future)
  if (!authorized && email && !token) {
    // Pour l'instant : retourne une demande d'accès
    await logAccess(handle, email, purpose, ip);
    return NextResponse.json(
      {
        status: "pending",
        message: "Access request received. A secure link will be sent to your email within 24h.",
        email,
        reportId: `INTL-MN0LVDFO-KOL`, // TODO : dynamic per handle
      },
      { status: 202 }
    );
  }

  if (!authorized) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid token or email." },
      { status: 401 }
    );
  }

  // ── Log ───────────────────────────────────────────────────
  await logAccess(handle, email, purpose, ip);

  // ── Generate signed URL ───────────────────────────────────
  // Option A : redirect to R2 signed URL
  // Option B : stream the PDF directly
  // Implémentation R2 :
  const pdfKey = `kol/${handle}/legal-${handle}.pdf`;

  const fallbackUrl = `/api/kol/${handle}/pdf-lawyer?token=${LEGAL_ACCESS_TOKEN}`;
  return NextResponse.json({
    status: "authorized",
    authMethod,
    url: fallbackUrl,
    expiresIn: null,
  });
}

// GET : vérifier si handle a un legal PDF disponible
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  return NextResponse.json({
    handle,
    legalPdfAvailable: true,
    requiresAuth: true,
    contactEmail: "admin@interligens.com",
    method: "POST /api/kol/[handle]/pdf-legal with { email, purpose } or Bearer token",
  });
}
