/**
 * Testes da lista canônica de bairros.
 *
 * O defeito que este arquivo existe para impedir é silencioso: o seletor
 * oferecia as variações cruas da base, a família escolhia a variante "errada", e
 * a distância — que decide o desempate por proximidade — era calculada contra
 * outro centróide. Não havia como a família saber que tinha errado.
 *
 * O teste mais importante é o último: **todo valor de bairro do cadastro de
 * unidades tem de resolver para um bairro oficial.** Um valor sem
 * correspondência é uma unidade sem centróide, e uma unidade sem centróide é uma
 * creche que nunca aparece ordenada por proximidade.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { bairroCanonico, BAIRROS_OFICIAIS, buscaBairros, chaveBairro, geoAproximada } from "../lib/bairros.ts";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("normalização", () => {
  it("ignora acento, caixa e pontuação", () => {
    assert.equal(chaveBairro("Jacarepaguá"), "JACAREPAGUA");
    assert.equal(chaveBairro("  são   cristóvão "), "SAO CRISTOVAO");
    assert.equal(chaveBairro("Conj. Hab. Amarelinho - Irajá"), "CONJ HAB AMARELINHO IRAJA");
  });
});

describe("correspondência com o bairro oficial", () => {
  const casos: [string, string][] = [
    // as quatro grafias de Andaraí que a base traz
    ["Andaraí", "Andaraí"],
    ["ANDARAÍ", "Andaraí"],
    ["Andaraí - Jamelão", "Andaraí"],
    ["Andaraí - Morro do Andaraí", "Andaraí"],
    // sub-localidade e conjunto habitacional no lugar do bairro
    ["Conj. Hab. Amarelinho - Irajá", "Irajá"],
    ["Jardim dos Vieiras, Paciência", "Paciência"],
    ["BOREL / TIJUCA", "Tijuca"],
    ["Copacabana - Morro dos Cabritos", "Copacabana"],
    // bairro antes da RA, e RA antes do bairro
    ["Carobinha -Campo Grande", "Campo Grande"],
    ["Camorim- Jacarepaguá", "Camorim"],
    ["CIDADE DE DEUS / JACAREPAGUÁ", "Cidade de Deus"],
    // as duas Freguesias são bairros distintos de mesmo nome
    ["FREGUESIA (ILHA DO GOV.)", "Freguesia (Ilha do Governador)"],
    ["FREGUESIA / JACAREPAGUÁ", "Freguesia (Jacarepaguá)"],
    // erro de grafia e nome incompleto na base
    ["Alto Boa Vista", "Alto da Boa Vista"],
    ["Cavalcante", "Cavalcanti"],
    ["Recreio", "Recreio dos Bandeirantes"],
    ["OSWALDO CRUZ", "Osvaldo Cruz"],
    // caixa baixa
    ["campo grande", "Campo Grande"],
  ];

  for (const [bruto, esperado] of casos) {
    it(`"${bruto}" resolve para "${esperado}"`, () => {
      assert.equal(bairroCanonico(bruto), esperado);
    });
  }

  it("o nome mais longo ganha quando os dois começam no mesmo ponto", () => {
    assert.equal(bairroCanonico("PENHA CIRCULAR"), "Penha Circular");
    assert.equal(bairroCanonico("PENHA"), "Penha");
  });

  it("não casa em fronteira de palavra parcial", () => {
    // `ANIL` não pode casar dentro de `MANGUINHOS`, nem `ACARI` dentro de
    // `JACAREPAGUA`.
    assert.equal(bairroCanonico("Manguinhos"), "Manguinhos");
    assert.equal(bairroCanonico("Jacarepaguá"), "Jacarepaguá");
  });

  it("valor de fora do município devolve null em vez de casar por engano", () => {
    for (const fora of ["TOMAZINHO", "ENGENHEIRO BELFORD", "VILA ROSALI", "ITAIPU"]) {
      assert.equal(bairroCanonico(fora), null, `"${fora}" não é bairro do município`);
    }
  });

  it("vazio e nulo não quebram", () => {
    assert.equal(bairroCanonico(""), null);
    assert.equal(bairroCanonico(null), null);
    assert.equal(bairroCanonico(undefined), null);
  });
});

describe("busca tolerante", () => {
  it("encontra sem acento", () => {
    assert.ok(buscaBairros("jacarepagua").includes("Jacarepaguá"));
    assert.ok(buscaBairros("sao cristovao").includes("São Cristóvão"));
  });

  it("encontra por prefixo de qualquer palavra do nome", () => {
    assert.ok(buscaBairros("bandeirantes").includes("Recreio dos Bandeirantes"));
  });

  it("termo vazio devolve a lista, em ordem alfabética", () => {
    const r = buscaBairros("", 5);
    assert.equal(r.length, 5);
    assert.deepEqual(r, [...r].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });
});

describe("precisão geográfica", () => {
  it("marca os territórios de CEP único", () => {
    assert.equal(geoAproximada("Rocinha"), true);
    assert.equal(geoAproximada("Maré"), true);
    assert.equal(geoAproximada("Copacabana"), false);
  });
});

describe("cobertura do cadastro de unidades", () => {
  it("nenhum bairro do cadastro fica sem correspondência", () => {
    const unidades = JSON.parse(readFileSync(join(raiz, "lib/data/unidades.json"), "utf8")) as {
      bairro: string | null;
    }[];
    const brutos = [...new Set(unidades.map((u) => u.bairro).filter(Boolean) as string[])];
    const semMatch = brutos.filter((b) => !bairroCanonico(b));

    assert.deepEqual(
      semMatch,
      [],
      `bairros do cadastro sem bairro oficial correspondente: ${semMatch.join(" | ")}`,
    );
    // A canonicalização tem de reduzir de fato, e não ser identidade disfarçada.
    const canonicos = new Set(brutos.map((b) => bairroCanonico(b)));
    assert.ok(canonicos.size < brutos.length / 1.5, `${brutos.length} valores viraram ${canonicos.size} bairros`);
  });

  it("a lista oficial não tem duplicata por normalização", () => {
    const chaves = BAIRROS_OFICIAIS.map((b) => chaveBairro(b));
    assert.equal(new Set(chaves).size, chaves.length, "há dois bairros oficiais com a mesma chave normalizada");
  });
});
