import {
  adminCookieName,
  createAdminSessionToken,
  getAdminCookieOptions,
  isAdminConfigured,
  verifyAdminPassword
} from "@/lib/admin-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const loginSchema = z.object({
  password: z.string().min(1).max(300),
  rememberDevice: z.boolean().default(true)
});

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Dashboard access has not been configured." },
      { status: 503 }
    );
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !verifyAdminPassword(parsed.data.password)) {
    return NextResponse.json({ ok: false, message: "Invalid password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    adminCookieName,
    createAdminSessionToken(parsed.data.rememberDevice),
    getAdminCookieOptions(parsed.data.rememberDevice)
  );
  return response;
}
