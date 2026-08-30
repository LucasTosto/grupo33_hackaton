/**
 * Decodificação da fila histórica e agrupamento por criança.
 *
 * Este arquivo existe por causa de um detalhe da base que muda o resultado: a
 * chave de uma inscrição é `(polo, inscrição)`, e a mesma criança pode estar
 * inscrita em mais de um polo do mesmo processo. Alocar por inscrição daria a
 * uma parte das crianças dois assentos — reproduzindo, em outra escala,
 * exatamente o problema que o motor existe para resolver.
 *
 * A unidade de alocação é a criança. As preferências dela são a união das
 * opções de todas as suas inscrições, na ordem em que foram declaradas.
 */

import { assentoId, type Candidato } from "./engine/index.ts";

export interface FilaCompacta {
  processo: { prmId: number; ano: number };
  fonte: string;
  formato: string;
  grupamentos: string[];
  horarios: string[];
  total: number;
  inscricoes: string[];
}

export interface InscricaoHistorica {
  id: string;
  aluno: string;
  pontos: number;
  desempates: number[];
  bairro: string | null;
  preferencias: { ordem: number; assento: string }[];
}

/** Desempacota o formato de linha única em objetos. */
export function decodificaFila(bruto: FilaCompacta): InscricaoHistorica[] {
  const g = bruto.grupamentos;
  const h = bruto.horarios;
  const out: InscricaoHistorica[] = [];

  for (const linha of bruto.inscricoes) {
    const [id, aluno, pontos, desemp, bairro, opcoes] = linha.split(";");
    const preferencias = opcoes.split("|").map((op) => {
      const [uni, gi, hi, ordem] = op.split(":");
      return {
        ordem: Number(ordem),
        assento: assentoId(Number(uni), g[Number(gi)], h[Number(hi)]),
      };
    });
    out.push({
      id,
      aluno,
      pontos: Number(pontos),
      desempates: desemp ? desemp.split(",").map(Number) : [],
      bairro: bairro || null,
      preferencias,
    });
  }
  return out;
}

/**
 * Agrupa por criança: um candidato por `aluno`, no máximo um assento cada.
 *
 * A pontuação da criança é a maior entre suas inscrições — se ela comprovou um
 * critério em uma delas, comprovou o critério. As preferências são concatenadas
 * na ordem das inscrições (a base vem ordenada por data de criação), sem repetir
 * assento, e renumeradas de 1 a N.
 */
export function agrupaPorCrianca(inscricoes: InscricaoHistorica[]): Candidato[] {
  const porCrianca = new Map<
    string,
    { pontos: number; desempates: Set<number>; assentos: string[]; vistos: Set<string> }
  >();

  for (const i of inscricoes) {
    let c = porCrianca.get(i.aluno);
    if (!c) {
      c = { pontos: 0, desempates: new Set(), assentos: [], vistos: new Set() };
      porCrianca.set(i.aluno, c);
    }
    c.pontos = Math.max(c.pontos, i.pontos);
    for (const d of i.desempates) c.desempates.add(d);
    for (const p of [...i.preferencias].sort((a, b) => a.ordem - b.ordem)) {
      if (c.vistos.has(p.assento)) continue;
      c.vistos.add(p.assento);
      c.assentos.push(p.assento);
    }
  }

  const candidatos: Candidato[] = [];
  for (const [aluno, c] of porCrianca) {
    candidatos.push({
      id: aluno,
      pontos: c.pontos,
      desempates: [...c.desempates].sort((a, b) => a - b),
      preferencias: c.assentos.map((assento, i) => ({ ordem: i + 1, assento })),
    });
  }
  return candidatos;
}

/** Mapa inscrição → criança, para comparar o motor com o histórico. */
export function criancaPorInscricao(inscricoes: InscricaoHistorica[]): Map<string, string> {
  return new Map(inscricoes.map((i) => [i.id, i.aluno]));
}
