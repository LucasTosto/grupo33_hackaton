import type { Metadata } from "next";

import { assentosParaSimular, backtest, catalogo, fatos, rodada, unidades, type Unidade } from "@/lib/dados";

import Cascata from "./Cascata";

/**
 * A rodada completa (62.899 crianças, 2.114 assentos) mais a verificação de
 * estabilidade levam alguns segundos. Como as entradas são dados versionados no
 * repositório, o painel é gerado no build: em produção ele serve instantâneo, e
 * ainda assim mostra a saída real do motor, não um número copiado à mão.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Painel da rede · Vaga Certa",
  description: "Rodada, ociosidade por assento e pressão de demanda por bairro na rede municipal de creche.",
};

const n = (v: number) => v.toLocaleString("pt-BR");
const dec = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function Pagina() {
  const { resultado, violacoes, duracaoMs } = rodada();

  // ─── ociosidade: assento com vaga que a rodada não conseguiu preencher
  const porAssento = new Map<
    string,
    { unidade: Unidade | undefined; grupamento: string; horario: string; capacidade: number; ocupado: number }
  >();
  for (const u of unidades) {
    for (const a of u.assentos) {
      const id = `${u.codigo}|${a.grupamento}|${a.horario}`;
      porAssento.set(id, {
        unidade: u,
        grupamento: a.grupamento,
        horario: a.horario,
        capacidade: a.capacidade,
        ocupado: resultado.ocupacao[id] ?? 0,
      });
    }
  }

  const ociosos = [...porAssento.entries()]
    .map(([id, v]) => ({ id, ...v, sobra: v.capacidade - v.ocupado }))
    .filter((x) => x.sobra > 0)
    .sort((a, b) => b.sobra - a.sobra);

  const vagasOciosas = ociosos.reduce((s, x) => s + x.sobra, 0);
  const vagasTotais = [...porAssento.values()].reduce((s, x) => s + x.capacidade, 0);
  const preenchidas = vagasTotais - vagasOciosas;

  // ─── pressão: onde a fila é mais longa por vaga
  const pressao = [...porAssento.entries()]
    .map(([id, v]) => {
      const a = v.unidade?.assentos.find((x) => x.grupamento === v.grupamento && x.horario === v.horario);
      return { id, ...v, procura: a?.procura ?? 0, razao: (a?.procura ?? 0) / Math.max(v.capacidade, 1) };
    })
    .filter((x) => x.capacidade >= 10)
    .sort((a, b) => b.razao - a.razao)
    .slice(0, 10);

  // ─── pressão por bairro
  const porBairro = new Map<string, { vagas: number; procura: number; unidades: number }>();
  for (const u of unidades) {
    if (!u.bairro) continue;
    const b = porBairro.get(u.bairro) ?? { vagas: 0, procura: 0, unidades: 0 };
    b.unidades += 1;
    for (const a of u.assentos) {
      b.vagas += a.capacidade;
      b.procura += a.procura;
    }
    porBairro.set(u.bairro, b);
  }
  const bairros = [...porBairro.entries()]
    .map(([bairro, v]) => ({ bairro, ...v, razao: v.procura / Math.max(v.vagas, 1) }))
    .filter((x) => x.vagas >= 30)
    .sort((a, b) => b.razao - a.razao)
    .slice(0, 12);

  return (
    <>
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <p className="rotulo mb-2 text-azul-medio">
            Painel da rede · Processo {backtest.processo.prmId} · {backtest.processo.ano}
          </p>
          <h1 className="mb-4 text-[clamp(24px,4.2vw,34px)] font-black tracking-[-0.03em] text-azul">
            A rodada de classificação, por dentro.
          </h1>
          <p className="max-w-[72ch] text-[16px] text-texto-2">
            Esta é a mesma rodada que classifica as inscrições do serviço, executada sobre a fila real de{" "}
            {backtest.processo.ano}. Nada aqui é estimativa: é a saída do motor, com a verificação de
            estabilidade rodando junto.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-10">
        {/* ─── identidade da rodada ─── */}
        <section>
          <h2 className="secao-titulo mb-4">Identidade da rodada</h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cel rotulo="Identificador" valor={resultado.rodadaId} mono />
            <Cel rotulo="Hash das entradas" valor={`${resultado.hashEntrada.slice(0, 16)}…`} mono />
            <Cel
              rotulo="Catálogo de pontuação"
              valor={`v${resultado.catalogoVersao}`}
              apoio={`${catalogo.criterios.length} critérios`}
            />
            <Cel rotulo="Semente do sorteio" valor={resultado.semente} mono />
          </dl>
          <p className="mt-3 max-w-[72ch] text-[14px] text-texto-3">
            Reexecutar a mesma rodada com as mesmas entradas produz o mesmo resultado, sempre. A semente
            seria publicada no Diário Oficial antes da rodada, para que qualquer auditor refaça a
            classificação.
          </p>
        </section>

        {/* ─── garantias ─── */}
        <section>
          <h2 className="secao-titulo mb-4">Garantias verificadas nesta rodada</h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cel
              rotulo="Pares bloqueadores"
              valor={String(violacoes.length)}
              tom={violacoes.length === 0 ? "ok" : "erro"}
              apoio="ninguém à frente na fila foi ultrapassado"
            />
            <Cel rotulo="Convites por criança" valor="máx. 1" tom="ok" apoio="a unidade de alocação é a criança" />
            <Cel rotulo="Tempo da rodada" valor={`${n(duracaoMs)} ms`} apoio={`${n(resultado.propostas)} propostas`} />
            <Cel rotulo="Crianças classificadas" valor={n(fatos.criancas)} apoio={`de ${n(fatos.inscricoes)} inscrições`} />
          </dl>
        </section>

        {/* ─── rodada contínua ─── */}
        <section>
          <h2 className="secao-titulo mb-4">Uma vaga liberada no meio do ano</h2>
          <Cascata opcoes={assentosParaSimular(10)} />
        </section>

        {/* ─── ocupação ─── */}
        <section>
          <h2 className="secao-titulo mb-4">Ocupação da rede</h2>
          <dl className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cel rotulo="Vagas do processo" valor={n(vagasTotais)} apoio={`em ${n(porAssento.size)} assentos`} />
            <Cel
              rotulo="Vagas preenchidas"
              valor={n(preenchidas)}
              tom="ok"
              apoio={`${dec((100 * preenchidas) / vagasTotais)}% da capacidade`}
            />
            <Cel
              rotulo="Vagas ociosas"
              valor={n(vagasOciosas)}
              tom="atencao"
              apoio="ninguém que as escolheu ficou sem atendimento"
            />
            <Cel rotulo="Crianças sem assento" valor={n(resultado.semAssento.length)} apoio="nenhuma opção tinha vaga" />
          </dl>
          <div className="tarja">
            <p className="max-w-[74ch] text-[14.5px] text-texto-2">
              A vaga ociosa aqui não é falha do motor: são assentos que sobraram porque toda criança que os
              escolheu já foi atendida em opção melhor. É exatamente a informação de que o planejamento de
              oferta precisa — onde a vaga está no lugar errado em relação à demanda.
            </p>
          </div>
        </section>

        {/* ─── onde a oferta está no lugar errado ─── */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="secao-titulo mb-4">Assentos com mais vaga sobrando</h2>
            <ul className="cartao divide-y divide-linha overflow-hidden">
              {ociosos.slice(0, 10).map((x) => (
                <li key={x.id} className="flex items-baseline gap-3 px-4 py-3">
                  <span className="num w-12 shrink-0 rounded bg-atencao-fundo py-0.5 text-center text-[14px] font-bold text-atencao">
                    {x.sobra}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-bold">{x.unidade?.nome ?? x.id}</span>
                    <span className="num block text-[12.5px] text-texto-3">
                      {x.unidade?.bairro} · {x.grupamento} · {x.horario} · {x.capacidade} vagas
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="secao-titulo mb-4">Assentos com mais pressão de demanda</h2>
            <ul className="cartao divide-y divide-linha overflow-hidden">
              {pressao.map((x) => (
                <li key={x.id} className="flex items-baseline gap-3 px-4 py-3">
                  <span className="num w-14 shrink-0 rounded bg-erro-fundo py-0.5 text-center text-[14px] font-bold text-erro">
                    {dec(x.razao)}×
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-bold">{x.unidade?.nome ?? x.id}</span>
                    <span className="num block text-[12.5px] text-texto-3">
                      {x.unidade?.bairro} · {x.grupamento} · {n(x.procura)} opções para {x.capacidade} vagas
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ─── bairros ─── */}
        <section>
          <h2 className="secao-titulo mb-4">Bairros com maior pressão por vaga</h2>
          <div className="cartao overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-[14.5px]">
              <thead>
                <tr className="bg-azul text-white">
                  <Th>Bairro</Th>
                  <Th direita>Unidades</Th>
                  <Th direita>Vagas</Th>
                  <Th direita>Opções recebidas</Th>
                  <Th direita>Por vaga</Th>
                </tr>
              </thead>
              <tbody>
                {bairros.map((b) => (
                  <tr key={b.bairro} className="border-b border-linha last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium">
                      {b.bairro}
                    </th>
                    <td className="num px-4 py-2.5 text-right text-texto-2">{b.unidades}</td>
                    <td className="num px-4 py-2.5 text-right text-texto-2">{n(b.vagas)}</td>
                    <td className="num px-4 py-2.5 text-right text-texto-2">{n(b.procura)}</td>
                    <td className="num px-4 py-2.5 text-right font-bold text-erro">{dec(b.razao)}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-[72ch] text-[14px] text-texto-3">
            Contagem de opções, não de crianças: a mesma criança escolhe até cinco creches. Serve para
            comparar pressão relativa entre bairros, não como demanda absoluta.
          </p>
        </section>

        {/* ─── ressalvas ─── */}
        <section>
          <h2 className="secao-titulo mb-4">Ressalvas que acompanham estes números</h2>
          <ul className="cartao divide-y divide-linha overflow-hidden">
            <Ressalva>
              A capacidade de cada assento é quantas crianças a rede matriculou nele em{" "}
              {backtest.processo.ano}. Não é a capacidade autorizada: para isso seria preciso subtrair
              renovações e transferências internas do sistema de gestão acadêmica.
            </Ressalva>
            <Ressalva>
              As tabelas de unidades parceiras vêm de planilhas consolidadas pelas CREs — é onde o ruído se
              concentra. Valide amostras antes de qualquer decisão de abertura de vaga.
            </Ressalva>
            <Ressalva>
              Os pesos das perguntas mudaram entre 2023 e 2024. Comparar anos sem versionar o catálogo produz
              número errado com aparência de certo. Este painel usa apenas o processo {backtest.processo.prmId}.
            </Ressalva>
          </ul>
        </section>
      </div>
    </>
  );
}

function Th({ children, direita }: { children: React.ReactNode; direita?: boolean }) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-[11.5px] font-bold tracking-[0.08em] uppercase ${
        direita ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Cel({
  rotulo,
  valor,
  apoio,
  mono,
  tom,
}: {
  rotulo: string;
  valor: string;
  apoio?: string;
  mono?: boolean;
  tom?: "ok" | "atencao" | "erro";
}) {
  const cor =
    tom === "ok" ? "text-ok" : tom === "atencao" ? "text-atencao" : tom === "erro" ? "text-erro" : "text-azul";
  const borda =
    tom === "ok"
      ? "border-t-ok"
      : tom === "atencao"
        ? "border-t-atencao"
        : tom === "erro"
          ? "border-t-erro"
          : "border-t-azul-claro";
  return (
    <div className={`cartao border-t-[3px] ${borda} p-3.5`}>
      <dt className="rotulo mb-1">{rotulo}</dt>
      <dd>
        <span className={`num block break-words font-bold ${mono ? "font-mono text-[13px]" : "text-[20px]"} ${cor}`}>
          {valor}
        </span>
        {apoio && <span className="mt-1 block text-[12.5px] leading-snug text-texto-2">{apoio}</span>}
      </dd>
    </div>
  );
}

function Ressalva({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 px-4 py-3">
      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-atencao" />
      <p className="text-[14.5px] text-texto-2">{children}</p>
    </li>
  );
}
