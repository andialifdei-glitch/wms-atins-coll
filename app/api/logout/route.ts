import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.set("admin_session", "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}