/**
 * src/lib/osint/vision/callVision.ts
 *
 * Thin wrapper around the Anthropic SDK vision call. Isolated in its own module
 * so route tests can vi.mock("@/lib/osint/vision/callVision") without touching
 * the network or needing an API key. Reuses the same client style as
 * src/app/api/scan/ask/route.ts (apiKey from process.env.ANTHROPIC_API_KEY).
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  VISION_SYSTEM_PROMPT,
  VISION_MODEL,
  VISION_MAX_TOKENS,
  buildVisionUserText,
  type VisionOutput,
} from "./visionPrompt";

export type VisionMediaType =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/** Strip ```json fences / stray prose and parse the first JSON object. */
export function parseVisionJson(raw: string): VisionOutput {
  let s = raw.trim();
  // remove markdown fences if the model added them despite instructions
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // fall back to the first {...} block if there is surrounding text
  if (!s.startsWith("{")) {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw Object.assign(new Error("Vision output is not JSON"), { code: "VISION_NOT_JSON" });
    }
    s = s.slice(start, end + 1);
  }
  return JSON.parse(s) as VisionOutput;
}

/**
 * Call the vision model on a base64 image. Returns the parsed VisionOutput.
 * Throws on network/parse errors — the route maps those to 502/422.
 */
export async function callVision(
  base64Data: string,
  mediaType: VisionMediaType,
  kolHandleHint: string | null,
): Promise<VisionOutput> {
  const message = await client().messages.create({
    model: VISION_MODEL,
    max_tokens: VISION_MAX_TOKENS,
    system: VISION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Data },
          },
          { type: "text", text: buildVisionUserText(kolHandleHint) },
        ],
      },
    ],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parseVisionJson(text);
}
