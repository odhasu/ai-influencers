import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type RateLimitOptions = {
  request: Request;
  scope: string;
  limit: number;
  windowSeconds: number;
  identifier?: string;
};

export type RateLimitResult =
  | {
      available: true;
      allowed: boolean;
      remaining: number;
      retryAfterSeconds: number;
    }
  | {
      available: false;
      allowed: false;
      retryAfterSeconds: number;
    };

function ipv4FromMappedGroups(groups: string[]) {
  const high = Number.parseInt(groups[6], 16);
  const low = Number.parseInt(groups[7], 16);
  return [high >>> 8, high & 255, low >>> 8, low & 255].join(".");
}

function expandedIpv6(value: string) {
  let address = value.toLowerCase();
  const hasIpv4Tail = address.includes(".");

  if (hasIpv4Tail) {
    const lastColon = address.lastIndexOf(":");
    const octets = address
      .slice(lastColon + 1)
      .split(".")
      .map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return null;
    }
    address =
      address.slice(0, lastColon + 1) +
      ((octets[0] << 8) | octets[1]).toString(16) +
      ":" +
      ((octets[2] << 8) | octets[3]).toString(16);
  }

  const halves = address.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;

  const groups = [
    ...left,
    ...Array.from({ length: missing }, () => "0"),
    ...right
  ].map((group) => Number.parseInt(group, 16).toString(16).padStart(4, "0"));

  return groups.length === 8 ? { groups, hasIpv4Tail } : null;
}

function normalizedClientNetwork(value: string | null | undefined) {
  if (!value) return null;
  const candidate = value.trim().replace(/^\[([^\]]+)\]$/, "$1");
  const version = isIP(candidate);
  if (version === 4) return candidate.split(".").map(Number).join(".");
  if (version !== 6) return null;

  const expanded = expandedIpv6(candidate);
  if (!expanded) return null;
  const mappedIpv4 =
    expanded.groups.slice(0, 5).every((group) => group === "0000") &&
    expanded.groups[5] === "ffff";
  const compatibleIpv4 =
    expanded.hasIpv4Tail && expanded.groups.slice(0, 6).every((group) => group === "0000");
  if (mappedIpv4 || compatibleIpv4) return ipv4FromMappedGroups(expanded.groups);
  return expanded.groups.slice(0, 4).join(":") + "::/64";
}

function clientIp(request: Request) {
  const headers = request.headers;
  const forwardedByVercel = headers.get("x-vercel-forwarded-for")?.split(",", 1)[0];
  const forwarded = headers.get("x-forwarded-for")?.split(",", 1)[0];
  const candidates = [
    forwardedByVercel,
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    forwarded
  ];

  for (const candidate of candidates) {
    const network = normalizedClientNetwork(candidate);
    if (network) return network;
  }
  return "unknown-client";
}

function isRpcRow(value: unknown): value is {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
} {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.allowed === "boolean" &&
    typeof row.remaining === "number" &&
    Number.isFinite(row.remaining) &&
    typeof row.retry_after_seconds === "number" &&
    Number.isFinite(row.retry_after_seconds)
  );
}

function unavailable(scope: string, reason: string): RateLimitResult {
  console.error("[rate-limit] " + scope + ": " + reason);
  return { available: false, allowed: false, retryAfterSeconds: 30 };
}

export async function consumeRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  if (
    !/^[a-z0-9:_-]{1,80}$/.test(options.scope) ||
    !Number.isSafeInteger(options.limit) ||
    options.limit < 1 ||
    options.limit > 10_000 ||
    !Number.isSafeInteger(options.windowSeconds) ||
    options.windowSeconds < 1 ||
    options.windowSeconds > 86_400 ||
    (options.identifier !== undefined && (!options.identifier.trim() || options.identifier.length > 500))
  ) {
    return unavailable(options.scope, "invalid limiter configuration");
  }

  const hashingSecret = process.env.SUPABASE_SECRET_KEY;
  if (!hashingSecret) return unavailable(options.scope, "server configuration is missing");

  const identifierHash = createHmac("sha256", hashingSecret)
    .update(options.scope)
    .update("\0")
    .update(options.identifier?.trim().toLowerCase() ?? clientIp(options.request))
    .digest("hex");

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.rpc("consume_api_rate_limit", {
      p_scope: options.scope,
      p_identifier_hash: identifierHash,
      p_limit: options.limit,
      p_window_seconds: options.windowSeconds
    });

    if (error) return unavailable(options.scope, error.message);

    const value = (Array.isArray(data) ? data[0] : data) as unknown;
    if (!isRpcRow(value)) return unavailable(options.scope, "RPC returned an invalid result");

    return {
      available: true,
      allowed: value.allowed,
      remaining: Math.max(0, Math.floor(value.remaining)),
      retryAfterSeconds: value.allowed ? 0 : Math.max(1, Math.ceil(value.retry_after_seconds))
    };
  } catch (error) {
    return unavailable(options.scope, error instanceof Error ? error.message : "unknown RPC failure");
  }
}
