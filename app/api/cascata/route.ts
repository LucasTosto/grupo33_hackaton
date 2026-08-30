import { NextResponse } from "next/server";

import { assentosParaSimular, simulaVagaLiberada } from "@/lib/dados";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Simula uma vaga liberada no meio do processo e devolve a cadeia que ela
 * dispara. É a rodada contínua: reexecuta só o fecho da cascata, não a rede.
 */
export async function POST(req: Request) {
  let assento: string;
  try {
    const corpo = (await req.json()) as { assento?: string };
    assento = (corpo.assento ?? "").trim();
  } catch {
    return NextResponse.json({ erro: "corpo inválido: esperado JSON" }, { status: 400 });
  }

  if (!/^\d+\|[^|]+\|(Integral|Parcial)$/.test(assento)) {
    return NextResponse.json(
      { erro: "assento inválido: use o formato unidade|grupamento|horario" },
      { status: 400 },
    );
  }

  // Só assentos que o painel oferece — evita varrer a rede por entrada arbitrária.
  const permitidos = new Set(assentosParaSimular(24).map((a) => a.assento));
  if (!permitidos.has(assento)) {
    return NextResponse.json({ erro: "assento fora da lista de simulação" }, { status: 400 });
  }

  const resultado = simulaVagaLiberada(assento);
  if (!resultado) {
    return NextResponse.json({ erro: "este assento não tem ocupante na rodada atual" }, { status: 404 });
  }

  return NextResponse.json(resultado);
}
