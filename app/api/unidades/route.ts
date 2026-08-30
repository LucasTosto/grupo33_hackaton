import { NextResponse } from "next/server";

import { GRUPAMENTOS, HORARIOS, unidadesParaEscolha } from "@/lib/dados";
import type { Horario } from "@/lib/engine/index.ts";

/**
 * Creches que oferecem o assento pedido, ordenadas pela distância até o bairro
 * da família.
 *
 * Quando a pontuação vem no pedido, cada creche volta anotada com a fila real à
 * frente e o semáforo de chance. A anotação só existe porque a pontuação passou
 * a ser calculada **antes** da escolha das creches: no fluxo anterior a família
 * ordenava até cinco creches sem saber a própria pontuação e só depois descobria
 * que tinha zero ponto confirmado e que a 1ª opção tinha 8 candidatos por vaga.
 *
 * `pontos` é a pontuação **confirmada**. `pontosComPendentes` serve só para a
 * segunda linha, em cinza, do "se você comprovar" — nunca para a posição real.
 */
export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const grupamento = searchParams.get("grupamento") ?? "";
  const horario = (searchParams.get("horario") ?? "") as Horario;
  const bairro = searchParams.get("bairro");
  const pontos = searchParams.has("pontos") ? Number(searchParams.get("pontos")) : null;
  const comPendentes = searchParams.has("pontosComPendentes")
    ? Number(searchParams.get("pontosComPendentes"))
    : null;

  if (!GRUPAMENTOS.includes(grupamento as (typeof GRUPAMENTOS)[number])) {
    return NextResponse.json({ erro: "grupamento inválido", grupamentos: GRUPAMENTOS }, { status: 400 });
  }
  if (!HORARIOS.includes(horario)) {
    return NextResponse.json({ erro: "horário inválido", horarios: HORARIOS }, { status: 400 });
  }

  const unidades = unidadesParaEscolha(
    grupamento,
    horario,
    bairro,
    Number.isFinite(pontos) ? pontos : null,
    Number.isFinite(comPendentes) ? comPendentes : null,
  );

  return NextResponse.json(
    { grupamento, horario, bairro, total: unidades.length, unidades },
    // Sem cache quando a resposta depende da pontuação de quem perguntou.
    { headers: { "cache-control": pontos === null ? "public, max-age=300" : "no-store" } },
  );
}
