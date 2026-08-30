/**
 * Testes da régua de pontuação.
 *
 * Três propriedades são o motivo de a régua existir e precisam falhar alto se
 * alguém as quebrar:
 *
 * 1. **Teto por bloco**: dentro do bloco vale o maior, não a soma. É o que
 *    impede a dupla contagem do mesmo construto.
 * 2. **Risco agudo vence pobreza máxima**: dois blocos de risco somam 50 contra
 *    os 35 do máximo de renda. É a correção da inversão de severidade.
 * 3. **Declarado não ordena a fila**: só `aferido` e `atestado` entram em
 *    `confirmados`. Sem isso, adotar a régua nova antes da aferição completa
 *    seria pior do que não mudar nada.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BLOCOS,
  calcula,
  equivalenteNaFila2025,
  grauPorId,
  PERGUNTAS,
  PONTUACAO_MAXIMA,
  SOMA_DOS_TETOS,
} from "../lib/regua.ts";

describe("estrutura da régua", () => {
  it("os tetos dos blocos somam exatamente a escala", () => {
    assert.equal(SOMA_DOS_TETOS, PONTUACAO_MAXIMA);
  });

  it("nenhum grau isolado consome mais da metade da escala", () => {
    // Princípio 5 do diagnóstico: em 2025 o CadÚnico consumia 89,9% da escala.
    for (const b of BLOCOS) {
      for (const g of b.graus) {
        assert.ok(
          g.pontos <= PONTUACAO_MAXIMA / 2,
          `grau "${g.id}" vale ${g.pontos}, mais de metade da escala`,
        );
      }
    }
  });

  it("nenhum grau excede o teto do próprio bloco", () => {
    for (const b of BLOCOS) {
      for (const g of b.graus) {
        assert.ok(g.pontos <= b.teto, `grau "${g.id}" vale ${g.pontos} num bloco de teto ${b.teto}`);
      }
    }
  });

  it("todo grau referenciado pelas perguntas existe na régua", () => {
    for (const p of PERGUNTAS) {
      if (p.grau) assert.ok(grauPorId(p.grau), `pergunta "${p.id}" aponta para grau inexistente "${p.grau}"`);
      for (const o of p.qualificador?.opcoes ?? []) {
        assert.ok(grauPorId(o.grau), `qualificador de "${p.id}" aponta para grau inexistente "${o.grau}"`);
      }
    }
  });
});

describe("teto por bloco", () => {
  it("dentro do bloco vale o maior item, não a soma", () => {
    // Violência no núcleo (20) + álcool e drogas (15) dão 20, e não 35. É a
    // conta que a tela precisa explicar, sob pena de ser lida como erro.
    const p = calcula([
      { grau: "violencia_nucleo", origem: "atestado" },
      { grau: "substancias", origem: "atestado" },
    ]);
    assert.equal(p.confirmados, 20);
    const bloco = p.blocos.find((b) => b.numero === 2);
    assert.equal(bloco?.confirmados, 20);
    assert.equal(bloco?.itens.find((i) => i.grau === "substancias")?.suprimidoPeloTeto, true);
    assert.equal(bloco?.itens.find((i) => i.grau === "violencia_nucleo")?.suprimidoPeloTeto, false);
  });

  it("blocos diferentes somam entre si", () => {
    const p = calcula([
      { grau: "renda_extrema", origem: "aferido" },
      { grau: "responsavel_unico", origem: "aferido" },
      { grau: "espera_anterior", origem: "aferido" },
    ]);
    assert.equal(p.confirmados, 35 + 10 + 3);
  });

  it("o bloco de espera soma, mas respeita o teto", () => {
    const p = calcula([
      { grau: "espera_dois_processos", origem: "aferido" },
      { grau: "refugiado", origem: "aferido" },
    ]);
    // 5 + 3 = 8, com teto de 5.
    assert.equal(p.confirmados, 5);
  });

  it("a pontuação nunca passa da escala", () => {
    const tudo = BLOCOS.flatMap((b) =>
      b.graus.map((g) => ({ grau: g.id, origem: g.origens[0] as "aferido" | "atestado" })),
    );
    const p = calcula(tudo);
    assert.ok(p.confirmados <= PONTUACAO_MAXIMA);
  });
});

describe("a inversão de severidade é corrigida", () => {
  const rendaMaxima = calcula([{ grau: "renda_extrema", origem: "aferido" }]);

  it("o máximo de renda vale 35, e não os 51 da régua de 2025", () => {
    assert.equal(rendaMaxima.confirmados, 35);
  });

  it("os dois blocos de risco no grau máximo somam 50, contra os 35 da renda", () => {
    const risco = calcula([
      { grau: "educacao_especial", origem: "aferido" },
      { grau: "protecao_crianca", origem: "aferido" },
    ]);
    assert.equal(risco.confirmados, 50);
    assert.ok(risco.confirmados > rendaMaxima.confirmados);
  });

  it("mesmo em graus intermediários o risco acumulado supera a renda máxima", () => {
    // Criança da educação especial (25) em família com violência no núcleo
    // atestada (20). Na régua de 2025 esse perfil somava 25 + 4 = 29 e perdia
    // para os 51 de um cadastro. Aqui faz 45 contra 35.
    const risco = calcula([
      { grau: "educacao_especial", origem: "aferido" },
      { grau: "violencia_nucleo", origem: "atestado" },
    ]);
    assert.equal(risco.confirmados, 45);
    assert.ok(
      risco.confirmados > rendaMaxima.confirmados,
      "risco agudo acumulado tem de superar pobreza máxima — é o defeito D4",
    );
  });
});

describe("origem: só o confirmado ordena a fila", () => {
  it("o declarado fica fora de confirmados e aparece em aConfirmar", () => {
    const p = calcula([
      { grau: "renda_extrema", origem: "aferido" },
      { grau: "violencia_nucleo", origem: "declarado" },
    ]);
    assert.equal(p.confirmados, 35);
    assert.equal(p.aConfirmar, 20);
    assert.equal(p.pendentes.length, 1);
  });

  it("declaração não alcança grau que exige aferição", () => {
    // O grau de 10 do bloco de cuidado exige composição familiar do CadÚnico.
    // A pergunta condicional dá acesso apenas ao de 6, e a régua tem de recusar
    // o de 10 mesmo se alguém montar o payload à mão.
    const p = calcula([{ grau: "responsavel_unico", origem: "declarado" }]);
    assert.equal(p.confirmados, 0);
    assert.equal(p.aConfirmar, 0);
    assert.equal(p.blocos.length, 0);
  });

  it("declarar um item que perde para um confirmado não promete pontos", () => {
    // Confirmado: educação especial (25). Declarado: doença grave da criança
    // (18). Com teto por bloco o declarado não acrescenta nada — e a tela não
    // pode prometer 18 pontos que a comprovação nunca vai entregar.
    const p = calcula([
      { grau: "educacao_especial", origem: "aferido" },
      { grau: "crianca_doenca_grave", origem: "declarado" },
    ]);
    assert.equal(p.confirmados, 25);
    assert.equal(p.aConfirmar, 0);
    assert.equal(
      p.blocos.find((b) => b.numero === 3)?.itens.find((i) => i.grau === "crianca_doenca_grave")
        ?.suprimidoPeloTeto,
      true,
    );
  });

  it("grau inexistente é descartado sem quebrar o cálculo", () => {
    const p = calcula([
      { grau: "nao_existe", origem: "aferido" },
      { grau: "renda_baixa", origem: "aferido" },
    ]);
    assert.equal(p.confirmados, 20);
  });

  it("sem nenhum item, a pontuação é zero e não há bloco a exibir", () => {
    const p = calcula([]);
    assert.equal(p.confirmados, 0);
    assert.equal(p.aConfirmar, 0);
    assert.deepEqual(p.blocos, []);
  });
});

describe("medida protetiva", () => {
  it("pontua e vem marcada como protegida, para a tela não exibir a origem", () => {
    const p = calcula([{ grau: "protecao_crianca", origem: "aferido" }]);
    assert.equal(p.confirmados, 25);
    assert.equal(p.blocos[0].itens[0].protegido, true);
  });
});

describe("convivência das duas réguas", () => {
  it("é monótona e ancorada em zero e no teto", () => {
    assert.equal(equivalenteNaFila2025(0), 0);
    assert.equal(equivalenteNaFila2025(100), 100);
    assert.equal(equivalenteNaFila2025(35), 51);
    let anterior = -1;
    for (let i = 0; i <= 100; i++) {
      const v = equivalenteNaFila2025(i);
      assert.ok(v >= anterior, `a conversão regrediu em ${i}: ${v} depois de ${anterior}`);
      anterior = v;
    }
  });

  it("satura fora da faixa em vez de extrapolar", () => {
    assert.equal(equivalenteNaFila2025(-10), 0);
    assert.equal(equivalenteNaFila2025(500), 100);
  });
});

describe("um grau, uma linha", () => {
  it("o mesmo grau chegando por dois caminhos fica com a origem mais forte", () => {
    // O SISVAN registra déficit nutricional da criança e a família também
    // responde "sim" à pergunta de doença grave: os dois viram o mesmo grau.
    const p = calcula([
      { grau: "crianca_doenca_grave", origem: "aferido" },
      { grau: "crianca_doenca_grave", origem: "declarado" },
    ]);
    assert.equal(p.confirmados, 18);
    assert.equal(p.aConfirmar, 0, "não pode prometer pontos que já estão confirmados");
    assert.equal(p.blocos[0].itens.length, 1, "a decomposição não pode repetir a linha");
    assert.equal(p.blocos[0].itens[0].origem, "aferido");
    assert.equal(p.pendentes.length, 0);
  });

  it("a ordem de chegada não muda o resultado", () => {
    const a = calcula([
      { grau: "violencia_nucleo", origem: "declarado" },
      { grau: "violencia_nucleo", origem: "atestado" },
    ]);
    assert.equal(a.confirmados, 20);
    assert.equal(a.aConfirmar, 0);
    assert.equal(a.blocos[0].itens.length, 1);
  });
});
