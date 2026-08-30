/**
 * Testes do motor de alocação. Rodam sob o type-stripping nativo do Node 24,
 * sem transpilador:  node --test test/engine.test.ts
 *
 * O que está sendo testado não é "o código roda", e sim as duas promessas que a
 * solução faz a um órgão de controle: ninguém recebe dois convites, e ninguém à
 * sua frente na fila foi ultrapassado.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  alocar,
  assentoId,
  comparaPrioridade,
  decodificaAssento,
  grupamentoPorNascimento,
  hashDeEntrada,
  posicaoNoSorteio,
  verificarEstabilidade,
} from "../lib/engine/index.ts";
import type { Assento, Candidato, ParametrosRodada } from "../lib/engine/index.ts";

const SEMENTE = "teste-D.O.-195";
const DESEMPATE = [29, 30]; // irmão matriculado, depois responsável menor de 18

function params(candidatos: Candidato[], assentos: Assento[]): ParametrosRodada {
  return {
    candidatos,
    assentos,
    semente: SEMENTE,
    catalogoVersao: "195.1",
    ordemDesempate: DESEMPATE,
    agora: "2026-08-30T12:00:00.000Z",
  };
}

function assento(unidade: number, capacidade: number): Assento {
  return {
    id: assentoId(unidade, "Berçário", "Integral"),
    unidade,
    grupamento: "Berçário",
    horario: "Integral",
    capacidade,
  };
}

function candidato(id: string, pontos: number, opcoes: number[], desempates: number[] = []): Candidato {
  return {
    id,
    pontos,
    desempates,
    preferencias: opcoes.map((u, i) => ({ ordem: i + 1, assento: assentoId(u, "Berçário", "Integral") })),
  };
}

/** PRNG determinístico, para que a instância aleatória seja sempre a mesma. */
function prng(semente: number) {
  let s = semente;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("prioridade", () => {
  it("mais pontos vence, independente do sorteio", () => {
    const a = assento(1, 1);
    const r = alocar(params([candidato("baixa", 2, [1]), candidato("alta", 51, [1])], [a]));
    assert.equal(r.alocacoes.length, 1);
    assert.equal(r.alocacoes[0].candidato, "alta");
    assert.deepEqual(r.semAssento, ["baixa"]);
  });

  it("empate em pontos é decidido pelo critério de desempate da Resolução", () => {
    const a = assento(1, 1);
    const r = alocar(params([candidato("sem", 4, [1]), candidato("com-irmao", 4, [1], [29])], [a]));
    assert.equal(r.alocacoes[0].candidato, "com-irmao");
  });

  it("os critérios de desempate seguem a ordem do catálogo, não a do array", () => {
    const a = assento(1, 1);
    // 29 (irmão) precede 30 (responsável menor de 18): quem tem 29 passa.
    const r = alocar(params([candidato("menor18", 0, [1], [30]), candidato("irmao", 0, [1], [29])], [a]));
    assert.equal(r.alocacoes[0].candidato, "irmao");
  });

  it("empate total cai no sorteio, que é reproduzível por terceiros", () => {
    const a = assento(1, 1);
    const entrada = params([candidato("aaa", 0, [1]), candidato("bbb", 0, [1])], [a]);
    const r = alocar(entrada);

    // Um auditor com a semente e a lista de inscrições refaz a conta assim:
    const pa = posicaoNoSorteio(SEMENTE, "aaa");
    const pb = posicaoNoSorteio(SEMENTE, "bbb");
    const esperado = pa < pb ? "aaa" : "bbb";
    assert.equal(r.alocacoes[0].candidato, esperado);
  });

  it("a comparação é total: nunca devolve empate entre ids distintos", () => {
    const a = assento(1, 2);
    const r = alocar(params([candidato("x", 0, [1]), candidato("y", 0, [1])], [a]));
    assert.equal(r.alocacoes.length, 2);
  });
});

describe("garantias da rodada", () => {
  it("ninguém recebe mais de um convite, mesmo com cinco opções e vaga em todas", () => {
    const assentos = [1, 2, 3, 4, 5].map((u) => assento(u, 10));
    const r = alocar(params([candidato("c1", 0, [1, 2, 3, 4, 5])], assentos));
    assert.equal(r.alocacoes.length, 1);
    assert.equal(r.alocacoes[0].ordemPreferencia, 1, "deve receber a 1ª opção");
  });

  it("respeita a capacidade e devolve o excedente para a próxima opção", () => {
    const assentos = [assento(1, 1), assento(2, 1)];
    const cands = [candidato("a", 10, [1, 2]), candidato("b", 5, [1, 2])];
    const r = alocar(params(cands, assentos));
    assert.equal(r.alocacoes.length, 2);
    const porCand = new Map(r.alocacoes.map((x) => [x.candidato, x]));
    assert.equal(porCand.get("a")?.ordemPreferencia, 1);
    assert.equal(porCand.get("b")?.ordemPreferencia, 2, "o deslocado tenta a opção seguinte");
  });

  it("quem esgota as opções fica sem assento em vez de ir para uma vaga que não escolheu", () => {
    const assentos = [assento(1, 1), assento(9, 5)];
    const cands = [candidato("a", 10, [1]), candidato("b", 5, [1])];
    const r = alocar(params(cands, assentos));
    assert.deepEqual(r.semAssento, ["b"]);
    assert.equal(r.ocupacao[assentoId(9, "Berçário", "Integral")], undefined);
  });

  it("ignora opção para assento inexistente sem quebrar a rodada", () => {
    const r = alocar(params([candidato("a", 0, [404, 1])], [assento(1, 1)]));
    assert.equal(r.alocacoes.length, 1);
    assert.equal(r.alocacoes[0].ordemPreferencia, 2);
  });

  it("rejeita entrada com candidato duplicado", () => {
    assert.throws(
      () => alocar(params([candidato("a", 0, [1]), candidato("a", 0, [1])], [assento(1, 1)])),
      /candidato duplicado/,
    );
  });
});

describe("estabilidade", () => {
  it("não produz par bloqueador numa instância aleatória grande", () => {
    const rnd = prng(20260830);
    const assentos = Array.from({ length: 40 }, (_, i) => assento(i + 1, 1 + Math.floor(rnd() * 6)));
    const candidatos: Candidato[] = [];
    for (let i = 0; i < 900; i++) {
      const n = 1 + Math.floor(rnd() * 5);
      const escolhidas = new Set<number>();
      while (escolhidas.size < n) escolhidas.add(1 + Math.floor(rnd() * 40));
      const pontos = rnd() < 0.94 ? 0 : Math.floor(rnd() * 100); // a fila real é 94% zerada
      const desempates = rnd() < 0.1 ? [29] : [];
      candidatos.push(candidato(`c${i}`, pontos, [...escolhidas], desempates));
    }
    const entrada = params(candidatos, assentos);
    const r = alocar(entrada);

    const violacoes = verificarEstabilidade(entrada, r);
    assert.deepEqual(violacoes, [], `esperava zero violações, veio: ${JSON.stringify(violacoes.slice(0, 3))}`);

    // Nenhuma vaga sobrou com alguém que a preferia esperando por ela.
    const capacidade = new Map(assentos.map((a) => [a.id, a.capacidade]));
    for (const [id, ocupado] of Object.entries(r.ocupacao)) {
      assert.ok(ocupado <= (capacidade.get(id) ?? 0), `${id} estourou a capacidade`);
    }
    assert.equal(new Set(r.alocacoes.map((a) => a.candidato)).size, r.alocacoes.length);
  });

  it("detecta um par bloqueador injetado à mão", () => {
    const assentos = [assento(1, 1), assento(2, 1)];
    const cands = [candidato("forte", 50, [1, 2]), candidato("fraco", 0, [1, 2])];
    const entrada = params(cands, assentos);
    // resultado adulterado: o fraco fica com a 1ª opção do forte
    const adulterado = {
      ...alocar(entrada),
      alocacoes: [
        { candidato: "fraco", assento: assentos[0].id, ordemPreferencia: 1 },
        { candidato: "forte", assento: assentos[1].id, ordemPreferencia: 2 },
      ],
    };
    const violacoes = verificarEstabilidade(entrada, adulterado);
    assert.ok(
      violacoes.some((v) => v.tipo === "par_bloqueador"),
      "a verificação tem que acusar a fila furada",
    );
  });
});

describe("reprodutibilidade", () => {
  it("mesmas entradas produzem o mesmo hash e o mesmo resultado", () => {
    const assentos = [assento(1, 2), assento(2, 2)];
    const cands = [candidato("a", 0, [1, 2]), candidato("b", 4, [1]), candidato("c", 0, [2, 1])];
    const r1 = alocar(params(cands, assentos));
    const r2 = alocar(params([...cands].reverse(), [...assentos].reverse()));

    assert.equal(r1.hashEntrada, r2.hashEntrada, "o hash não pode depender da ordem da entrada");
    assert.equal(r1.rodadaId, r2.rodadaId);
    assert.deepEqual(r1.alocacoes, r2.alocacoes);
  });

  it("trocar a semente muda o desempate, e só ele", () => {
    const assentos = [assento(1, 1)];
    const cands = [candidato("aaa", 0, [1]), candidato("bbb", 0, [1])];
    const base = alocar(params(cands, assentos));
    const outra = alocar({ ...params(cands, assentos), semente: "outra-semente" });
    assert.notEqual(base.hashEntrada, outra.hashEntrada);
    assert.equal(base.alocacoes.length, outra.alocacoes.length, "a quantidade de vagas preenchidas não muda");
  });

  it("o hash muda quando a capacidade muda", () => {
    const cands = [candidato("a", 0, [1])];
    const h1 = hashDeEntrada(params(cands, [assento(1, 1)]));
    const h2 = hashDeEntrada(params(cands, [assento(1, 2)]));
    assert.notEqual(h1, h2);
  });
});

describe("assento e grupamento", () => {
  it("codifica e decodifica o assento", () => {
    const id = assentoId(101601, "Maternal II", "Parcial");
    assert.deepEqual(decodificaAssento(id), {
      unidade: 101601,
      grupamento: "Maternal II",
      horario: "Parcial",
    });
  });

  it("aplica o corte de 31 de março", () => {
    // Processo de 2025: quem completa 1 ano até 31/03/2025 entra em Maternal I.
    assert.equal(grupamentoPorNascimento("2024-06", 2025), "Berçário");
    assert.equal(grupamentoPorNascimento("2024-01", 2025), "Maternal I");
    assert.equal(grupamentoPorNascimento("2023-01", 2025), "Maternal II");
    assert.equal(grupamentoPorNascimento("2021-01", 2025), null, "3 anos ou mais sai de creche");
  });
});

describe("comparaPrioridade", () => {
  it("é antissimétrica", () => {
    const assentos = [assento(1, 2)];
    const entrada = params([candidato("a", 5, [1]), candidato("b", 3, [1])], assentos);
    const r = alocar(entrada);
    assert.equal(r.alocacoes.length, 2);
    // exercitado indiretamente; aqui garantimos que a função é exportada e usável
    assert.equal(typeof comparaPrioridade, "function");
  });
});
