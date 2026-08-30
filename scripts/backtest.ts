/**
 * Backtest do motor contra o processo real de 2025 (prm_id 195).
 *
 * Regra do experimento: mesma fila, mesma capacidade. A capacidade de cada
 * assento é exatamente quantas crianças a rede colocou nele em 2025, então o
 * motor não pode ganhar inventando vaga que não existia. O que se compara é
 * quem ficou com as vagas, em que opção, e quantos assentos ficaram travados no
 * caminho.
 *
 * Roda sem transpilador:  node scripts/backtest.ts
 * Escreve lib/data/backtest.json, que a aplicação lê.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { alocar, assentoId, verificarEstabilidade } from "../lib/engine/index.ts";
import type { Assento, ParametrosRodada } from "../lib/engine/index.ts";
import { agrupaPorCrianca, decodificaFila } from "../lib/fila.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DATA = join(AQUI, "..", "lib", "data");

const ler = (nome: string) => JSON.parse(readFileSync(join(DATA, nome), "utf-8"));

const unidades = ler("unidades.json");
const catalogo = ler("catalogo-2025.json");
const fila = ler("fila-2025.json");
const seed = ler("fila-seed.json"); // com a situação histórica; fora do bundle

const SEMENTE = "D.O.-RIO-2025-08-30-processo-195";
const ORDEM_DESEMPATE: number[] = catalogo.criterios
  .filter((c: { desempate: boolean }) => c.desempate)
  .sort((a: { ordem: number }, b: { ordem: number }) => a.ordem - b.ordem)
  .map((c: { pergId: number }) => c.pergId);

// ───────────────────────────────────────────────────────── entradas da rodada

const assentos: Assento[] = [];
for (const u of unidades) {
  for (const a of u.assentos) {
    assentos.push({
      id: assentoId(u.codigo, a.grupamento, a.horario),
      unidade: u.codigo,
      grupamento: a.grupamento,
      horario: a.horario,
      capacidade: a.capacidade,
    });
  }
}

const inscricoes = decodificaFila(fila);
const candidatos = agrupaPorCrianca(inscricoes);

const vagas = assentos.reduce((s, a) => s + a.capacidade, 0);
console.log(`fila: ${inscricoes.length.toLocaleString("pt-BR")} inscrições -> ${candidatos.length.toLocaleString("pt-BR")} crianças`);
console.log(`rede: ${assentos.length.toLocaleString("pt-BR")} assentos, ${vagas.toLocaleString("pt-BR")} vagas`);

// ──────────────────────────────────────────────────────────────── a rodada

const parametros: ParametrosRodada = {
  candidatos,
  assentos,
  semente: SEMENTE,
  catalogoVersao: catalogo.versao,
  ordemDesempate: ORDEM_DESEMPATE,
};

const t0 = performance.now();
const r = alocar(parametros);
const msRodada = performance.now() - t0;
console.log(`\nrodada: ${msRodada.toFixed(0)} ms, ${r.propostas.toLocaleString("pt-BR")} propostas avaliadas`);
console.log(`rodada_id: ${r.rodadaId}`);

const t1 = performance.now();
const violacoes = verificarEstabilidade(parametros, r);
const msVerificacao = performance.now() - t1;
console.log(`verificação de estabilidade: ${msVerificacao.toFixed(0)} ms, ${violacoes.length} violações`);
if (violacoes.length) console.log(violacoes.slice(0, 5));

// ────────────────────────────────────────────────────────── o que aconteceu

const CONFIRMADO = "Confirmado";
const RESERVOU = new Set([CONFIRMADO, "Selecionado", "Selecionado da lista", "Cancelado na confirmacao"]);

let histConfirmados = 0;
let histReservas = 0;
const histPorOpcao: Record<number, number> = {};
const criancasComReserva = new Map<string, number>();
const criancaDaInscricao = new Map<string, string>();

for (const s of seed) {
  criancaDaInscricao.set(s.id, s.aluno);
  for (let i = 0; i < s.opcoes.length; i++) {
    const sit = s.situacaoHistorica[i];
    if (sit === CONFIRMADO) {
      histConfirmados++;
      const o = s.opcoes[i].ordem;
      histPorOpcao[o] = (histPorOpcao[o] ?? 0) + 1;
    }
    if (RESERVOU.has(sit)) {
      histReservas++;
      criancasComReserva.set(s.aluno, (criancasComReserva.get(s.aluno) ?? 0) + 1);
    }
  }
}

let criancasMultiReserva = 0;
let assentosRetidos = 0;
for (const n of criancasComReserva.values()) {
  if (n > 1) {
    criancasMultiReserva++;
    assentosRetidos += n - 1;
  }
}

// ───────────────────────────────────────────────────────────── o que o motor faz

const motorPorOpcao: Record<number, number> = {};
for (const a of r.alocacoes) motorPorOpcao[a.ordemPreferencia] = (motorPorOpcao[a.ordemPreferencia] ?? 0) + 1;

const criancasAlocadas = new Set(r.alocacoes.map((a) => a.candidato));
const convitesPorCrianca = new Map<string, number>();
for (const a of r.alocacoes) {
  convitesPorCrianca.set(a.candidato, (convitesPorCrianca.get(a.candidato) ?? 0) + 1);
}
const motorMulti = [...convitesPorCrianca.values()].filter((n) => n > 1).length;

const ocupadas = Object.values(r.ocupacao).reduce((s, n) => s + n, 0);

const pct = (n: number, d: number) => Math.round((1000 * n) / d) / 10;
const linha = (rot: string, hist: string, motor: string) =>
  console.log(`  ${rot.padEnd(38)} ${hist.padStart(12)}   ${motor.padStart(12)}`);

console.log(`\n${"".padEnd(38)} ${"2025 real".padStart(12)}   ${"motor".padStart(12)}`);
console.log("  " + "─".repeat(66));
linha("vagas preenchidas", histConfirmados.toLocaleString("pt-BR"), ocupadas.toLocaleString("pt-BR"));
linha("crianças atendidas", "—", criancasAlocadas.size.toLocaleString("pt-BR"));
linha("assentos reservados no processo", histReservas.toLocaleString("pt-BR"), ocupadas.toLocaleString("pt-BR"));
linha(
  "crianças ocupando mais de um assento",
  criancasMultiReserva.toLocaleString("pt-BR"),
  motorMulti.toLocaleString("pt-BR"),
);
linha("assentos travados por oferta múltipla", assentosRetidos.toLocaleString("pt-BR"), "0");
linha("reservas que não viraram matrícula", (histReservas - histConfirmados).toLocaleString("pt-BR"), "0");

console.log("\n  atendimento por posição na preferência");
for (const o of [1, 2, 3, 4, 5]) {
  const h = histPorOpcao[o] ?? 0;
  const m = motorPorOpcao[o] ?? 0;
  const barra = (n: number) => "█".repeat(Math.round((n / Math.max(histConfirmados, ocupadas)) * 40));
  console.log(
    `   ${o}ª opção  real ${String(h).padStart(6)} (${String(pct(h, histConfirmados)).padStart(4)}%)  ` +
      `motor ${String(m).padStart(6)} (${String(pct(m, ocupadas)).padStart(4)}%) ${barra(m)}`,
  );
}

const primeiraReal = pct(histPorOpcao[1] ?? 0, histConfirmados);
const primeiraMotor = pct(motorPorOpcao[1] ?? 0, ocupadas);

const resultado = {
  gerardoEm: new Date().toISOString(),
  processo: { prmId: 195, ano: 2025 },
  fonte: "CIT-SME-RJ/dadoscreche — Query A e Query B do processo 195",
  metodo:
    "Mesma fila e mesma capacidade do processo real. A capacidade de cada assento é o número de crianças que a rede efetivamente matriculou nele em 2025, então o motor não pode alocar em vaga que não existia.",
  rodada: {
    rodadaId: r.rodadaId,
    hashEntrada: r.hashEntrada,
    semente: SEMENTE,
    catalogoVersao: r.catalogoVersao,
    inscricoes: inscricoes.length,
    criancas: candidatos.length,
    assentos: assentos.length,
    vagas,
    propostas: r.propostas,
    duracaoMs: Math.round(msRodada),
    verificacaoMs: Math.round(msVerificacao),
    violacoes: violacoes.length,
  },
  historico: {
    vagasPreenchidas: histConfirmados,
    assentosReservados: histReservas,
    reservasSemMatricula: histReservas - histConfirmados,
    criancasComMaisDeUmAssento: criancasMultiReserva,
    assentosTravados: assentosRetidos,
    porOpcao: histPorOpcao,
    primeiraOpcaoPct: primeiraReal,
  },
  motor: {
    vagasPreenchidas: ocupadas,
    criancasAtendidas: criancasAlocadas.size,
    assentosReservados: ocupadas,
    reservasSemMatricula: 0,
    criancasComMaisDeUmAssento: motorMulti,
    assentosTravados: 0,
    semAssento: r.semAssento.length,
    porOpcao: motorPorOpcao,
    primeiraOpcaoPct: primeiraMotor,
  },
  ganhos: {
    assentosLiberadosDeImediato: assentosRetidos,
    criancasQueDeixamDeReterVaga: criancasMultiReserva,
    pontosDeAumentoNaPrimeiraOpcao: Math.round((primeiraMotor - primeiraReal) * 10) / 10,
  },
};

writeFileSync(join(DATA, "backtest.json"), JSON.stringify(resultado, null, 1), "utf-8");
console.log("\n-> lib/data/backtest.json");

if (violacoes.length > 0) {
  console.error("\nFALHA: a rodada produziu par bloqueador. Não publicar este resultado.");
  process.exit(1);
}
