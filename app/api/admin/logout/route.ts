import { adminCookieName, adminCookieOptions } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName, "", { ...adminCookieOptions, maxAge: 0 });
  return response;
}
