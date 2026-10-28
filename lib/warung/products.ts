import { nextSequence, padSequence } from "@/lib/warung/counters";

export function buildProductCode(famCode: string, seq: number): string {
  return `PRD-${famCode}-${padSequence(seq, 3)}`;
}

export async function generateProductCode(famCode: string): Promise<string> {
  const seq = await nextSequence(`product_fam_${famCode}`, 1);
  return buildProductCode(famCode, seq);
}