import { NextRequest, NextResponse } from "next/server";

const COOKIE = "aiteam-variant";
const VARIANTS = ["A", "B"] as const;

export function middleware(req: NextRequest) {
  // Solo asignar variante en home
  if (req.nextUrl.pathname !== "/") return NextResponse.next();

  const existing = req.cookies.get(COOKIE)?.value;
  if (existing === "A" || existing === "B") return NextResponse.next();

  const variant = VARIANTS[Math.random() < 0.5 ? 0 : 1];
  const res = NextResponse.next();
  res.cookies.set({
    name: COOKIE,
    value: variant,
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 días
    sameSite: "lax",
  });
  return res;
}

export const config = {
  matcher: ["/"],
};
