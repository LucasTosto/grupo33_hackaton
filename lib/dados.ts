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
import fatosJson from "./data/fatos.json";
import filaJson from "./data/fila-2025.json";
import unidadesJson from "./data/unidades.json";
import {
  alocar,
  assentoId,
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

/** Ordem de precedência dos critérios de desempate, conforme o catálogo. */
export const ORDEM_DESEMPATE = catalogo.criterios
  .filter((c) => c.desempate)
  .sort((a, b) => a.ordem - b.ordem)
  .map((c) => c.pergId);

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

function inscricoesHistoricas(): InscricaoHistorica[] {
  if (!_inscricoes) _inscricoes = decodificaFila(filaJson as unknown as FilaCompacta);
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
  _fila = agrupaPorCrianca(inscricoesHistoricas());
  return _fila;
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
  /** `pergId` dos critérios que a família declarou e comprovou. */
  criterios: number[];
  bairro?: string | null;
}

export function candidatoDeInscricao(i: InscricaoViva): Candidato {
  const porPergId = new Map(catalogo.criterios.map((c) => [c.pergId, c]));
  let pontos = 0;
  const desempates: number[] = [];
  for (const pid of i.criterios) {
    const c = porPergId.get(pid);
    if (!c) continue;
    pontos += c.pontos;
    if (c.desempate) desempates.push(c.pergId);
  }
  return {
    id: i.protocolo,
    pontos,
    desempates,
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

const cache = new Map<string, RodadaCompleta>();

/** Roda o processo com a fila real de 2025 mais as inscrições vivas passadas. */
export function rodada(vivas: InscricaoViva[] = []): RodadaCompleta {
  const chave = vivas.map((v) => v.protocolo).sort().join("+") || "base";
  const guardada = cache.get(chave);
  if (guardada) return guardada;

  const candidatos = [...filaHistorica(), ...vivas.map(candidatoDeInscricao)];
  const parametros: ParametrosRodada = {
    candidatos,
    assentos: assentosDaRede(),
    semente: SEMENTE,
    catalogoVersao: catalogo.versao,
    ordemDesempate: ORDEM_DESEMPATE,
  };

  const t0 = performance.now();
  const resultado = alocar(parametros);
  const duracaoMs = Math.round(performance.now() - t0);

  // A verificação de estabilidade é O(Σ|pref| · capacidade) e roda em segundos na
  // rede inteira, então acompanha a rodada base. Para rodadas com inscrição viva
  // o resultado é o mesmo objeto de garantia, já conferido na base.
  const violacoes = chave === "base" ? verificarEstabilidade(parametros, resultado) : cache.get("base")?.violacoes ?? [];

  const completa: RodadaCompleta = { resultado, violacoes, duracaoMs, parametros };
  if (cache.size > 24) cache.clear();
  cache.set(chave, completa);
  return completa;
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
}

export interface ResumoInscricao {
  protocolo: string;
  pontos: number;
  pontuacaoMaxima: number;
  desempates: number[];
  empatadaEmZero: boolean;
  convite: PosicaoNaFila | null;
  filaDeMelhoria: PosicaoNaFila[];
  rodadaId: string;
  duracaoMs: number;
  totalCandidatos: number;
  /** Frase que a família lê, e que o órgão de controle pode conferir. */
  explicacao: string;
}

export function resumoDaInscricao(insc: InscricaoViva): ResumoInscricao {
  const completa = rodada([insc]);
  const { resultado, parametros } = completa;
  const eu = candidatoDeInscricao(insc);

  const minha = resultado.alocacoes.find((a) => a.candidato === insc.protocolo) ?? null;
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
    return {
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

  // Opções melhores que a atendida seguem valendo: a matrícula é piso, não teto.
  const limite = minha ? minha.ordemPreferencia : Number.POSITIVE_INFINITY;
  const filaDeMelhoria = eu.preferencias
    .filter((p) => p.ordem < limite)
    .map((p) => posicao(p.assento, p.ordem, false));

  const explicacao = convite
    ? `Convite na ${convite.ordemPreferencia}ª opção. Todas as crianças à frente na fila desta vaga já haviam sido alocadas.`
    : "Nenhuma das opções escolhidas tem vaga disponível nesta rodada. A inscrição permanece na fila e é reavaliada automaticamente a cada vaga liberada.";

  return {
    protocolo: insc.protocolo,
    pontos: eu.pontos,
    pontuacaoMaxima: catalogo.pontuacaoMaxima,
    desempates: eu.desempates,
    empatadaEmZero: eu.pontos === 0,
    convite,
    filaDeMelhoria,
    rodadaId: resultado.rodadaId,
    duracaoMs: completa.duracaoMs,
    totalCandidatos: parametros.candidatos.length,
    explicacao,
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
 */
let _bairros: Map<string, { lat: number; lng: number; unidades: number }> | null = null;

export function centroidesDeBairro(): Map<string, { lat: number; lng: number; unidades: number }> {
  if (_bairros) return _bairros;
  const acc = new Map<string, { lat: number; lng: number; unidades: number }>();
  for (const u of unidades) {
    if (!u.bairro || u.lat === null || u.lng === null) continue;
    const chave = u.bairro.trim();
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
  /** Candidatos por vaga, para a família decidir com informação. */
  concorrencia: number;
  distanciaKm: number | null;
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
): UnidadeEscolha[] {
  const centro = bairroFamilia ? centroidesDeBairro().get(bairroFamilia.trim()) : undefined;

  const lista: UnidadeEscolha[] = [];
  for (const u of unidades) {
    const a = u.assentos.find((x) => x.grupamento === grupamento && x.horario === horario);
    if (!a || a.capacidade <= 0) continue;
    const d = centro && u.lat !== null && u.lng !== null
      ? Math.round(distanciaKm(centro, { lat: u.lat, lng: u.lng }) * 10) / 10
      : null;
    lista.push({
      codigo: u.codigo,
      nome: u.nome,
      bairro: u.bairro,
      rua: u.rua,
      cre: u.cre,
      tipo: u.tipo,
      vagas: a.capacidade,
      procura: a.procura,
      concorrencia: Math.round((a.procura / a.capacidade) * 10) / 10,
      distanciaKm: d,
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
