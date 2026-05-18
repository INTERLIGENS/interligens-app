/**
 * GET /api/admin/documents/presign?filename=X&mimeType=Y
 *
 * Returns a presigned R2 PUT URL for uploading an admin document. Caller is
 * expected to PUT the raw file to the returned URL, then POST metadata +
 * the assigned r2Key back to /api/admin/documents.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAdminApi } from "@/lib/security/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function r2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("r2_credentials_missing");
  }
  return new S3Client({
    region: "auto",
    endpoint: "https://" + accountId + ".r2.cloudflarestorage.com",
    credentials: { accessKeyId, secretAccessKey },
  });
}

function sanitizeFilename(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const filename = url.searchParams.get("filename");
  const mimeType = url.searchParams.get("mimeType") ?? "application/pdf";

  if (!filename) {
    return NextResponse.json({ error: "filename_required" }, { status: 400 });
  }

  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    return NextResponse.json(
      { error: "r2_bucket_not_configured" },
      { status: 500 },
    );
  }

  try {
    const safe = sanitizeFilename(filename);
    const r2Key =
      "admin-documents/" +
      new Date().toISOString().slice(0, 10) +
      "/" +
      randomBytes(6).toString("base64url") +
      "-" +
      safe;

    const signedUrl = await getSignedUrl(
      r2Client(),
      new PutObjectCommand({
        Bucket: bucket,
        Key: r2Key,
        ContentType: mimeType,
      }),
      { expiresIn: 600 },
    );

    const publicBase =
      process.env.R2_PUBLIC_BASE_URL ?? "https://pub-interligens.r2.dev";
    const publicUrl = `${publicBase}/${r2Key}`;

    return NextResponse.json({
      ok: true,
      uploadUrl: signedUrl,
      r2Key,
      publicUrl,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/documents/presign] failed", err);
    return NextResponse.json(
      { error: "presign_failed", message: message.slice(0, 200) },
      { status: 500 },
    );
  }
}
