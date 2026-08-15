import { adminCookieName, adminCookieOptions } from "@/lib/admin-auth";
import { isSameOriginBrowserRequest } from "@/lib/api-security";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!isSameOriginBrowserRequest(request)) {
    return NextResponse.json({ ok: false, message: "Forbidden." }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName, "", { ...adminCookieOptions, maxAge: 0 });
  return response;
}
