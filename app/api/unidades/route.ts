import { NextResponse } from "next/server";

import { GRUPAMENTOS, HORARIOS, unidadesParaEscolha } from "@/lib/dados";
import type { Horario } from "@/lib/engine/index.ts";

/**
 * Creches que oferecem o assento pedido, ordenadas pela distância até o bairro
 * da família, com a concorrência real do processo de 2025.
 */
export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const grupamento = searchParams.get("grupamento") ?? "";
  const horario = (searchParams.get("horario") ?? "") as Horario;
  const bairro = searchParams.get("bairro");

  if (!GRUPAMENTOS.includes(grupamento as (typeof GRUPAMENTOS)[number])) {
    return NextResponse.json({ erro: "grupamento inválido", grupamentos: GRUPAMENTOS }, { status: 400 });
  }
  if (!HORARIOS.includes(horario)) {
    return NextResponse.json({ erro: "horário inválido", horarios: HORARIOS }, { status: 400 });
  }

  const unidades = unidadesParaEscolha(grupamento, horario, bairro);
  return NextResponse.json(
    { grupamento, horario, bairro, total: unidades.length, unidades },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
