import { NextResponse } from 'next/server';

export const runtime = "nodejs";

import { deriveL2MptKeyFromSignature } from "@/lib/mptKeyUtils";

export async function POST(req: Request) {
  const body = await req.json();
  const key = deriveL2MptKeyFromSignature(
    body.signature,
    body.slotIndex,
  )
  return NextResponse.json({ key });
}