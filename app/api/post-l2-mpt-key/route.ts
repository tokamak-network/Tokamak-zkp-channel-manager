import { NextResponse } from 'next/server';

export const runtime = "nodejs";

import { deriveL2KeysAndAddressFromSignature } from "@/lib/mptKeyUtils";

export async function POST(req: Request) {
  const body = await req.json();
  const result = deriveL2KeysAndAddressFromSignature(
    body.signature,
    body.slotIndex,
  )
  return NextResponse.json(result);
}