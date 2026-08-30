import { NextResponse } from "next/server";

import { consultaBases, cpfValido, enderecoPorCep, perfisDaDemonstracao } from "@/lib/bases";
import { PERGUNTAS } from "@/lib/regua";

export const runtime = "nodejs";

/**
 * Perfis oferecidos na tela de identificação da demonstração.
 *
 * Cada um traz o selo do que serve para provar, e nunca a pontuação: a tela de
 * escolha de perfil não pode antecipar o resultado, senão a demonstração vira
 * uma lista de resultados em vez de um fluxo.
 */
export function GET() {
  return NextResponse.json(
    { perfis: perfisDaDemonstracao() },
    { headers: { "cache-control": "no-store" } },
  );
}

interface Corpo {
  cpf?: string;
  /** Consulta de CEP, quando a tela de endereço pede. */
  cep?: string;
  numero?: string;
}

/**
 * Consulta as bases do governo — o que substitui oito das treze perguntas.
 *
 * Devolve os cartões da tela de conferência (com fonte e data de cada um), os
 * graus de régua que a consulta confirmou, e quais bases não responderam: são
 * elas que disparam as duas perguntas condicionais.
 *
 * Uma base que não respondeu **não** é uma base que respondeu "não". O estado
 * `indisponivel` existe para isso, e nunca reduz pontuação.
 */
export async function POST(req: Request) {
  let corpo: Corpo;
  try {
    corpo = (await req.json()) as Corpo;
  } catch {
    return NextResponse.json({ erro: "corpo inválido: esperado JSON" }, { status: 400 });
  }

  // ── consulta de CEP ──────────────────────────────────────────────────
  if (corpo.cep !== undefined) {
    const endereco = enderecoPorCep(corpo.cep, (corpo.numero ?? "").trim());
    if (!endereco) {
      return NextResponse.json(
        { erro: "Não encontramos esse CEP. Confira os 8 dígitos ou escolha o bairro na lista." },
        { status: 404 },
      );
    }
    return NextResponse.json({ endereco }, { headers: { "cache-control": "no-store" } });
  }

  // ── consulta pelo CPF ────────────────────────────────────────────────
  const cpf = (corpo.cpf ?? "").replace(/\D/g, "");
  if (!cpfValido(cpf)) {
    return NextResponse.json({ erro: "CPF inválido. Confira os 11 dígitos." }, { status: 422 });
  }

  const consulta = consultaBases(cpf);
  if (!consulta) {
    return NextResponse.json(
      {
        erro:
          "Este protótipo consulta apenas os perfis da demonstração. Volte e escolha uma das famílias " +
          "para ver o fluxo completo.",
      },
      { status: 404 },
    );
  }

  // As perguntas condicionais entram no total só quando disparam — e a barra de
  // progresso precisa suportar total variável sem regredir.
  const perguntas = PERGUNTAS.filter(
    (p) =>
      p.condicional === undefined ||
      (p.condicional === "sem_bpc" && consulta.semBpc) ||
      (p.condicional === "sem_cadunico" && consulta.semCadunico),
  );

  return NextResponse.json({ consulta, perguntas }, { headers: { "cache-control": "no-store" } });
}
