import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { bairroCanonico } from "@/lib/bairros";
import { cpfValido } from "@/lib/bases";
import {
  catalogo,
  HORARIOS,
  MAX_OPCOES,
  parametros,
  rodada,
  resumoDaInscricao,
  unidadePorCodigo,
  type InscricaoViva,
} from "@/lib/dados";
import { grupamentoPorNascimento, type Horario } from "@/lib/engine/index.ts";
import {
  DOCUMENTOS_POR_GRAU,
  grauPorId,
  REGUA_VERSAO,
  REGUA_VIGENCIA_PROCESSOS,
  type ItemDeclarado,
  type Origem,
} from "@/lib/regua";

export const runtime = "nodejs";
// A rodada roda sobre a fila real inteira a cada inscrição nova. Warm leva ~2 s;
// a folga é para o primeiro pedido depois de um cold start.
export const maxDuration = 60;

const ANO_PROCESSO = 2025;
const ORIGENS: Origem[] = ["aferido", "atestado", "declarado"];

interface Corpo {
  /** `yyyy-MM` — a base só expõe ano-mês, e o motor só precisa disso. */
  nascimento?: string;
  /** CPF da criança, ou DNV quando ela ainda não tem CPF. Chave da inscrição. */
  cpfCrianca?: string;
  dnvCrianca?: string;
  cpfResponsavel?: string;
  cep?: string | null;
  numero?: string | null;
  bairro?: string | null;
  horario?: string;
  /** Multiplica os assentos elegíveis, e é um campo de uma pergunta. */
  aceitaOutroTurno?: boolean;
  opcoes?: number[];
  /** Graus da régua, com a origem de cada um. */
  itens?: ItemDeclarado[];
  /** `pergId` dos critérios de desempate confirmados em base. */
  desempates?: number[];
  /**
   * Qual opção a família quer manter na lista de espera, se for alocada fora
   * dela. 1 = primeira. Padrão: a 1ª opção.
   */
  opcaoMantida?: number;
  contato?: { celular?: string; whatsapp?: boolean; canal?: string; verificado?: boolean };
  /**
   * Consentimento em duas caixas, porque a base legal não é a mesma: consulta
   * comum é execução de política pública (LGPD art. 7º, III) e consulta de
   * saúde e deficiência é dado sensível (art. 11, II, "b").
   */
  consentimento?: { comum?: boolean; sensivel?: boolean };
  /** Reenviado ao acompanhar uma inscrição já feita, para manter o protocolo. */
  protocolo?: string;
}

/**
 * Protocolo determinístico: a mesma inscrição gera sempre o mesmo número.
 * Não guardamos estado — o cliente reenvia a inscrição para acompanhar, e a
 * rodada é reproduzível, então o resultado não depende de banco nenhum.
 */
function geraProtocolo(c: Corpo): string {
  const material = [
    c.cpfCrianca ?? c.dnvCrianca ?? "",
    c.nascimento,
    c.cep,
    c.horario,
    (c.opcoes ?? []).join(","),
    (c.itens ?? [])
      .map((i) => `${i.grau}:${i.origem}`)
      .sort()
      .join(","),
  ].join("|");
  const h = createHash("sha256").update(material).digest("hex").slice(0, 8).toUpperCase();
  return `RJ-${ANO_PROCESSO}-${h}`;
}

/**
 * Aquece o motor: decodifica a fila de 2025 e calcula a rodada base, deixando
 * tudo em memória da instância.
 *
 * O primeiro POST numa instância fria paga a decodificação de 72 mil inscrições
 * mais a rodada inteira — uns 6 s. O formulário chama este GET quando a família
 * chega na tela de conferência das bases, então o envio já encontra a instância
 * quente. Não é truque de demo: é a mesma coisa que um `warmup` de qualquer
 * serviço que carrega índice na subida.
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

  /**
   * Erro com destino.
   *
   * Cada erro carrega o passo a que pertence, para que a tela de revisão possa
   * transformá-lo num link que leva ao campo. A mensagem antiga — "Volte à
   * primeira etapa: falta o nascimento ou o horário" — pedia que o usuário
   * resolvesse a navegação sozinho.
   */
  const erros: { campo: string; mensagem: string }[] = [];
  const erro = (campo: string, mensagem: string) => erros.push({ campo, mensagem });

  // ── consentimento ────────────────────────────────────────────────────
  if (!corpo.consentimento?.comum) {
    erro("consentimento", "É preciso autorizar a consulta aos sistemas do governo para continuar.");
  }

  // ── chave da criança ─────────────────────────────────────────────────
  const cpfCrianca = (corpo.cpfCrianca ?? "").replace(/\D/g, "");
  const dnv = (corpo.dnvCrianca ?? "").replace(/\D/g, "");
  if (cpfCrianca) {
    if (!cpfValido(cpfCrianca)) erro("crianca", "O CPF da criança não é válido. Confira os 11 dígitos.");
  } else if (dnv) {
    if (dnv.length !== 11) erro("crianca", "A Declaração de Nascido Vivo tem 11 dígitos.");
  } else {
    erro("crianca", "Informe o CPF da criança, ou a Declaração de Nascido Vivo.");
  }

  // ── nascimento e turma ───────────────────────────────────────────────
  const nascimento = (corpo.nascimento ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(nascimento)) {
    erro("crianca", "Informe o mês e o ano de nascimento da criança.");
  }
  const grupamento = /^\d{4}-\d{2}$/.test(nascimento) ? grupamentoPorNascimento(nascimento, ANO_PROCESSO) : null;
  if (nascimento && !grupamento) {
    erro(
      "crianca",
      "Pela data informada, a criança não se enquadra em creche neste processo: a vaga de creche vai até 3 anos incompletos em 31 de março.",
    );
  }

  // ── horário ──────────────────────────────────────────────────────────
  const horario = (corpo.horario ?? "") as Horario;
  if (!HORARIOS.includes(horario)) erro("horario", "Escolha o horário de que a família precisa.");

  // ── creches ──────────────────────────────────────────────────────────
  const opcoes = Array.isArray(corpo.opcoes) ? corpo.opcoes.map(Number).filter(Number.isFinite) : [];
  if (opcoes.length === 0) erro("creches", "Escolha ao menos uma creche.");
  if (opcoes.length > MAX_OPCOES) erro("creches", `São permitidas no máximo ${MAX_OPCOES} escolhas.`);
  if (new Set(opcoes).size !== opcoes.length) erro("creches", "Há creches repetidas na sua lista.");

  if (grupamento && HORARIOS.includes(horario)) {
    for (const codigo of opcoes) {
      const u = unidadePorCodigo(codigo);
      if (!u) {
        erro("creches", `Unidade ${codigo} não existe no catálogo do processo.`);
        continue;
      }
      const tem = u.assentos.some((a) => a.grupamento === grupamento && a.horario === horario && a.capacidade > 0);
      if (!tem) erro("creches", `${u.nome} não oferece ${grupamento} em ${horario.toLowerCase()} neste processo.`);
    }
  }

  const opcaoMantida = Number.isFinite(corpo.opcaoMantida) ? Number(corpo.opcaoMantida) : 1;
  if (opcoes.length > 0 && (opcaoMantida < 1 || opcaoMantida > opcoes.length)) {
    erro("creches", `A opção mantida na lista de espera precisa estar entre 1 e ${opcoes.length}.`);
  }

  // ── contato ──────────────────────────────────────────────────────────
  // A vaga pode sair 13 meses depois da inscrição, e 44,1% das opções de 2025
  // morreram como "cancelado pelo sistema". Sem número que atenda, a vaga não
  // chega — então o celular é obrigatório, e a verificação é do fluxo.
  const celular = (corpo.contato?.celular ?? "").replace(/\D/g, "");
  if (celular.length < 10 || celular.length > 11) {
    erro("contato", "Informe um celular com DDD para avisarmos quando sair a vaga.");
  }

  // ── graus da régua ───────────────────────────────────────────────────
  //
  // Grau inexistente e origem não admitida pelo grau são descartados, não
  // aceitos em silêncio: é o que impede uma declaração de comprar o grau de 10
  // pontos do bloco de cuidado, que exige aferição.
  const itens: ItemDeclarado[] = [];
  for (const i of Array.isArray(corpo.itens) ? corpo.itens : []) {
    const achado = grauPorId(String(i?.grau ?? ""));
    const origem = i?.origem as Origem;
    if (!achado || !ORIGENS.includes(origem)) continue;
    if (!achado.grau.origens.includes(origem)) {
      erro(
        "pontuacao",
        `O critério "${achado.grau.rotulo}" não pode entrar como ${origem}: esse grau exige confirmação em base ou por serviço público.`,
      );
      continue;
    }
    itens.push({ grau: achado.grau.id, origem });
  }

  // Sem a autorização de dado sensível, os blocos de proteção, risco,
  // deficiência e saúde não podem ser considerados — e a tela diz isso antes.
  const itensFiltrados = corpo.consentimento?.sensivel
    ? itens
    : itens.filter((i) => {
        const bloco = grauPorId(i.grau)?.bloco.numero;
        return bloco !== 2 && bloco !== 3;
      });

  const desempatesValidos = new Set(catalogo.criterios.filter((c) => c.desempate).map((c) => c.pergId));
  const desempates = (Array.isArray(corpo.desempates) ? corpo.desempates.map(Number) : []).filter((p) =>
    desempatesValidos.has(p),
  );

  if (erros.length > 0) {
    return NextResponse.json({ erros: erros.map((e) => e.mensagem), errosPorCampo: erros }, { status: 422 });
  }

  const inscricao: InscricaoViva = {
    protocolo:
      corpo.protocolo && /^RJ-\d{4}-[0-9A-F]{8}$/.test(corpo.protocolo) ? corpo.protocolo : geraProtocolo(corpo),
    grupamento: grupamento as string,
    horario,
    opcoes,
    itens: itensFiltrados,
    desempates,
    bairro: bairroCanonico(corpo.bairro),
    opcaoMantida,
  };

  const resumo = resumoDaInscricao(inscricao);

  /**
   * O que falta comprovar, por grau.
   *
   * A lista de documentos aceitos vai para a tela; o grau que cada documento
   * sustenta **não**. Dizer "com medida protetiva: 25 pontos · com relatório do
   * CREAS: 20" transformaria a comprovação em compra de pontuação e mandaria a
   * família buscar o documento mais caro de obter — justamente na trilha em que
   * a barreira documental já é o problema.
   */
  const comprovacoes = resumo.pontuacao.pendentes
    .filter((i) => !i.suprimidoPeloTeto)
    .map((i) => ({
      grau: i.grau,
      rotulo: i.rotulo,
      bloco: grauPorId(i.grau)?.bloco.nome ?? "",
      documentos: DOCUMENTOS_POR_GRAU[i.grau] ?? ["Consulte o ponto de atendimento sobre o documento aceito"],
      estado: "falta_enviar" as const,
    }));

  return NextResponse.json({
    inscricao: {
      ...inscricao,
      aceitaOutroTurno: Boolean(corpo.aceitaOutroTurno),
      contato: { celular, whatsapp: Boolean(corpo.contato?.whatsapp), canal: corpo.contato?.canal ?? "WhatsApp" },
    },
    resumo,
    comprovacoes,
    regua: { versao: REGUA_VERSAO, vigenciaProcessos: REGUA_VIGENCIA_PROCESSOS },
    parametros: {
      maxOpcoes: MAX_OPCOES,
      listaDeEspera: parametros.listaDeEspera,
      rodada: parametros.rodada,
      posicaoAoVivo: parametros.posicaoAoVivo,
    },
  });
}
