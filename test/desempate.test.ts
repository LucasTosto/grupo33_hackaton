/**
 * O vetor de desempate como parâmetro versionado.
 *
 * O que está sendo testado não é o carregamento do arquivo. É a promessa que o
 * arquivo faz: que ativar um nível que o motor não implementa **falha**, em vez
 * de produzir uma rodada silenciosamente errada. Uma rodada que não roda é
 * recuperável; uma rodada errada publicada no Diário Oficial não é.
 *
 * Roda sob o type-stripping nativo do Node 24:  node --test test/desempate.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "data");
const ler = (nome: string) => JSON.parse(readFileSync(join(DATA, nome), "utf-8"));

interface Nivel {
  nivel: number;
  chave: string;
  rotulo: string;
  sentido: string;
  ativo: boolean;
  pergIds?: number[];
  bloqueio?: string;
}

interface Vetor {
  versao: string;
  processoId: number;
  vetor: Nivel[];
  niveisImplementados: string[];
  instrumentoNormativo: { proximidade: string; observacao: string };
}

/**
 * Réplica da validação de `lib/dados.ts`. Fica aqui em vez de importar o módulo
 * porque `dados.ts` é `server-only` e carrega 4,4 MB de fila — o teste precisa
 * exercitar a regra, não o carregamento.
 */
function valida(v: Vetor): Nivel[] {
  const implementados = new Set(v.niveisImplementados);
  const ativos = v.vetor.filter((n) => n.ativo).sort((a, b) => a.nivel - b.nivel);
  for (const n of ativos) {
    if (!implementados.has(n.chave)) {
      throw new Error(
        `vetor de desempate v${v.versao}: o nível "${n.chave}" está marcado como ativo mas não é ` +
          `implementado pelo motor.`,
      );
    }
  }
  const criterios = ativos.find((n) => n.chave === "criterios_resolucao");
  if (criterios && !criterios.pergIds?.length) {
    throw new Error(`vetor de desempate v${v.versao}: nível "criterios_resolucao" sem pergIds.`);
  }
  return ativos;
}

describe("vetor de desempate como dado versionado", () => {
  const vetor = ler("desempate.json") as Vetor;
  const catalogo = ler("catalogo-2025.json");

  it("carrega e valida o arquivo em vigor", () => {
    const ativos = valida(vetor);
    assert.deepEqual(
      ativos.map((n) => n.chave),
      ["pontuacao_resolucao", "criterios_resolucao", "sorteio"],
      "a sequência em vigor é a do processo 195",
    );
  });

  it("declara a proximidade como nível inativo, com o motivo do bloqueio", () => {
    const prox = vetor.vetor.find((n) => n.chave === "proximidade");
    assert.ok(prox, "o nível de proximidade tem de estar declarado, mesmo sem vigorar");
    assert.equal(prox.ativo, false);
    assert.match(prox.bloqueio ?? "", /normativo/i, "o motivo do bloqueio fica registrado no dado");
    assert.equal(vetor.instrumentoNormativo.proximidade, "a confirmar");
  });

  it("a sequência declarada segue a ordem do documento de solução", () => {
    assert.deepEqual(
      [...vetor.vetor].sort((a, b) => a.nivel - b.nivel).map((n) => n.chave),
      ["pontuacao_resolucao", "criterios_resolucao", "proximidade", "sorteio"],
      "social -> critérios da Resolução -> proximidade -> sorteio",
    );
  });

  it("FALHA ao ativar um nível que o motor não implementa", () => {
    const adulterado: Vetor = {
      ...vetor,
      vetor: vetor.vetor.map((n) => (n.chave === "proximidade" ? { ...n, ativo: true } : n)),
    };
    assert.throws(
      () => valida(adulterado),
      /proximidade.*ativo.*não é implementado/s,
      "ativar proximidade sem implementá-la tem que quebrar, não ser ignorado",
    );
  });

  it("FALHA se o nível de critérios ficar sem pergIds", () => {
    const adulterado: Vetor = {
      ...vetor,
      vetor: vetor.vetor.map((n) => (n.chave === "criterios_resolucao" ? { ...n, pergIds: [] } : n)),
    };
    assert.throws(() => valida(adulterado), /sem pergIds/);
  });

  it("os pergIds do vetor são critérios de desempate no catálogo", () => {
    const nivel = vetor.vetor.find((n) => n.chave === "criterios_resolucao");
    const noCatalogo = new Set(
      catalogo.criterios.filter((c: { desempate: boolean }) => c.desempate).map((c: { pergId: number }) => c.pergId),
    );
    for (const p of nivel?.pergIds ?? []) {
      assert.ok(noCatalogo.has(p), `pergId ${p} do vetor não é desempate no catálogo`);
    }
  });

  it("a ordem dos pergIds acompanha a ordem de exibição do catálogo", () => {
    const nivel = vetor.vetor.find((n) => n.chave === "criterios_resolucao");
    const ordemCatalogo = catalogo.criterios
      .filter((c: { desempate: boolean }) => c.desempate)
      .sort((a: { ordem: number }, b: { ordem: number }) => a.ordem - b.ordem)
      .map((c: { pergId: number }) => c.pergId);
    assert.deepEqual(
      nivel?.pergIds,
      ordemCatalogo,
      "irmão matriculado precede responsável menor de 18, como no formulário",
    );
  });

  it("o vetor e o catálogo se referem ao mesmo processo", () => {
    assert.equal(vetor.processoId, catalogo.processoId);
    assert.equal(vetor.versao, catalogo.versao);
  });

  it("o sorteio é o último nível e ordena do menor para o maior", () => {
    const ativos = valida(vetor);
    const ultimo = ativos[ativos.length - 1];
    assert.equal(ultimo.chave, "sorteio", "o sorteio é o desempate final, sempre");
    assert.equal(ultimo.sentido, "menor_primeiro");
  });
});
