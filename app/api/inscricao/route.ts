import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  catalogo,
  COMPROVANTES,
  GRUPAMENTOS,
  HORARIOS,
  rodada,
  resumoDaInscricao,
  unidadePorCodigo,
  type InscricaoViva,
} from "@/lib/dados";
import { grupamentoPorNascimento, type Horario } from "@/lib/engine/index.ts";

export const runtime = "nodejs";
// A rodada roda sobre a fila real inteira a cada inscrição nova. Warm leva ~2 s;
// a folga é para o primeiro pedido depois de um cold start.
export const maxDuration = 60;

const ANO_PROCESSO = 2025;
const MAX_OPCOES = 5;

interface Corpo {
  /** `yyyy-MM` — a base só expõe ano-mês, e o motor só precisa disso. */
  nascimento?: string;
  bairro?: string | null;
  horario?: string;
  opcoes?: number[];
  criterios?: number[];
  /** Reenviado ao acompanhar uma inscrição já feita, para manter o protocolo. */
  protocolo?: string;
}

/**
 * Protocolo determinístico: a mesma inscrição gera sempre o mesmo número.
 * Não guardamos estado — o cliente reenvia a inscrição para acompanhar, e a
 * rodada é reproduzível, então o resultado não depende de banco nenhum.
 */
function geraProtocolo(c: Corpo): string {
  const material = [c.nascimento, c.bairro, c.horario, (c.opcoes ?? []).join(","), (c.criterios ?? []).sort().join(",")].join("|");
  const h = createHash("sha256").update(material).digest("hex").slice(0, 8).toUpperCase();
  return `RJ-${ANO_PROCESSO}-${h}`;
}

/**
 * Aquece o motor: decodifica a fila de 2025 e calcula a rodada base, deixando
 * tudo em memória da instância.
 *
 * O primeiro POST numa instância fria paga a decodificação de 72 mil inscrições
 * mais a rodada inteira — uns 6 s. O formulário chama este GET quando a família
 * chega no passo das creches, então o envio já encontra a instância quente. Não
 * é truque de demo: é a mesma coisa que um `warmup` de qualquer serviço que
 * carrega índice na subida.
 */
export function GET() {
  const t0 = performance.now();
  const base = rodada();
  return NextResponse.json(
    {
      pronto: true,
      criancasNaFila: base.parametros.candidatos.length,
      assentos: base.parametros.assentos.length,
      rodadaId: base.resultado.rodadaId,
      aquecimentoMs: Math.round(performance.now() - t0),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: Request) {
  let corpo: Corpo;
  try {
    corpo = (await req.json()) as Corpo;
  } catch {
    return NextResponse.json({ erro: "corpo inválido: esperado JSON" }, { status: 400 });
  }

  const erros: string[] = [];

  const nascimento = (corpo.nascimento ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(nascimento)) {
    erros.push("Informe o mês e o ano de nascimento da criança.");
  }
  const grupamento = /^\d{4}-\d{2}$/.test(nascimento) ? grupamentoPorNascimento(nascimento, ANO_PROCESSO) : null;
  if (nascimento && !grupamento) {
    erros.push(
      "Pela data informada, a criança não se enquadra em creche neste processo: a vaga de creche vai até 3 anos incompletos em 31 de março.",
    );
  }

  const horario = (corpo.horario ?? "") as Horario;
  if (!HORARIOS.includes(horario)) erros.push("Escolha entre horário Integral e Parcial.");

  const opcoes = Array.isArray(corpo.opcoes) ? corpo.opcoes.map(Number).filter(Number.isFinite) : [];
  if (opcoes.length === 0) erros.push("Escolha ao menos uma creche.");
  if (opcoes.length > MAX_OPCOES) erros.push(`São permitidas no máximo ${MAX_OPCOES} opções.`);
  if (new Set(opcoes).size !== opcoes.length) erros.push("Há creches repetidas na lista de opções.");

  // As opções têm que existir e oferecer de fato o assento pedido.
  if (grupamento && HORARIOS.includes(horario)) {
    for (const codigo of opcoes) {
      const u = unidadePorCodigo(codigo);
      if (!u) {
        erros.push(`Unidade ${codigo} não existe no catálogo do processo.`);
        continue;
      }
      const tem = u.assentos.some((a) => a.grupamento === grupamento && a.horario === horario && a.capacidade > 0);
      if (!tem) erros.push(`${u.nome} não oferece ${grupamento} em horário ${horario} neste processo.`);
    }
  }

  const validos = new Set(catalogo.criterios.map((c) => c.pergId));
  const criterios = (Array.isArray(corpo.criterios) ? corpo.criterios.map(Number) : []).filter((p) => validos.has(p));

  if (erros.length > 0) {
    return NextResponse.json({ erros }, { status: 422 });
  }

  const inscricao: InscricaoViva = {
    protocolo: corpo.protocolo && /^RJ-\d{4}-[0-9A-F]{8}$/.test(corpo.protocolo) ? corpo.protocolo : geraProtocolo(corpo),
    grupamento: grupamento as string,
    horario,
    opcoes,
    criterios,
    bairro: corpo.bairro ?? null,
  };

  const resumo = resumoDaInscricao(inscricao);

  // O que a família precisa levar para comprovar. Sem isso, a pontuação declarada
  // não vira pontuação na classificação: é onde 62 pontos percentuais se perdem.
  const comprovantes = catalogo.criterios
    .filter((c) => criterios.includes(c.pergId))
    .sort((a, b) => b.pontos - a.pontos)
    .map((c) => ({
      pergId: c.pergId,
      texto: c.texto,
      pontos: c.pontos,
      desempate: c.desempate,
      documento: COMPROVANTES[c.pergId] ?? "Consulte a unidade sobre o documento aceito",
    }));

  return NextResponse.json({
    inscricao: { ...inscricao, grupamento },
    resumo,
    comprovantes,
  });
}
