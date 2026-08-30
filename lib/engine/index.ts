/**
 * Motor de alocação de vagas em creche — SME Rio.
 *
 * Uma inscrição gera hoje até cinco filas paralelas para a mesma criança: ela
 * recebe cinco ofertas, ocupa cinco assentos, aceita uma, e os outros quatro
 * ficam congelados até serem repassados. Este motor troca a classificação por
 * opção pela classificação por criança: a ordem de prioridade da Resolução é
 * preservada bit a bit, mas cada criança recebe no máximo um convite.
 *
 * Arquivo único de propósito: não tem import interno, então roda sob o
 * type-stripping nativo do Node (`node --test test/engine.test.ts`) sem
 * transpilador, e é o mesmo código que o Next executa em produção.
 */

import { createHmac } from "node:crypto";

// ─────────────────────────────────────────────────────────────── tipos

export type Horario = "Integral" | "Parcial";

/** `unidade|grupamento|horario` — a vaga de creche não é fungível dentro da escola. */
export type AssentoId = string;

export interface Assento {
  id: AssentoId;
  unidade: number;
  grupamento: string;
  horario: Horario;
  /** Capacidade líquida: já descontadas renovações e transferências internas. */
  capacidade: number;
}

export interface Preferencia {
  /** 1 = primeira opção. */
  ordem: number;
  assento: AssentoId;
}

export interface Candidato {
  id: string;
  /** Pontuação da Resolução, calculada pelo catálogo versionado do processo. */
  pontos: number;
  /**
   * Critérios de desempate atendidos, por `pergId`. A ordem de comparação é a
   * ordem de exibição no formulário, definida pelo catálogo — não a ordem deste
   * array.
   */
  desempates: number[];
  preferencias: Preferencia[];
}

export interface Alocacao {
  candidato: string;
  assento: AssentoId;
  /** Qual opção da família foi atendida (1 = primeira). */
  ordemPreferencia: number;
}

export interface ResultadoRodada {
  rodadaId: string;
  semente: string;
  catalogoVersao: string;
  hashEntrada: string;
  alocacoes: Alocacao[];
  semAssento: string[];
  ocupacao: Record<AssentoId, number>;
  /** Número de propostas avaliadas — a medida real de trabalho da rodada. */
  propostas: number;
  executadaEm: string;
}

export interface ParametrosRodada {
  candidatos: Candidato[];
  assentos: Assento[];
  /** Publicada no D.O. antes da rodada, para que terceiros refaçam a conta. */
  semente: string;
  catalogoVersao: string;
  /** `pergId` dos critérios de desempate, na ordem de precedência da Resolução. */
  ordemDesempate: number[];
  /** Fixa o instante gravado na rodada — usado nos testes e no backtest. */
  agora?: string;
}

// ──────────────────────────────────────────────────────── sorteio auditável

/**
 * Posição no sorteio. Determinística e reproduzível por qualquer auditor que
 * tenha a semente e a lista de inscrições — uma linha de código, sem acesso ao
 * banco. Semente única para todo o processo, nunca uma por unidade: sorteio
 * independente por unidade quebra a verificabilidade e não compensa em equidade.
 */
export function posicaoNoSorteio(semente: string, candidatoId: string): string {
  return createHmac("sha256", semente).update(candidatoId).digest("hex");
}

// ─────────────────────────────────────────────────────────────── prioridade

interface CandidatoPreparado extends Candidato {
  /** Vetor lexicográfico, comparado da esquerda para a direita. Maior ganha. */
  chave: number[];
  sorteio: string;
  proximaOpcao: number;
  ordenadas: Preferencia[];
}

function prepara(
  candidatos: Candidato[],
  semente: string,
  ordemDesempate: number[],
): Map<string, CandidatoPreparado> {
  const mapa = new Map<string, CandidatoPreparado>();
  for (const c of candidatos) {
    if (mapa.has(c.id)) {
      throw new Error(`candidato duplicado na entrada: ${c.id}`);
    }
    const atende = new Set(c.desempates);
    mapa.set(c.id, {
      ...c,
      chave: [c.pontos, ...ordemDesempate.map((p) => (atende.has(p) ? 1 : 0))],
      sorteio: posicaoNoSorteio(semente, c.id),
      proximaOpcao: 0,
      ordenadas: [...c.preferencias].sort((a, b) => a.ordem - b.ordem),
    });
  }
  return mapa;
}

/** > 0 quando `a` tem prioridade sobre `b`. Total: nunca devolve 0 para ids distintos. */
export function comparaPrioridade(a: CandidatoPreparado, b: CandidatoPreparado): number {
  for (let i = 0; i < a.chave.length; i++) {
    if (a.chave[i] !== b.chave[i]) return a.chave[i] - b.chave[i];
  }
  // Empate na régua da Resolução: decide o sorteio publicado. Menor hash primeiro.
  if (a.sorteio !== b.sorteio) return a.sorteio < b.sorteio ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

// ──────────────────────────────────────────────────────── aceitação diferida

/**
 * Aceitação diferida com capacidades (Gale–Shapley, criança propõe).
 *
 * Como nenhum critério da Resolução depende da unidade, a pontuação de uma
 * criança é a mesma em todos os assentos — e sob essa condição o resultado é
 * idêntico a percorrer as crianças em ordem de prioridade, cada uma tomando a
 * melhor opção ainda disponível. Isso torna o motor trivialmente explicável
 * ("todos à sua frente já haviam sido alocados") sem perder a correção caso a
 * Resolução passe a incluir critérios territoriais.
 */
export function alocar(p: ParametrosRodada): ResultadoRodada {
  const { candidatos, assentos, semente, catalogoVersao, ordemDesempate } = p;

  const porAssento = new Map<AssentoId, Assento>();
  for (const a of assentos) {
    if (porAssento.has(a.id)) throw new Error(`assento duplicado na entrada: ${a.id}`);
    porAssento.set(a.id, a);
  }

  const cands = prepara(candidatos, semente, ordemDesempate);
  /** Ocupantes correntes de cada assento. Provisórios até a rodada terminar. */
  const ocupantes = new Map<AssentoId, CandidatoPreparado[]>();
  const opcaoAtendida = new Map<string, number>();

  // Fila de propostas. Cada criança propõe a uma opção no máximo uma vez, então
  // o laço termina em no máximo a soma dos tamanhos das listas de preferência.
  const fila: string[] = candidatos.map((c) => c.id);
  let propostas = 0;

  while (fila.length > 0) {
    const id = fila.shift() as string;
    const c = cands.get(id) as CandidatoPreparado;

    // Próxima opção ainda não tentada que exista de fato no catálogo de assentos.
    let assento: Assento | undefined;
    let ordem = 0;
    while (c.proximaOpcao < c.ordenadas.length) {
      const pref = c.ordenadas[c.proximaOpcao];
      c.proximaOpcao++;
      const cand = porAssento.get(pref.assento);
      if (cand && cand.capacidade > 0) {
        assento = cand;
        ordem = pref.ordem;
        break;
      }
    }
    if (!assento) continue; // esgotou as opções: fica sem assento nesta rodada

    propostas++;
    const lista = ocupantes.get(assento.id) ?? [];

    if (lista.length < assento.capacidade) {
      lista.push(c);
      ocupantes.set(assento.id, lista);
      opcaoAtendida.set(c.id, ordem);
      continue;
    }

    // Assento cheio: disputa com o ocupante de menor prioridade.
    let piorIdx = 0;
    for (let i = 1; i < lista.length; i++) {
      if (comparaPrioridade(lista[i], lista[piorIdx]) < 0) piorIdx = i;
    }
    const pior = lista[piorIdx];

    if (comparaPrioridade(c, pior) > 0) {
      lista[piorIdx] = c;
      opcaoAtendida.set(c.id, ordem);
      opcaoAtendida.delete(pior.id);
      fila.push(pior.id); // deslocado tenta a próxima opção dele
    } else {
      fila.push(c.id); // não passou: tenta a próxima opção dele
    }
  }

  const alocacoes: Alocacao[] = [];
  const ocupacao: Record<AssentoId, number> = {};
  for (const [assentoId, lista] of ocupantes) {
    ocupacao[assentoId] = lista.length;
    for (const c of lista) {
      alocacoes.push({
        candidato: c.id,
        assento: assentoId,
        ordemPreferencia: opcaoAtendida.get(c.id) as number,
      });
    }
  }
  alocacoes.sort((a, b) => (a.candidato < b.candidato ? -1 : 1));

  const alocados = new Set(alocacoes.map((a) => a.candidato));
  const semAssento = candidatos.map((c) => c.id).filter((id) => !alocados.has(id)).sort();

  const hashEntrada = hashDeEntrada(p);
  return {
    rodadaId: `r-${catalogoVersao}-${hashEntrada.slice(0, 12)}`,
    semente,
    catalogoVersao,
    hashEntrada,
    alocacoes,
    semAssento,
    ocupacao,
    propostas,
    executadaEm: p.agora ?? new Date().toISOString(),
  };
}

/**
 * Hash das entradas da rodada. Reexecutar a mesma rodada com as mesmas entradas
 * tem que produzir o mesmo resultado — este hash é o que permite provar isso.
 */
export function hashDeEntrada(p: ParametrosRodada): string {
  const h = createHmac("sha256", "rodada-v1");
  h.update(p.semente + " " + p.catalogoVersao + " " + p.ordemDesempate.join(","));
  for (const a of [...p.assentos].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    h.update(`${a.id}:${a.capacidade}`);
  }
  for (const c of [...p.candidatos].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    const prefs = [...c.preferencias].sort((x, y) => x.ordem - y.ordem).map((x) => `${x.ordem}>${x.assento}`);
    h.update(`${c.id}:${c.pontos}:${[...c.desempates].sort().join("/")}:${prefs.join(",")}`);
  }
  return h.digest("hex");
}

// ───────────────────────────────────────────────────────────── verificação

export interface Violacao {
  tipo: "capacidade_excedida" | "par_bloqueador" | "assento_duplicado" | "convite_duplicado";
  detalhe: string;
}

/**
 * Confere as duas propriedades que o órgão de controle vai cobrar:
 *
 *  1. Nenhum assento passou da capacidade e ninguém recebeu mais de um convite.
 *  2. Não existe par bloqueador — nenhum caso em que a criança prefira um
 *     assento ao que recebeu *e* esse assento esteja ocupado por alguém de
 *     prioridade menor. Na linguagem do edital: ninguém à sua frente na fila
 *     foi ultrapassado.
 *
 * Roda junto com a rodada, não só nos testes: é a evidência que acompanha o
 * resultado publicado.
 */
export function verificarEstabilidade(p: ParametrosRodada, r: ResultadoRodada): Violacao[] {
  const violacoes: Violacao[] = [];
  const cands = prepara(p.candidatos, p.semente, p.ordemDesempate);
  const capacidade = new Map(p.assentos.map((a) => [a.id, a.capacidade]));

  const assentoDe = new Map<string, AssentoId>();
  const ordemDe = new Map<string, number>();
  for (const a of r.alocacoes) {
    if (assentoDe.has(a.candidato)) {
      violacoes.push({ tipo: "convite_duplicado", detalhe: `${a.candidato} recebeu mais de um convite` });
    }
    assentoDe.set(a.candidato, a.assento);
    ordemDe.set(a.candidato, a.ordemPreferencia);
  }

  const ocupantesDe = new Map<AssentoId, string[]>();
  for (const a of r.alocacoes) {
    const l = ocupantesDe.get(a.assento) ?? [];
    l.push(a.candidato);
    ocupantesDe.set(a.assento, l);
  }
  for (const [assentoId, lista] of ocupantesDe) {
    const cap = capacidade.get(assentoId) ?? 0;
    if (lista.length > cap) {
      violacoes.push({
        tipo: "capacidade_excedida",
        detalhe: `${assentoId}: ${lista.length} alocados para ${cap} vagas`,
      });
    }
  }

  for (const c of cands.values()) {
    const meuAssento = assentoDe.get(c.id);
    const minhaOrdem = ordemDe.get(c.id) ?? Number.POSITIVE_INFINITY;
    for (const pref of c.preferencias) {
      if (pref.ordem >= minhaOrdem) continue; // não prefere: já foi atendido igual ou melhor
      if (pref.assento === meuAssento) continue;
      const cap = capacidade.get(pref.assento);
      if (cap === undefined || cap === 0) continue;
      const lista = ocupantesDe.get(pref.assento) ?? [];
      if (lista.length < cap) {
        violacoes.push({
          tipo: "par_bloqueador",
          detalhe: `${c.id} preferia ${pref.assento}, que ficou com vaga sobrando`,
        });
        continue;
      }
      for (const outroId of lista) {
        const outro = cands.get(outroId);
        if (outro && comparaPrioridade(c, outro) > 0) {
          violacoes.push({
            tipo: "par_bloqueador",
            detalhe: `${c.id} preferia ${pref.assento}, ocupado por ${outroId}, de prioridade menor`,
          });
          break;
        }
      }
    }
  }
  return violacoes;
}

// ──────────────────────────────────────────────────────── rodada contínua

export interface MovimentoCascata {
  passo: number;
  candidato: string;
  /** Assento que a criança passa a ocupar. */
  assentoRecebido: AssentoId;
  /** Qual opção dela foi atendida agora (1 = primeira). */
  ordemRecebida: number;
  /** Assento que ela desocupa ao subir — o próximo elo da cadeia. */
  assentoLiberado: AssentoId | null;
  /** Opção que ela ocupava antes, se ocupava alguma. */
  ordemAnterior: number | null;
  /** Quantos candidatos disputavam o assento que ela acabou de pegar. */
  disputavam: number;
}

export interface Cascata {
  assentoInicial: AssentoId;
  movimentos: MovimentoCascata[];
  /** Onde a cadeia parou: o assento que ninguém mais quis. */
  assentoOcioso: AssentoId | null;
  encerrouPor: "sem_candidato" | "limite_atingido";
  candidatosAvaliados: number;
  duracaoMs: number;
}

/**
 * Reexecuta o processo sobre o **fecho da cascata**, não sobre a rede inteira.
 *
 * Uma vaga liberada no meio do ano não exige reprocessar 62 mil crianças. Ela
 * inicia uma cadeia: o assento liberado vai para a criança de maior prioridade
 * que o prefere ao que tem hoje; o assento que essa criança larga vai para a
 * próxima; e assim por diante, até chegar num assento que ninguém à espera
 * prefere. É isso que remove os dias mortos entre uma desistência e a próxima
 * matrícula — hoje esse cálculo é feito no mundo físico, em semanas de telefonema.
 *
 * A cadeia preserva a estabilidade: cada passo dá o assento a quem tem a maior
 * prioridade entre os que o querem, então nenhum par bloqueador é criado.
 */
export function cascataDeVaga(
  p: ParametrosRodada,
  alocacoes: Alocacao[],
  assentoInicial: AssentoId,
  limite = 50,
): Cascata {
  const t0 = performance.now();
  const cands = prepara(p.candidatos, p.semente, p.ordemDesempate);

  // Índice assento → quem o escolheu, e em que posição da preferência.
  const interessados = new Map<AssentoId, { id: string; ordem: number }[]>();
  for (const c of p.candidatos) {
    for (const pref of c.preferencias) {
      const l = interessados.get(pref.assento);
      if (l) l.push({ id: c.id, ordem: pref.ordem });
      else interessados.set(pref.assento, [{ id: c.id, ordem: pref.ordem }]);
    }
  }

  // Estado corrente da alocação, que a cadeia vai alterando.
  const atual = new Map<string, { assento: AssentoId; ordem: number }>();
  for (const a of alocacoes) atual.set(a.candidato, { assento: a.assento, ordem: a.ordemPreferencia });

  const movimentos: MovimentoCascata[] = [];
  let avaliados = 0;
  let fila: AssentoId[] = [assentoInicial];
  let assentoOcioso: AssentoId | null = null;
  let encerrouPor: "sem_candidato" | "limite_atingido" = "sem_candidato";

  while (fila.length > 0) {
    if (movimentos.length >= limite) {
      encerrouPor = "limite_atingido";
      break;
    }
    const vaga = fila.shift() as AssentoId;

    // Melhor candidato que prefere esta vaga ao que tem hoje.
    let melhor: CandidatoPreparado | null = null;
    let melhorOrdem = 0;
    const lista = interessados.get(vaga) ?? [];
    for (const { id, ordem } of lista) {
      avaliados++;
      const c = cands.get(id);
      if (!c) continue;
      const tem = atual.get(id);
      // Já está nesta vaga, ou já foi atendido em opção igual ou melhor.
      if (tem && tem.ordem <= ordem) continue;
      if (melhor === null || comparaPrioridade(c, melhor) > 0) {
        melhor = c;
        melhorOrdem = ordem;
      }
    }

    if (melhor === null) {
      assentoOcioso = vaga; // ninguém à espera quer: a cadeia termina aqui
      break;
    }

    const anterior = atual.get(melhor.id) ?? null;
    atual.set(melhor.id, { assento: vaga, ordem: melhorOrdem });
    movimentos.push({
      passo: movimentos.length + 1,
      candidato: melhor.id,
      assentoRecebido: vaga,
      ordemRecebida: melhorOrdem,
      assentoLiberado: anterior ? anterior.assento : null,
      ordemAnterior: anterior ? anterior.ordem : null,
      disputavam: lista.length,
    });

    // O assento que essa criança largou é o próximo elo.
    if (anterior) fila = [anterior.assento];
    else fila = []; // veio da fila de espera: a cadeia se encerra sem liberar nada
  }

  return {
    assentoInicial,
    movimentos,
    assentoOcioso,
    encerrouPor,
    candidatosAvaliados: avaliados,
    duracaoMs: Math.round((performance.now() - t0) * 100) / 100,
  };
}

// ─────────────────────────────────────────── inscrição nova, rodada incremental

export interface Deslocamento {
  candidato: string;
  /** Assento que perdeu. */
  assentoPerdido: AssentoId;
  ordemPerdida: number;
  /** Assento onde reentrou, ou null se ficou sem assento. */
  assentoNovo: AssentoId | null;
  ordemNova: number | null;
}

export interface Insercao {
  candidato: string;
  assento: AssentoId | null;
  ordem: number | null;
  /** Quem saiu do lugar para acomodar a cadeia, em ordem. */
  deslocamentos: Deslocamento[];
  propostas: number;
  duracaoMs: number;
}

/**
 * Insere uma inscrição nova numa alocação já estável, sem reprocessar a rede.
 *
 * A criança propõe à sua 1ª opção. Se há vaga, fica. Se está cheia, disputa com
 * o ocupante de menor prioridade: se passa, entra, e o deslocado retoma a
 * proposta a partir da opção seguinte à que perdeu — que é exatamente o que a
 * aceitação diferida faria. A cadeia é curta porque para no primeiro assento com
 * vaga ou no primeiro candidato que não passa.
 *
 * O resultado é idêntico a rodar a aceitação diferida com a nova criança na
 * entrada (há teste comparando os dois), mas custa milissegundos em vez de
 * segundos — e é a modelagem correta: uma inscrição que chega em março não deve
 * requalificar as 62.899 crianças já classificadas.
 *
 * `p.candidatos` inclui a criança nova; `alocacoes` é a alocação estável de
 * todas as outras.
 */
export function inserirCandidato(
  p: ParametrosRodada,
  alocacoes: Alocacao[],
  novoId: string,
): Insercao {
  const t0 = performance.now();
  const cands = prepara(p.candidatos, p.semente, p.ordemDesempate);
  const novo = cands.get(novoId);
  if (!novo) throw new Error(`candidato ${novoId} não está na entrada da rodada`);

  const capacidade = new Map(p.assentos.map((a) => [a.id, a.capacidade]));
  const ocupantes = new Map<AssentoId, string[]>();
  /** Qual opção cada criança ocupa hoje — o deslocado retoma depois dela. */
  const ordemDe = new Map<string, number>();
  for (const a of alocacoes) {
    const l = ocupantes.get(a.assento);
    if (l) l.push(a.candidato);
    else ocupantes.set(a.assento, [a.candidato]);
    ordemDe.set(a.candidato, a.ordemPreferencia);
  }

  const deslocamentos: Deslocamento[] = [];
  let propostas = 0;
  let assentoDoNovo: AssentoId | null = null;
  let ordemDoNovo: number | null = null;

  // Fila de quem precisa de assento: id e a partir de qual opção retomar.
  const fila: { id: string; aPartirDe: number }[] = [{ id: novoId, aPartirDe: 0 }];

  while (fila.length > 0) {
    const { id, aPartirDe } = fila.shift() as { id: string; aPartirDe: number };
    const c = cands.get(id);
    if (!c) continue;

    let colocado: { assento: AssentoId; ordem: number } | null = null;

    for (const pref of c.ordenadas) {
      if (pref.ordem <= aPartirDe) continue; // já foi recusado nessas
      const cap = capacidade.get(pref.assento);
      if (cap === undefined || cap === 0) continue;
      propostas++;

      const lista = ocupantes.get(pref.assento) ?? [];
      if (lista.length < cap) {
        lista.push(id);
        ocupantes.set(pref.assento, lista);
        ordemDe.set(id, pref.ordem);
        colocado = { assento: pref.assento, ordem: pref.ordem };
        break;
      }

      // Assento cheio: disputa com o ocupante de menor prioridade.
      let piorIdx = 0;
      for (let i = 1; i < lista.length; i++) {
        const a = cands.get(lista[i]);
        const b = cands.get(lista[piorIdx]);
        if (a && b && comparaPrioridade(a, b) < 0) piorIdx = i;
      }
      const piorId = lista[piorIdx];
      const pior = cands.get(piorId);
      if (!pior || comparaPrioridade(c, pior) <= 0) continue; // não passa: tenta a próxima

      const ordemDoPior = ordemDe.get(piorId) as number;
      lista[piorIdx] = id;
      ordemDe.set(id, pref.ordem);
      ordemDe.delete(piorId);
      colocado = { assento: pref.assento, ordem: pref.ordem };
      deslocamentos.push({
        candidato: piorId,
        assentoPerdido: pref.assento,
        ordemPerdida: ordemDoPior,
        assentoNovo: null,
        ordemNova: null,
      });
      fila.push({ id: piorId, aPartirDe: ordemDoPior });
      break;
    }

    if (id === novoId) {
      assentoDoNovo = colocado ? colocado.assento : null;
      ordemDoNovo = colocado ? colocado.ordem : null;
    } else {
      // Fecha o registro do deslocado com onde ele reentrou.
      for (let i = deslocamentos.length - 1; i >= 0; i--) {
        if (deslocamentos[i].candidato !== id) continue;
        deslocamentos[i].assentoNovo = colocado ? colocado.assento : null;
        deslocamentos[i].ordemNova = colocado ? colocado.ordem : null;
        break;
      }
    }
  }

  return {
    candidato: novoId,
    assento: assentoDoNovo,
    ordem: ordemDoNovo,
    deslocamentos,
    propostas,
    duracaoMs: Math.round((performance.now() - t0) * 100) / 100,
  };
}

/** Aplica uma inserção sobre uma alocação, devolvendo a nova lista. */
export function aplicaInsercao(alocacoes: Alocacao[], ins: Insercao): Alocacao[] {
  const mapa = new Map(alocacoes.map((a) => [a.candidato, { ...a }]));
  for (const d of ins.deslocamentos) {
    if (d.assentoNovo && d.ordemNova !== null) {
      mapa.set(d.candidato, {
        candidato: d.candidato,
        assento: d.assentoNovo,
        ordemPreferencia: d.ordemNova,
      });
    } else {
      mapa.delete(d.candidato);
    }
  }
  if (ins.assento && ins.ordem !== null) {
    mapa.set(ins.candidato, {
      candidato: ins.candidato,
      assento: ins.assento,
      ordemPreferencia: ins.ordem,
    });
  }
  return [...mapa.values()].sort((a, b) => (a.candidato < b.candidato ? -1 : 1));
}

// ───────────────────────────────────────────────────── utilitários de assento

export function assentoId(unidade: number, grupamento: string, horario: string): AssentoId {
  return `${unidade}|${grupamento}|${horario}`;
}

export function decodificaAssento(id: AssentoId): { unidade: number; grupamento: string; horario: Horario } {
  const [u, g, h] = id.split("|");
  return { unidade: Number(u), grupamento: g, horario: h as Horario };
}

/**
 * Grupamento a partir do nascimento, com o corte de 31 de março que a Resolução
 * usa: vale a idade completada até 31/03 do ano do processo.
 */
export function grupamentoPorNascimento(nascimentoISO: string, anoProcesso: number): string | null {
  const [ano, mes] = nascimentoISO.split("-").map(Number);
  if (!ano || !mes) return null;
  // Idade em anos completos em 31/03 do ano do processo.
  const corte = new Date(Date.UTC(anoProcesso, 2, 31));
  const nasc = new Date(Date.UTC(ano, mes - 1, 1));
  let idade = corte.getUTCFullYear() - nasc.getUTCFullYear();
  const antes = corte.getUTCMonth() < nasc.getUTCMonth();
  if (antes) idade--;
  if (idade < 0) return null;
  if (idade === 0) return "Berçário";
  if (idade === 1) return "Maternal I";
  if (idade === 2) return "Maternal II";
  return null; // 3 anos ou mais em 31/03 sai de creche e entra em pré-escola
}
