import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const adminCookieName = "funnel_admin_session";
const rememberedSessionLifetimeSeconds = 60 * 60 * 24 * 30;
const browserSessionLifetimeSeconds = 60 * 60 * 12;

function credentials() {
  return {
    password: process.env.DASHBOARD_PASSWORD ?? "",
    secret: process.env.DASHBOARD_SESSION_SECRET ?? ""
  };
}

export function isDevelopmentAdminBypass() {
  const { password, secret } = credentials();
  return process.env.NODE_ENV !== "production" && (!password || !secret);
}

export function isAdminConfigured() {
  const { password, secret } = credentials();
  return Boolean(password && secret);
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function verifyAdminPassword(candidate: string) {
  const { password } = credentials();
  if (!password) return false;
  return timingSafeEqual(digest(candidate), digest(password));
}

export function createAdminSessionToken(rememberDevice = true) {
  const { secret } = credentials();
  if (!secret) throw new Error("Dashboard session secret is missing.");

  const lifetimeSeconds = rememberDevice ? rememberedSessionLifetimeSeconds : browserSessionLifetimeSeconds;
  const expiresAt = Math.floor(Date.now() / 1000) + lifetimeSeconds;
  const signature = createHmac("sha256", secret).update(String(expiresAt)).digest("hex");
  return `${expiresAt}.${signature}`;
}

function verifyAdminSessionToken(token: string) {
  const { secret } = credentials();
  if (!secret) return false;

  const [expiresText, signature] = token.split(".");
  const expiresAt = Number(expiresText);
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000) || !signature) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(expiresText).digest("hex");
  return timingSafeEqual(digest(signature), digest(expected));
}

export async function isAdminAuthenticated() {
  if (isDevelopmentAdminBypass()) return true;
  const token = (await cookies()).get(adminCookieName)?.value;
  return token ? verifyAdminSessionToken(token) : false;
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
}

export const adminCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: rememberedSessionLifetimeSeconds
};

export function getAdminCookieOptions(rememberDevice = true) {
  if (rememberDevice) return adminCookieOptions;
  return {
    httpOnly: adminCookieOptions.httpOnly,
    sameSite: adminCookieOptions.sameSite,
    secure: adminCookieOptions.secure,
    path: adminCookieOptions.path
  };
}
