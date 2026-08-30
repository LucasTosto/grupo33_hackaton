/**
 * Camada de dados do servidor: carrega as sementes extraídas das bases da SME e
 * monta as entradas da rodada.
 *
 * A fila de 2025 inteira (71.949 inscrições) fica em memória do servidor e nunca
 * é enviada ao cliente. A rodada é calculada sob demanda e memoizada por hash de
 * entrada, então uma inscrição nova custa uma rodada, não uma por requisição.
 */

import "server-only";

import backtestJson from "./data/backtest.json";
import catalogoJson from "./data/catalogo-2025.json";
import desempateJson from "./data/desempate.json";
import parametrosJson from "./data/parametros-195.json";
import fatosJson from "./data/fatos.json";
import filaJson from "./data/fila-2025.json";
import unidadesJson from "./data/unidades.json";
import {
  alocar,
  assentoId,
  cascataDeVaga,
  decodificaAssento,
  inserirCandidato,
  verificarEstabilidade,
  type Assento,
  type AssentoId,
  type Candidato,
  type Horario,
  type ParametrosRodada,
  type ResultadoRodada,
  type Violacao,
} from "./engine/index.ts";
import {
  agrupaPorCrianca,
  decodificaFila,
  type FilaCompacta,
  type InscricaoHistorica,
} from "./fila.ts";
import { bairroCanonico, geoAproximada } from "./bairros.ts";
import {
  calcula,
  equivalenteNaFila2025,
  PONTUACAO_MAXIMA,
  REGUA_VERSAO,
  REGUA_VIGENCIA_PROCESSOS,
  type ItemDeclarado,
  type Pontuacao,
} from "./regua.ts";

// ───────────────────────────────────────────────────────────────── tipos

export interface AssentoUnidade {
  grupamento: string;
  horario: Horario;
  /** Vagas que o motor pode ofertar: o que a rede de fato preencheu em 2025. */
  capacidade: number;
  /** Opções que apontaram para este assento no processo de 2025. */
  procura: number;
  /** Alunos na planilha de matrícula, incluindo renovações automáticas. */
  matriculados2025: number;
  /** Assentos que ficaram reservados em algum momento, inclusive os congelados. */
  assentosReservados2025: number;
  /** Turmas registradas no consolidado de 2025. */
  turmas2025?: number;
  /** Alunos no consolidado de 2025. */
  alunos2025?: number;
  /** `turmas × lotação de referência − alunos`. Referência observada, ajustável. */
  vagaEstimada?: number;
}

export interface Unidade {
  codigo: number;
  nome: string;
  nomeOriginal: string;
  bairro: string | null;
  rua: string | null;
  cre: number | null;
  microarea: string | null;
  lat: number | null;
  lng: number | null;
  tipo: string | null;
  assentos: AssentoUnidade[];
}

export interface Criterio {
  pergId: number;
  ichPergId: number;
  ordem: number;
  texto: string;
  pontos: number;
  desempate: boolean;
}

export interface Catalogo {
  processoId: number;
  ano: number;
  versao: string;
  fonte: string;
  pontuacaoMaxima: number;
  criterios: Criterio[];
}

export const unidades = unidadesJson as unknown as Unidade[];
export const catalogo = catalogoJson as unknown as Catalogo;
export const fatos = fatosJson as unknown as Fatos;

export interface Fatos {
  processo: { prmId: number; ano: number };
  inscricoes: number;
  linhasOpcao: number;
  criancas: number;
  unidadesProcuradas: number;
  declararamCriterio: number;
  declararamCriterioPct: number;
  comprovaramCriterio: number;
  comprovaramCriterioPct: number;
  empatadosEmZero: number;
  empatadosEmZeroPct: number;
  ofertasSimultaneas: {
    criancasOfertadas: number;
    criancasComMaisDeUmaOferta: number;
    assentosRetidos: number;
  };
  taxaPorOpcao: { opcao: number; linhas: number; taxaConfirmado: number }[];
  foraDoBairroPorOpcao: { opcao: number; foraDoBairro: number }[];
  fonte: string;
}

/** Semente do processo. Em produção seria publicada no D.O. antes da rodada. */
export const SEMENTE = process.env.SEMENTE_SORTEIO ?? "D.O.-RIO-2025-08-30-processo-195";

// ──────────────────────────────────────────────────── vetor de desempate

export interface NivelDesempate {
  nivel: number;
  chave: string;
  rotulo: string;
  sentido: "maior_primeiro" | "menor_primeiro";
  ativo: boolean;
  pergIds?: number[];
  bloqueio?: string;
  parametros?: Record<string, unknown>;
  observacao?: string;
}

export interface VetorDesempate {
  versao: string;
  processoId: number;
  ano: number;
  fonte: string;
  instrumentoNormativo: { proximidade: string; observacao: string };
  vetor: NivelDesempate[];
  niveisImplementados: string[];
}

export const desempate = desempateJson as unknown as VetorDesempate;

export interface Parametros {
  versao: string;
  processoId: number;
  ano: number;
  fonte: string;
  escolha: { maxOpcoes: number; justificativa: string; anterior: number };
  listaDeEspera: { modo: string; padrao: string; justificativa: string };
  rodada: {
    diaDaSemana: number;
    diaDaSemanaRotulo: string;
    janelaManifestacaoDias: number;
    prazoRotulo: string;
    justificativa: string;
  };
  vacancia: {
    lotacaoDeReferencia: number;
    lotacaoAjustavel: boolean;
    rotulo: string;
    formula: string;
    advertencia: string;
  };
  posicaoAoVivo: {
    exibir: boolean;
    formato: string;
    larguraFaixaPct: number;
    exibirEmTodasAsOpcoes: boolean;
    janelaEstabilizacaoDias: number;
    textoDaMecanica: string;
  };
}

/** Parâmetros do processo como dado versionado, não constantes de código. */
export const parametros = parametrosJson as unknown as Parametros;

/** Nº máximo de opções. 3 no processo 195, contra 5 do desenho anterior. */
export const MAX_OPCOES = parametros.escolha.maxOpcoes;

/** Meia-largura da faixa de posição, em %. Constante à parte porque dentro de
 *  `resumoDaInscricao` o nome `parametros` é o da rodada, não o do processo. */
const LARGURA_FAIXA_PCT = parametros.posicaoAoVivo.larguraFaixaPct;

/**
 * O vetor de desempate é parâmetro versionado, não código.
 *
 * O instrumento normativo que institui a proximidade como desempate está a
 * confirmar. Deixar a sequência num arquivo com vigência e versão significa que
 * a confirmação, quando vier, é mudança de dado — não de deploy. E significa que
 * nada aqui fica travado esperando resposta: o nível existe, declarado e
 * inativo, com o motivo do bloqueio registrado.
 *
 * A validação abaixo é deliberadamente ruidosa. Marcar como ativo um nível que
 * o motor não implementa produziria uma rodada silenciosamente errada — que é
 * pior do que uma rodada que não roda.
 */
function validaVetor(v: VetorDesempate): NivelDesempate[] {
  const implementados = new Set(v.niveisImplementados);
  const ativos = v.vetor.filter((n) => n.ativo).sort((a, b) => a.nivel - b.nivel);

  for (const n of ativos) {
    if (!implementados.has(n.chave)) {
      throw new Error(
        `vetor de desempate v${v.versao}: o nível "${n.chave}" está marcado como ativo mas não é ` +
          `implementado pelo motor. Implemente-o ou volte "ativo" para false. ` +
          `Motivo registrado do bloqueio: ${n.bloqueio ?? "não informado"}.`,
      );
    }
  }

  const criterios = ativos.find((n) => n.chave === "criterios_resolucao");
  if (criterios && !criterios.pergIds?.length) {
    throw new Error(`vetor de desempate v${v.versao}: nível "criterios_resolucao" sem pergIds.`);
  }
  return ativos;
}

const NIVEIS_ATIVOS = validaVetor(desempate);

/** Níveis declarados mas não em vigor, com o motivo. Vai para o painel e o D.O. */
export const NIVEIS_INATIVOS = desempate.vetor
  .filter((n) => !n.ativo)
  .map((n) => ({ chave: n.chave, rotulo: n.rotulo, bloqueio: n.bloqueio ?? "não informado" }));

/**
 * Ordem de precedência dos critérios de desempate da Resolução.
 *
 * Vem do vetor versionado, conferida contra o catálogo: se o arquivo listar um
 * pergId que o catálogo não marca como critério de desempate, é erro de
 * parametrização e não deve virar rodada.
 */
export const ORDEM_DESEMPATE: number[] = (() => {
  const nivel = NIVEIS_ATIVOS.find((n) => n.chave === "criterios_resolucao");
  const doVetor = nivel?.pergIds ?? [];
  const noCatalogo = new Set(catalogo.criterios.filter((c) => c.desempate).map((c) => c.pergId));
  for (const p of doVetor) {
    if (!noCatalogo.has(p)) {
      throw new Error(
        `vetor de desempate v${desempate.versao}: pergId ${p} não é critério de desempate no ` +
          `catálogo v${catalogo.versao}.`,
      );
    }
  }
  return doVetor;
})();

/** Sequência em vigor, para exibir na tela e no documento publicado. */
export const SEQUENCIA_DESEMPATE = NIVEIS_ATIVOS.map((n) => n.rotulo);

/**
 * A lacuna entre declarar e aparecer com pontuação.
 *
 * O denominador é o total de inscrições do processo, não o subconjunto que
 * declarou. Dito sobre os declarantes o número seria 90,9%, e não 62% — a
 * distinção importa porque este é um número que vai a público.
 *
 * O que ele mede é o que a extração expõe, não a causa. Ver a ressalva que
 * acompanha toda exibição dele.
 */
export const LACUNA_COMPROVACAO = {
  inscricoes: fatosJson.declararamCriterio - fatosJson.comprovaramCriterio,
  pctDoTotal:
    Math.round((1000 * (fatosJson.declararamCriterio - fatosJson.comprovaramCriterio)) / fatosJson.inscricoes) / 10,
  pctDosDeclarantes:
    Math.round((1000 * (fatosJson.declararamCriterio - fatosJson.comprovaramCriterio)) / fatosJson.declararamCriterio) /
    10,
};

export const GRUPAMENTOS = ["Berçário", "Maternal I", "Maternal II"] as const;
export const HORARIOS: Horario[] = ["Integral", "Parcial"];

// ─────────────────────────────────────────────────────── assentos da rede

let _assentos: Assento[] | null = null;

export function assentosDaRede(): Assento[] {
  if (_assentos) return _assentos;
  const lista: Assento[] = [];
  for (const u of unidades) {
    for (const a of u.assentos) {
      lista.push({
        id: assentoId(u.codigo, a.grupamento, a.horario),
        unidade: u.codigo,
        grupamento: a.grupamento,
        horario: a.horario,
        capacidade: a.capacidade,
      });
    }
  }
  _assentos = lista;
  return lista;
}

let _porCodigo: Map<number, Unidade> | null = null;

export function unidadePorCodigo(codigo: number): Unidade | undefined {
  if (!_porCodigo) _porCodigo = new Map(unidades.map((u) => [u.codigo, u]));
  return _porCodigo.get(codigo);
}

/** Unidades que oferecem o assento pedido, para o seletor do formulário. */
export function unidadesComAssento(grupamento: string, horario: Horario): Unidade[] {
  return unidades.filter((u) => u.assentos.some((a) => a.grupamento === grupamento && a.horario === horario));
}

// ───────────────────────────────────────────────────────── fila histórica

let _fila: Candidato[] | null = null;
let _inscricoes: InscricaoHistorica[] | null = null;

/**
 * `ichPergId` → `pergId` nos critérios de desempate da fila histórica.
 *
 * A extração grava em `desempates` o `ich_perg_id` da base (286, 287), enquanto
 * o vetor de desempate e o catálogo falam em `pergId` (29, 30). Sem a tradução
 * o nível 2 do desempate — irmão matriculado, depois responsável menor de 18 —
 * não casava com candidato nenhum da fila histórica: a comparação era feita
 * contra um conjunto vazio e o desempate caía direto no sorteio, em silêncio.
 */
const PERG_POR_ICH = new Map(catalogo.criterios.map((c) => [c.ichPergId, c.pergId]));

function inscricoesHistoricas(): InscricaoHistorica[] {
  if (_inscricoes) return _inscricoes;
  const cru = decodificaFila(filaJson as unknown as FilaCompacta);
  for (const i of cru) i.desempates = i.desempates.map((d) => PERG_POR_ICH.get(d) ?? d);
  _inscricoes = cru;
  return _inscricoes;
}

/**
 * Fila real de 2025, agrupada por criança.
 *
 * `pontos` é a pontuação **comprovada** — é ela que classifica, e é por isso que
 * 93,8% da fila entra empatada em zero. O agrupamento por criança é o que impede
 * que quem se inscreveu em dois polos concorra duas vezes.
 */
export function filaHistorica(): Candidato[] {
  if (_fila) return _fila;
  _fila = comProximidade(agrupaPorCrianca(inscricoesHistoricas()));
  return _fila;
}

/** Nível de proximidade em vigor? Vem do vetor versionado. */
export const USA_PROXIMIDADE = desempate.vetor.some((n) => n.chave === "proximidade" && n.ativo);

/**
 * Anexa a proximidade a cada preferência: `f = d_min / d`.
 *
 * A razão vale 1 na creche mais próxima da criança, esteja ela a 300 m ou a 3 km.
 * Medir em metros absolutos penalizaria em toda a cidade quem mora onde há pouca
 * oferta — justamente os territórios de maior demanda.
 *
 * `d_min` é tomado sobre as opções que a própria criança listou, e não sobre a
 * rede inteira. É desvio consciente da especificação: normaliza dentro do
 * conjunto de escolha, custa 160 mil distâncias em vez de 44 milhões, e preserva
 * a propriedade que interessa — a razão é relativa, não absoluta.
 *
 * Quem não informou bairro (2,8% da base) fica sem proximidade e cai direto no
 * sorteio, que é o comportamento anterior.
 */
function comProximidade(candidatos: Candidato[]): Candidato[] {
  if (!USA_PROXIMIDADE) return candidatos;

  const bairroDe = new Map<string, string | null>();
  for (const i of inscricoesHistoricas()) {
    if (!bairroDe.has(i.aluno)) bairroDe.set(i.aluno, i.bairro);
  }
  const centros = centroidesDeBairro();

  for (const c of candidatos) {
    const bairro = bairroCanonico(bairroDe.get(c.id));
    const centro = bairro ? centros.get(bairro) : undefined;
    if (!centro) continue;

    const dist: number[] = [];
    for (const p of c.preferencias) {
      const u = unidadePorCodigo(Number(p.assento.split("|")[0]));
      dist.push(u && u.lat !== null && u.lng !== null ? distanciaKm(centro, { lat: u.lat, lng: u.lng }) : NaN);
    }
    const validas = dist.filter((d) => Number.isFinite(d) && d > 0);
    if (validas.length === 0) continue;
    const dMin = Math.min(...validas);

    c.preferencias.forEach((p, i) => {
      const d = dist[i];
      if (Number.isFinite(d) && d > 0) p.proximidade = Math.min(1, dMin / d);
    });
  }
  return candidatos;
}

/** Quantas inscrições geraram a fila de crianças. */
export function totalInscricoesHistoricas(): number {
  return inscricoesHistoricas().length;
}

// ─────────────────────────────────────────────────────────────── rodada

export interface InscricaoViva {
  protocolo: string;
  grupamento: string;
  horario: Horario;
  /** Códigos de unidade em ordem de preferência. */
  opcoes: number[];
  /**
   * Graus da régua atribuídos a esta inscrição, com a origem de cada um.
   *
   * Substituiu a lista de `pergId` da régua de 2025. Não era uma troca de
   * nomes: os blocos 2, 3 e 4 da régua nova têm três e quatro graus cada, e um
   * booleano por critério não representa mais o critério. E a origem passou a
   * ser parte do dado, porque é ela que decide se o ponto ordena a fila.
   */
  itens: ItemDeclarado[];
  /** `pergId` dos critérios de desempate atendidos: irmão, responsável menor de 18. */
  desempates?: number[];
  bairro?: string | null;
  /**
   * Qual opção fica na lista de espera se a criança for alocada fora dela.
   * 1 = primeira. A família escolhe; o padrão é a 1ª.
   */
  opcaoMantida?: number;
}

/**
 * Candidato do motor a partir da inscrição, pela régua nova.
 *
 * `pontos` recebe **só os confirmados** — o que foi aferido em base ou atestado
 * por serviço público. Ponto declarado e não confirmado fica fora da ordenação,
 * e é o que permite adotar a régua nova antes de a aferição estar completa: com
 * critérios de risco valendo 10 a 25 pontos, deixar a autodeclaração ordenar a
 * fila amplificaria um sinal que se contradiz entre processos em 80% a 92% dos
 * casos — pior do que não mudar nada.
 *
 * A conversão para a escala de 2025 existe porque a fila histórica não pode ser
 * reclassificada (ver `equivalenteNaFila2025`), e é o único ponto do sistema em
 * que as duas réguas se encontram.
 */
export function candidatoDeInscricao(i: InscricaoViva): Candidato {
  const pontuacao = calcula(i.itens);
  return {
    id: i.protocolo,
    pontos: equivalenteNaFila2025(pontuacao.confirmados),
    desempates: [...(i.desempates ?? [])],
    preferencias: i.opcoes.map((codigo, idx) => ({
      ordem: idx + 1,
      assento: assentoId(codigo, i.grupamento, i.horario),
    })),
  };
}

export interface RodadaCompleta {
  resultado: ResultadoRodada;
  violacoes: Violacao[];
  duracaoMs: number;
  /** Prioridade de cada candidato dentro do seu assento, para mostrar a posição. */
  parametros: ParametrosRodada;
}

/**
 * A rodada base do processo de 2025, calculada uma vez por instância.
 *
 * Uma inscrição nova não gera outra rodada: ela é inserida de forma incremental
 * sobre esta (ver `resumoDaInscricao`), o que dá o mesmo resultado e custa
 * milissegundos. Guardar uma rodada só também mantém a memória previsível —
 * cada uma carrega ~48 mil alocações.
 */
let _rodadaBase: RodadaCompleta | null = null;

export function rodada(): RodadaCompleta {
  if (_rodadaBase) return _rodadaBase;

  const parametros: ParametrosRodada = {
    candidatos: filaHistorica(),
    assentos: assentosDaRede(),
    semente: SEMENTE,
    catalogoVersao: catalogo.versao,
    ordemDesempate: ORDEM_DESEMPATE,
    usarProximidade: USA_PROXIMIDADE,
  };

  const t0 = performance.now();
  const resultado = alocar(parametros);
  const duracaoMs = Math.round(performance.now() - t0);

  // A verificação de estabilidade acompanha a rodada, não fica só nos testes: é
  // a evidência que o órgão de controle recebe junto com o resultado publicado.
  const violacoes = verificarEstabilidade(parametros, resultado);

  _rodadaBase = { resultado, violacoes, duracaoMs, parametros };
  return _rodadaBase;
}

// ────────────────────────────────────────────────── leitura para a família

export interface PosicaoNaFila {
  assento: AssentoId;
  unidade: Unidade | undefined;
  grupamento: string;
  horario: Horario;
  ordemPreferencia: number;
  capacidade: number;
  /** Quantos candidatos com prioridade maior disputam este assento. */
  aFrente: number;
  concorrentes: number;
  alocado: boolean;
  /**
   * Faixa de posição estimada, não número cravado.
   *
   * Número exato cria falsa precisão e é o que gera sensação de traição quando a
   * posição se move. A faixa comunica a incerteza real.
   */
  faixa: { de: number; ate: number };
}

export interface ResumoInscricao {
  protocolo: string;
  /**
   * Decomposição por bloco, com o teto visível e a separação entre o que já
   * conta e o que passa a contar quando o documento for aceito. É o que a tela
   * da pontuação renderiza — recalcular no cliente convida a divergência.
   */
  pontuacao: Pontuacao;
  /** Pontos que ordenam a fila. Igual a `pontuacao.confirmados`. */
  pontos: number;
  pontuacaoMaxima: number;
  reguaVersao: string;
  reguaVigenciaProcessos: number;
  desempates: number[];
  /**
   * Nenhum critério, em nenhum bloco. Não é tela de fracasso: a inscrição vale,
   * concorre, e o desempate passa a ser proximidade e sorteio auditável.
   */
  semCriterio: boolean;
  convite: PosicaoNaFila | null;
  filaDeMelhoria: PosicaoNaFila[];
  rodadaId: string;
  duracaoMs: number;
  totalCandidatos: number;
  /**
   * Crianças que a entrada desta inscrição remanejou para a opção seguinte
   * delas. Fica visível de propósito: é o custo real de uma inscrição a mais, e
   * esconder isso seria esconder o funcionamento da fila.
   */
  remanejadas: number;
  propostasAvaliadas: number;
  /** Opção que fica na lista de espera, escolhida pela família. */
  opcaoMantida: number;
  /** Frase que a família lê, e que o órgão de controle pode conferir. */
  explicacao: string;
}

export function resumoDaInscricao(insc: InscricaoViva): ResumoInscricao {
  const base = rodada();
  const eu = candidatoDeInscricao(insc);
  const pontuacao = calcula(insc.itens);

  // Inserção incremental sobre a rodada base: mesma alocação que reprocessar as
  // 62.899 crianças (há teste provando a equivalência), em milissegundos.
  const parametros: ParametrosRodada = {
    ...base.parametros,
    candidatos: [...base.parametros.candidatos, eu],
  };
  const t0 = performance.now();
  const ins = inserirCandidato(parametros, base.resultado.alocacoes, insc.protocolo);
  const duracaoMs = Math.round((performance.now() - t0) * 100) / 100;

  const minha = ins.assento !== null && ins.ordem !== null
    ? { candidato: insc.protocolo, assento: ins.assento, ordemPreferencia: ins.ordem }
    : null;
  const capacidadeDe = new Map(parametros.assentos.map((a) => [a.id, a.capacidade]));

  // Quantos candidatos disputam cada assento das minhas opções, e quantos deles
  // estão à minha frente na régua da Resolução.
  const disputa = new Map<AssentoId, { total: number; aFrente: number }>();
  const meusAssentos = new Set(eu.preferencias.map((p) => p.assento));
  for (const a of meusAssentos) disputa.set(a, { total: 0, aFrente: 0 });

  for (const c of parametros.candidatos) {
    if (c.id === insc.protocolo) continue;
    for (const p of c.preferencias) {
      const d = disputa.get(p.assento);
      if (!d) continue;
      d.total++;
      // Comparação pela mesma régua do motor: pontos, depois desempates.
      if (c.pontos > eu.pontos) d.aFrente++;
      else if (c.pontos === eu.pontos && c.desempates.length > eu.desempates.length) d.aFrente++;
    }
  }

  const posicao = (assento: AssentoId, ordem: number, alocado: boolean): PosicaoNaFila => {
    const d = disputa.get(assento) ?? { total: 0, aFrente: 0 };
    const [uni] = assento.split("|");
    const meio = d.aFrente + 1;
    const meia = Math.max(1, Math.round((meio * LARGURA_FAIXA_PCT) / 100));
    return {
      faixa: { de: Math.max(1, meio - meia), ate: meio + meia },
      assento,
      unidade: unidadePorCodigo(Number(uni)),
      grupamento: insc.grupamento,
      horario: insc.horario,
      ordemPreferencia: ordem,
      capacidade: capacidadeDe.get(assento) ?? 0,
      aFrente: d.aFrente,
      concorrentes: d.total,
      alocado,
    };
  };

  const convite = minha ? posicao(minha.assento, minha.ordemPreferencia, true) : null;

  /**
   * Lista de espera: uma opção só, escolhida pela família.
   *
   * Guardar todas as opções melhores é mais generoso, mas gera cascatas longas e
   * uma regra que não cabe em frase de edital. Guardar sempre a 1ª cria incentivo
   * perverso: quem vê que é 200º na creche que quer move algo alcançável para o
   * topo e perde a desejada em definitivo. Deixar a família escolher preserva a
   * simplicidade sem criar o incentivo.
   */
  const mantida = Math.max(1, Math.min(insc.opcaoMantida ?? 1, eu.preferencias.length));
  const limite = minha ? minha.ordemPreferencia : Number.POSITIVE_INFINITY;
  const filaDeMelhoria = eu.preferencias
    .filter((p) => p.ordem === mantida && p.ordem < limite)
    .map((p) => posicao(p.assento, p.ordem, false));

  const explicacao = convite
    ? `Convite na ${convite.ordemPreferencia}ª opção. Todas as crianças à frente na fila desta vaga já haviam sido alocadas.`
    : "Nenhuma das opções escolhidas tem vaga disponível nesta rodada. A inscrição permanece na fila e é reavaliada automaticamente a cada vaga liberada.";

  return {
    protocolo: insc.protocolo,
    pontuacao,
    pontos: pontuacao.confirmados,
    pontuacaoMaxima: PONTUACAO_MAXIMA,
    reguaVersao: REGUA_VERSAO,
    reguaVigenciaProcessos: REGUA_VIGENCIA_PROCESSOS,
    desempates: eu.desempates,
    semCriterio: pontuacao.blocos.length === 0,
    convite,
    filaDeMelhoria,
    rodadaId: base.resultado.rodadaId,
    duracaoMs,
    totalCandidatos: parametros.candidatos.length,
    remanejadas: ins.deslocamentos.filter((d) => d.assentoNovo !== null).length,
    propostasAvaliadas: ins.propostas,
    opcaoMantida: mantida,
    explicacao,
  };
}

// ────────────────────────────────────────────────────────── rodada contínua

export interface EloDaCascata {
  passo: number;
  candidato: string;
  unidade: string;
  bairro: string | null;
  grupamento: string;
  horario: string;
  ordemRecebida: number;
  ordemAnterior: number | null;
  unidadeAnterior: string | null;
  disputavam: number;
  /** Frase pronta para a tela e para o log de auditoria. */
  descricao: string;
}

export interface VagaLiberada {
  assento: AssentoId;
  unidade: string;
  bairro: string | null;
  grupamento: string;
  horario: string;
  /** Criança cuja desistência abriu a vaga. */
  desistente: string;
  elos: EloDaCascata[];
  /** Assento que sobrou no fim da cadeia, se sobrou. */
  assentoOcioso: { unidade: string; grupamento: string; horario: string } | null;
  candidatosAvaliados: number;
  duracaoMs: number;
  /** Quantas crianças a rede teria que reprocessar sem a cascata. */
  filaCompleta: number;
}

function nomeDoAssento(id: AssentoId) {
  const { unidade, grupamento, horario } = decodificaAssento(id);
  const u = unidadePorCodigo(unidade);
  return { nome: u?.nome ?? String(unidade), bairro: u?.bairro ?? null, grupamento, horario };
}

/**
 * Simula uma desistência e mostra a cadeia que ela dispara.
 *
 * É o cenário que mais custa hoje: uma vaga liberada em março, e semanas de
 * telefonema até alguém ocupá-la. O motor resolve a cadeia inteira sobre o fecho
 * da cascata — algumas centenas de candidatos avaliados em vez das 62.899
 * crianças da fila.
 */
export function simulaVagaLiberada(assento: AssentoId): VagaLiberada | null {
  const base = rodada();
  const ocupantes = base.resultado.alocacoes.filter((a) => a.assento === assento);
  if (ocupantes.length === 0) return null;

  // Quem desiste é o último ocupante da lista — o de menor prioridade no assento.
  const desistente = ocupantes[ocupantes.length - 1];
  const restantes = base.resultado.alocacoes.filter((a) => a.candidato !== desistente.candidato);

  // Quem desistiu saiu do processo: se continuasse entre os candidatos, a cascata
  // o veria como alguém sem assento querendo aquela vaga — e ele a retomaria na hora.
  const parametros: ParametrosRodada = {
    ...base.parametros,
    candidatos: base.parametros.candidatos.filter((c) => c.id !== desistente.candidato),
  };

  const c = cascataDeVaga(parametros, restantes, assento);
  const info = nomeDoAssento(assento);

  const elos: EloDaCascata[] = c.movimentos.map((m) => {
    const rec = nomeDoAssento(m.assentoRecebido);
    const ant = m.assentoLiberado ? nomeDoAssento(m.assentoLiberado) : null;
    return {
      passo: m.passo,
      candidato: m.candidato,
      unidade: rec.nome,
      bairro: rec.bairro,
      grupamento: rec.grupamento,
      horario: rec.horario,
      ordemRecebida: m.ordemRecebida,
      ordemAnterior: m.ordemAnterior,
      unidadeAnterior: ant ? ant.nome : null,
      disputavam: m.disputavam,
      descricao: ant
        ? `sobe da ${m.ordemAnterior}ª para a ${m.ordemRecebida}ª opção e libera ${ant.nome}`
        : `sai da fila de espera para a ${m.ordemRecebida}ª opção`,
    };
  });

  const ocioso = c.assentoOcioso ? nomeDoAssento(c.assentoOcioso) : null;

  return {
    assento,
    unidade: info.nome,
    bairro: info.bairro,
    grupamento: info.grupamento,
    horario: info.horario,
    desistente: desistente.candidato,
    elos,
    assentoOcioso: ocioso
      ? { unidade: ocioso.nome, grupamento: ocioso.grupamento, horario: ocioso.horario }
      : null,
    candidatosAvaliados: c.candidatosAvaliados,
    duracaoMs: c.duracaoMs,
    filaCompleta: parametros.candidatos.length,
  };
}

/** Assentos disputados, bons para demonstrar a cascata (cadeia mais longa). */
export function assentosParaSimular(quantos = 8): {
  assento: AssentoId;
  unidade: string;
  bairro: string | null;
  grupamento: string;
  horario: string;
  vagas: number;
  procura: number;
}[] {
  const lista = [];
  for (const u of unidades) {
    for (const a of u.assentos) {
      if (a.capacidade < 15 || a.procura < a.capacidade * 3) continue;
      lista.push({
        assento: assentoId(u.codigo, a.grupamento, a.horario),
        unidade: u.nome,
        bairro: u.bairro,
        grupamento: a.grupamento,
        horario: a.horario,
        vagas: a.capacidade,
        procura: a.procura,
      });
    }
  }
  lista.sort((x, y) => y.procura / y.vagas - x.procura / x.vagas);
  return lista.slice(0, quantos);
}

// ──────────────────────────────────────────────────────── mapa de vacância

export interface AssentoVacante {
  assento: AssentoId;
  unidade: string;
  bairro: string | null;
  cre: number | null;
  grupamento: string;
  horario: string;
  turmas: number;
  alunos: number;
  /** `turmas × lotação de referência − alunos`. Referência observada, ajustável. */
  vaga: number;
  /** Crianças que listaram este assento e ainda o preferem ao que têm. */
  aguardando: number;
}

export interface Vacancia {
  lotacaoDeReferencia: number;
  rotuloLotacao: string;
  formula: string;
  advertencia: string;
  semFila: { assentos: number; vagas: number; lista: AssentoVacante[] };
  comFila: { assentos: number; vagas: number; aguardando: number; lista: AssentoVacante[] };
  porBairro: { bairro: string; vagas: number; assentos: number }[];
}

let _vacancia: Vacancia | null = null;

/**
 * Onde ainda cabe alguém hoje — e sob que regime a vaga pode ser ocupada.
 *
 * A regra que impede o furo de fila está nos próprios dados: a maior parte das
 * vagas disponíveis não tem ninguém na lista de espera. Vaga sem fila pode ser
 * autoatendimento porque não há fila para furar e a pontuação é irrelevante.
 * Vaga com fila nunca é self-service: o celular mais rápido passaria à frente da
 * maior vulnerabilidade.
 *
 * "Aguardando" usa a mesma semântica da fila de melhoria: a criança listou o
 * assento e ainda o prefere ao que recebeu — ou não recebeu nada.
 */
export function vacancia(): Vacancia {
  if (_vacancia) return _vacancia;

  const base = rodada();
  const ordemDe = new Map<string, number>();
  for (const a of base.resultado.alocacoes) ordemDe.set(a.candidato, a.ordemPreferencia);

  const aguardando = new Map<AssentoId, number>();
  for (const c of base.parametros.candidatos) {
    const minha = ordemDe.get(c.id) ?? Number.POSITIVE_INFINITY;
    for (const p of c.preferencias) {
      if (p.ordem >= minha) continue; // já atendida em opção igual ou melhor
      aguardando.set(p.assento, (aguardando.get(p.assento) ?? 0) + 1);
    }
  }

  const semFila: AssentoVacante[] = [];
  const comFila: AssentoVacante[] = [];
  const porBairro = new Map<string, { vagas: number; assentos: number }>();

  for (const u of unidades) {
    for (const a of u.assentos) {
      const vaga = a.vagaEstimada ?? 0;
      if (vaga <= 0) continue;
      const id = assentoId(u.codigo, a.grupamento, a.horario);
      const fila = aguardando.get(id) ?? 0;
      const item: AssentoVacante = {
        assento: id,
        unidade: u.nome,
        bairro: u.bairro,
        cre: u.cre,
        grupamento: a.grupamento,
        horario: a.horario,
        turmas: a.turmas2025 ?? 0,
        alunos: a.alunos2025 ?? 0,
        vaga,
        aguardando: fila,
      };
      (fila === 0 ? semFila : comFila).push(item);

      if (fila === 0 && u.bairro) {
        const b = porBairro.get(u.bairro) ?? { vagas: 0, assentos: 0 };
        b.vagas += vaga;
        b.assentos += 1;
        porBairro.set(u.bairro, b);
      }
    }
  }

  semFila.sort((a, b) => b.vaga - a.vaga);
  comFila.sort((a, b) => b.aguardando - a.aguardando);

  _vacancia = {
    lotacaoDeReferencia: parametros.vacancia.lotacaoDeReferencia,
    rotuloLotacao: parametros.vacancia.rotulo,
    formula: parametros.vacancia.formula,
    advertencia: parametros.vacancia.advertencia,
    semFila: {
      assentos: semFila.length,
      vagas: semFila.reduce((s, x) => s + x.vaga, 0),
      lista: semFila.slice(0, 40),
    },
    comFila: {
      assentos: comFila.length,
      vagas: comFila.reduce((s, x) => s + x.vaga, 0),
      aguardando: comFila.reduce((s, x) => s + x.aguardando, 0),
      lista: comFila.slice(0, 20),
    },
    porBairro: [...porBairro.entries()]
      .map(([bairro, v]) => ({ bairro, ...v }))
      .sort((a, b) => b.vagas - a.vagas)
      .slice(0, 12),
  };
  return _vacancia;
}

/** Próxima rodada e prazo de manifestação, a partir do calendário parametrizado. */
export function proximaRodada(agora = new Date()): {
  rodada: string;
  prazo: string;
  diaRotulo: string;
  prazoRotulo: string;
  janelaDias: number;
} {
  const alvo = parametros.rodada.diaDaSemana; // 5 = sexta
  const d = new Date(agora);
  const delta = (alvo - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  const prazo = new Date(d);
  prazo.setDate(prazo.getDate() + parametros.rodada.janelaManifestacaoDias);
  const fmt = (x: Date) => x.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return {
    rodada: fmt(d),
    prazo: fmt(prazo),
    diaRotulo: parametros.rodada.diaDaSemanaRotulo,
    prazoRotulo: parametros.rodada.prazoRotulo,
    janelaDias: parametros.rodada.janelaManifestacaoDias,
  };
}

// ─────────────────────────────────────────────────────────────── geografia

/** Haversine. Usada para ordenar as unidades pela distância do endereço. */
export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Centróide de cada bairro, calculado a partir das unidades que ficam nele.
 *
 * A base é anonimizada: o endereço da família sai só como bairro e CEP, sem
 * logradouro. Então não há como geocodificar a casa — e nem deveria haver. O
 * centróide do bairro é a melhor âncora disponível e é suficiente para ordenar
 * as creches por proximidade, que é para o que ele serve aqui.
 *
 * A chave é o **bairro canônico**, não o valor cru da base. Antes desta mudança
 * `Andaraí`, `ANDARAÍ`, `Andaraí - Jamelão` e `Andaraí - Morro do Andaraí` eram
 * quatro centróides distintos, cada um sobre um subconjunto arbitrário das
 * unidades do bairro — e a família que escolhesse a variante "errada" no seletor
 * recebia outra ordenação de creches, sem pista nenhuma de que havia escolhido
 * errado. A canonicalização reduz os 252 valores de bairro do cadastro de
 * unidades a 135 bairros oficiais, sem nenhum valor sem correspondência.
 */
let _bairros: Map<string, { lat: number; lng: number; unidades: number }> | null = null;

export function centroidesDeBairro(): Map<string, { lat: number; lng: number; unidades: number }> {
  if (_bairros) return _bairros;
  const acc = new Map<string, { lat: number; lng: number; unidades: number }>();
  for (const u of unidades) {
    const chave = bairroCanonico(u.bairro);
    if (!chave || u.lat === null || u.lng === null) continue;
    const a = acc.get(chave) ?? { lat: 0, lng: 0, unidades: 0 };
    a.lat += u.lat;
    a.lng += u.lng;
    a.unidades += 1;
    acc.set(chave, a);
  }
  for (const [, a] of acc) {
    a.lat /= a.unidades;
    a.lng /= a.unidades;
  }
  _bairros = acc;
  return acc;
}

/**
 * Bairros oferecidos quando o CEP não resolve.
 *
 * Cada bairro aparece **uma vez**, no nome oficial. As 1.607 variações da base
 * ficam no dicionário de normalização, no servidor: o usuário nunca vê duas
 * grafias do mesmo bairro.
 */
export function listaDeBairros(): string[] {
  return [...centroidesDeBairro().keys()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// ────────────────────────────────────────────── unidades para o formulário

export interface UnidadeEscolha {
  codigo: number;
  nome: string;
  bairro: string | null;
  rua: string | null;
  cre: number | null;
  tipo: string | null;
  /** Vagas deste assento no processo. */
  vagas: number;
  /** Quantas opções apontaram para este assento em 2025. */
  procura: number;
  /** Candidatos por vaga. Métrica de gestão: não vai para a tela da família. */
  concorrencia: number;
  distanciaKm: number | null;
  /** A distância aqui sai do centro da região, não da casa. */
  geoAproximada: boolean;
  /**
   * Crianças à frente na fila deste assento, **contadas só sobre pontuação
   * confirmada**. Mostrar a posição otimista de quem ainda não comprovou é o
   * erro do processo atual com estética melhor: a família escolheria a creche
   * disputada contando com pontos que talvez não se realizem.
   */
  aFrente: number | null;
  /** Semáforo de chance. Sempre acompanhado da palavra, nunca só a cor. */
  chance: "alta" | "media" | "longa" | null;
  /** Posição que a família alcançaria se comprovasse tudo. Sempre abaixo da real. */
  aFrenteSeComprovar: number | null;
}

/** Semáforo a partir da fila à frente e das vagas do assento. */
function chanceDe(aFrente: number, vagas: number): "alta" | "media" | "longa" {
  if (aFrente < vagas) return "alta";
  if (aFrente < vagas * 3) return "media";
  return "longa";
}

/**
 * Unidades que oferecem o assento pedido, com a concorrência real de 2025 e a
 * distância até o bairro informado. Mostrar a concorrência é uma escolha de
 * produto: a família decide melhor sabendo onde a fila é curta, e o motor é à
 * prova de estratégia, então informar não abre brecha para manipulação.
 */
export function unidadesParaEscolha(
  grupamento: string,
  horario: Horario,
  bairroFamilia?: string | null,
  /** Pontuação **confirmada**, para anotar a fila real de cada creche. */
  pontosConfirmados?: number | null,
  /** Confirmados mais o que falta comprovar, para a linha condicional em cinza. */
  pontosComPendentes?: number | null,
): UnidadeEscolha[] {
  const canonico = bairroCanonico(bairroFamilia);
  const centro = canonico ? centroidesDeBairro().get(canonico) : undefined;
  const aproximada = geoAproximada(canonico);

  // A fila à frente por assento sai da rodada base. É uma varredura sobre as
  // ~160 mil preferências da fila, não sobre a matriz criança × assento.
  const filaDe = (pontos: number | null | undefined) => {
    if (pontos === null || pontos === undefined) return null;
    const equivalente = equivalenteNaFila2025(pontos);
    const conta = new Map<AssentoId, number>();
    for (const c of rodada().parametros.candidatos) {
      if (c.pontos <= equivalente) continue;
      for (const pref of c.preferencias) conta.set(pref.assento, (conta.get(pref.assento) ?? 0) + 1);
    }
    return conta;
  };
  const filaReal = filaDe(pontosConfirmados);
  const filaOtimista = pontosComPendentes && pontosComPendentes !== pontosConfirmados ? filaDe(pontosComPendentes) : null;

  const lista: UnidadeEscolha[] = [];
  for (const u of unidades) {
    const a = u.assentos.find((x) => x.grupamento === grupamento && x.horario === horario);
    if (!a || a.capacidade <= 0) continue;
    const d = centro && u.lat !== null && u.lng !== null
      ? Math.round(distanciaKm(centro, { lat: u.lat, lng: u.lng }) * 10) / 10
      : null;
    const id = assentoId(u.codigo, grupamento, horario);
    const aFrente = filaReal ? (filaReal.get(id) ?? 0) : null;
    lista.push({
      codigo: u.codigo,
      nome: u.nome,
      bairro: bairroCanonico(u.bairro),
      rua: u.rua,
      cre: u.cre,
      tipo: u.tipo,
      vagas: a.capacidade,
      procura: a.procura,
      concorrencia: Math.round((a.procura / a.capacidade) * 10) / 10,
      distanciaKm: d,
      geoAproximada: aproximada,
      aFrente,
      chance: aFrente === null ? null : chanceDe(aFrente, a.capacidade),
      aFrenteSeComprovar: filaOtimista ? (filaOtimista.get(id) ?? 0) : null,
    });
  }

  lista.sort((x, y) => {
    if (x.distanciaKm !== null && y.distanciaKm !== null) return x.distanciaKm - y.distanciaKm;
    if (x.distanciaKm !== null) return -1;
    if (y.distanciaKm !== null) return 1;
    return y.vagas - x.vagas;
  });
  return lista;
}

// ─────────────────────────────────────────────────────────────── backtest

export interface Backtest {
  processo: { prmId: number; ano: number };
  fonte: string;
  metodo: string;
  rodada: {
    rodadaId: string;
    hashEntrada: string;
    semente: string;
    catalogoVersao: string;
    inscricoes: number;
    criancas: number;
    assentos: number;
    vagas: number;
    propostas: number;
    duracaoMs: number;
    verificacaoMs: number;
    violacoes: number;
  };
  historico: {
    vagasPreenchidas: number;
    assentosReservados: number;
    reservasSemMatricula: number;
    criancasComMaisDeUmAssento: number;
    assentosTravados: number;
    porOpcao: Record<string, number>;
    primeiraOpcaoPct: number;
  };
  motor: {
    vagasPreenchidas: number;
    criancasAtendidas: number;
    reservasSemMatricula: number;
    criancasComMaisDeUmAssento: number;
    assentosTravados: number;
    semAssento: number;
    porOpcao: Record<string, number>;
    primeiraOpcaoPct: number;
  };
  ganhos: {
    assentosLiberadosDeImediato: number;
    criancasQueDeixamDeReterVaga: number;
    pontosDeAumentoNaPrimeiraOpcao: number;
  };
}

export const backtest = backtestJson as unknown as Backtest;

/** Documentos a levar para comprovar cada critério, por `pergId`. */
export const COMPROVANTES: Record<number, string> = {
  28: "Folha-resumo do CadÚnico atualizada, emitida no CRAS ou pelo app Cadastro Único",
  31: "Laudo médico ou relatório de avaliação da equipe de educação especial",
  6: "Extrato do Bolsa Família ou do Cartão Carioca no nome do responsável",
  17: "Boletim de ocorrência, medida protetiva ou encaminhamento do CREAS",
  20: "Certidão de nascimento da criança e declaração de monoparentalidade",
  18: "Laudo ou relatório médico com CID do familiar",
  25: "Laudo médico ou benefício do INSS do responsável",
  16: "Encaminhamento do CAPS-AD ou relatório de serviço de saúde",
  12: "Atestado de execução penal, alvará de soltura ou declaração do sistema penitenciário",
  23: "Protocolo de refúgio do CONARE ou documento de solicitante de refúgio",
  27: "Nenhum: a SME confere na base do processo anterior",
  29: "Comprovante de matrícula do irmão na rede pública ou parceira",
  30: "Documento de identidade do responsável",
};
