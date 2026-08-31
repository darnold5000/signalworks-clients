import { NextResponse } from "next/server";
import { createClientRecord, createClientSchema } from "@/lib/admin/client-creation";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = createClientSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  try {
    return NextResponse.json(await createClientRecord(parsed.data, profile.id), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create client.";
    const duplicate = message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique");
    return NextResponse.json({ error: duplicate ? "A contact with that email already exists for this client." : message }, { status: 400 });
  }
}
