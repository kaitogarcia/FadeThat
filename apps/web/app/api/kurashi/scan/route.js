import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasKurashiAccess } from "@/lib/front-auth";
import { CATEGORIES } from "@/lib/kurashi/data";
import { ISO_DATE, todayISO } from "@/lib/kurashi/dates";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 4_000_000;
const MAX_IMAGES = 6;
const MEDIA = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export const Result = z.object({
  expenses: z.array(
    z.object({
      merchant: z.string(),
      amount: z.number(),
      currency: z.string(),
      date: z.string(),
      category: z.enum(CATEGORY_IDS),
      note: z.string(),
    })
  ),
});

export function system(today, lang) {
  return `You read receipts and screenshots of payment apps, bank apps and card statements, and return the money that was SPENT.

Rules:
- A paper or photographed receipt is ONE expense: the store name and the grand total (合計 / total), not each line item. Put up to three main items in "note".
- A screenshot of a transaction history (PayPay, Suica, LINE Pay, a bank or card app, Apple Pay) has one expense per spending row.
- Skip money coming in: income, salary, refunds, top-ups/charges (チャージ), transfers received, points earned.
- amount is a positive number in the currency's normal units (yen have no decimals).
- currency is an ISO 4217 code. ¥ means JPY unless the text is clearly Chinese (then CNY). $ means USD unless the text says otherwise.
- date is YYYY-MM-DD. If the year is missing, assume the most recent past date. If no date is visible, use ${today}.
- category is one of: ${CATEGORY_IDS.join(", ")}. food = groceries, restaurants, cafes, convenience-store food. daily = household goods, drugstore sundries. fun = entertainment, hobbies, media subscriptions. phone = mobile, internet. utilities = electricity, gas, water.
- merchant is the store or payee name as written.
- Write note in ${lang === "en" ? "English" : "Japanese"}. Leave it empty when there is nothing useful to add.
- If nothing is readable, return an empty list.`;
}

function fail(status, error) {
  return NextResponse.json({ error }, { status });
}

async function scanWithApi(images, today, lang) {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(Result) },
    system: system(today, lang),
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } })),
          { type: "text", text: `Extract every expense from ${images.length > 1 ? "these images" : "this image"}.` },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to read these images.");
  }
  if (!response.parsed_output) {
    throw new Error("The answer did not match the expected shape.");
  }
  return response.parsed_output.expenses;
}

export async function POST(request) {
  if (!(await hasKurashiAccess(request.cookies))) {
    return fail(401, "Log in on the home page first.");
  }
  // Scans cost money; the default login token is public, so the live site needs a private one.
  if (process.env.NODE_ENV === "production" && !process.env.FRONT_AUTH_TOKEN) {
    return fail(500, "Set a private FRONT_AUTH_TOKEN on Vercel before scanning.");
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return fail(413, "Images are too large. Try fewer at once.");
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "Bad request.");
  }

  const images = Array.isArray(body?.images) ? body.images : [];
  if (!images.length || images.length > MAX_IMAGES) {
    return fail(400, `Send 1 to ${MAX_IMAGES} images.`);
  }
  if (images.some((img) => !MEDIA.has(img?.mediaType) || typeof img?.data !== "string")) {
    return fail(400, "Images must be png, jpeg, webp or gif.");
  }
  const today = ISO_DATE.test(body?.today) ? body.today : todayISO();
  const lang = body?.lang === "en" ? "en" : "ja";

  const useApi = process.env.NODE_ENV === "production" || process.env.ANTHROPIC_API_KEY;
  try {
    let expenses;
    if (useApi) {
      expenses = await scanWithApi(images, today, lang);
    } else if (process.env.NODE_ENV !== "production") {
      // Dev-only, and imported lazily so the production bundle never includes it.
      const { scanWithCli } = await import("@/lib/kurashi/scan-cli");
      // The CLI rejects the draft-2020-12 `$schema` marker zod adds; the schema itself is fine.
      const { $schema, ...schema } = z.toJSONSchema(Result);
      expenses = await scanWithCli(images, system(today, lang), schema);
    }
    return NextResponse.json({ expenses });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return fail(500, "ANTHROPIC_API_KEY is missing or invalid on the server.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      return fail(429, "Too many scans right now. Try again in a minute.");
    }
    if (error instanceof Anthropic.APIError) {
      return fail(502, `Claude API error ${error.status}.`);
    }
    return fail(502, error.message || "Scan failed.");
  }
}
