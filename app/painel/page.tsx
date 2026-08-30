import type { Metadata } from "next";

import { backtest, catalogo, fatos, rodada, unidades, type Unidade } from "@/lib/dados";

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

export default function Pagina() {
  const { resultado, violacoes, duracaoMs } = rodada();

  // ─── ociosidade: assento com vaga que a rodada não conseguiu preencher
  const porAssento = new Map<string, { unidade: Unidade | undefined; grupamento: string; horario: string; capacidade: number; ocupado: number }>();
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
      const u = v.unidade;
      const a = u?.assentos.find((x) => x.grupamento === v.grupamento && x.horario === v.horario);
      return { id, ...v, procura: a?.procura ?? 0, razao: (a?.procura ?? 0) / Math.max(v.capacidade, 1) };
    })
    .filter((x) => x.capacidade >= 10)
    .sort((a, b) => b.razao - a.razao)
    .slice(0, 12);

  // ─── déficit por bairro: demanda que o bairro não consegue absorver
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
    .map(([bairro, v]) => ({ bairro, ...v, deficit: v.procura - v.vagas, razao: v.procura / Math.max(v.vagas, 1) }))
    .filter((x) => x.vagas >= 30)
    .sort((a, b) => b.razao - a.razao)
    .slice(0, 12);

  const semAssento = resultado.semAssento.length;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="eyebrow mb-3">Painel da rede · processo {backtest.processo.prmId} · {backtest.processo.ano}</p>
      <h1 className="titulo mb-4 text-[clamp(30px,6vw,48px)]">A rodada, por dentro.</h1>
      <p className="mb-10 max-w-[62ch] text-[16.5px] text-ink-2">
        Esta é a mesma rodada que classifica as inscrições do site, executada sobre a fila real de{" "}
        {backtest.processo.ano}. Nada aqui é estimativa: é a saída do motor, com a verificação de
        estabilidade rodando junto.
      </p>

      {/* ─── identidade da rodada */}
      <section className="mb-12">
        <h2 className="rotulo mb-3">Identidade da rodada</h2>
        <dl className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          <Cel rotulo="rodada_id" valor={resultado.rodadaId} mono />
          <Cel rotulo="hash das entradas" valor={`${resultado.hashEntrada.slice(0, 16)}…`} mono />
          <Cel rotulo="catálogo de pontuação" valor={`v${resultado.catalogoVersao} · ${catalogo.criterios.length} itens`} />
          <Cel rotulo="semente do sorteio" valor={resultado.semente} mono />
        </dl>
        <p className="mt-3 text-[14px] text-ink-3">
          Reexecutar a mesma rodada com as mesmas entradas produz o mesmo resultado, sempre. A semente seria
          publicada no Diário Oficial antes da rodada, para que qualquer auditor refaça a classificação.
        </p>
      </section>

      {/* ─── garantias */}
      <section className="mb-12">
        <h2 className="rotulo mb-3">Garantias verificadas nesta rodada</h2>
        <dl className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          <Cel
            rotulo="pares bloqueadores"
            valor={String(violacoes.length)}
            tom={violacoes.length === 0 ? "match" : "break"}
            apoio="ninguém à frente na fila foi ultrapassado"
          />
          <Cel rotulo="convites por criança" valor="máx. 1" tom="match" apoio="a unidade de alocação é a criança" />
          <Cel rotulo="tempo da rodada" valor={`${duracaoMs} ms`} apoio={`${n(resultado.propostas)} propostas avaliadas`} />
          <Cel
            rotulo="crianças classificadas"
            valor={n(fatos.criancas)}
            apoio={`de ${n(fatos.inscricoes)} inscrições`}
          />
        </dl>
      </section>

      {/* ─── ocupação */}
      <section className="mb-12">
        <h2 className="rotulo mb-3">Ocupação da rede</h2>
        <dl className="mb-4 grid gap-px border border-rule bg-rule sm:grid-cols-4">
          <Cel rotulo="vagas do processo" valor={n(vagasTotais)} apoio={`em ${n(porAssento.size)} assentos`} />
          <Cel rotulo="vagas preenchidas" valor={n(preenchidas)} tom="match" apoio={`${((100 * preenchidas) / vagasTotais).toFixed(1)}% da capacidade`} />
          <Cel
            rotulo="vagas ociosas"
            valor={n(vagasOciosas)}
            tom="signal"
            apoio="ninguém que as escolheu ficou sem atendimento"
          />
          <Cel rotulo="crianças sem assento" valor={n(semAssento)} apoio="nenhuma das opções tinha vaga" />
        </dl>
        <p className="max-w-[64ch] text-[14.5px] text-ink-2">
          A vaga ociosa aqui não é falha do motor: são assentos que sobraram porque toda criança que os
          escolheu já foi atendida em opção melhor. É exatamente a informação que o Eixo 1 precisa — onde a
          oferta está no lugar errado em relação à demanda.
        </p>
      </section>

      {/* ─── onde a oferta está no lugar errado */}
      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="rotulo mb-3">Assentos com mais vaga sobrando</h2>
          <ul className="divide-y divide-rule border border-rule bg-surface">
            {ociosos.slice(0, 10).map((x) => (
              <li key={x.id} className="flex items-baseline gap-3 px-4 py-3">
                <span className="num w-10 shrink-0 text-right text-[15px] font-semibold text-signal">{x.sobra}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[14.5px] font-semibold">
                    {x.unidade?.nome ?? x.id}
                  </span>
                  <span className="rotulo">
                    {x.unidade?.bairro} · {x.grupamento} · {x.horario} · {x.capacidade} vagas
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="rotulo mb-3">Assentos com mais pressão de demanda</h2>
          <ul className="divide-y divide-rule border border-rule bg-surface">
            {pressao.slice(0, 10).map((x) => (
              <li key={x.id} className="flex items-baseline gap-3 px-4 py-3">
                <span className="num w-12 shrink-0 text-right text-[15px] font-semibold text-break">
                  {x.razao.toFixed(1)}×
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[14.5px] font-semibold">
                    {x.unidade?.nome ?? x.id}
                  </span>
                  <span className="rotulo">
                    {x.unidade?.bairro} · {x.grupamento} · {n(x.procura)} opções para {x.capacidade} vagas
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ─── bairros */}
      <section className="mt-12">
        <h2 className="rotulo mb-3">Bairros com maior pressão por vaga</h2>
        <div className="overflow-x-auto border border-rule bg-surface">
          <table className="w-full min-w-[560px] border-collapse text-[14.5px]">
            <thead>
              <tr>
                <th className="rotulo border-b border-ink px-4 py-2 text-left font-medium">Bairro</th>
                <th className="rotulo border-b border-ink px-4 py-2 text-right font-medium">Unidades</th>
                <th className="rotulo border-b border-ink px-4 py-2 text-right font-medium">Vagas</th>
                <th className="rotulo border-b border-ink px-4 py-2 text-right font-medium">Opções recebidas</th>
                <th className="rotulo border-b border-ink px-4 py-2 text-right font-medium">Por vaga</th>
              </tr>
            </thead>
            <tbody>
              {bairros.map((b) => (
                <tr key={b.bairro}>
                  <td className="border-b border-rule px-4 py-2.5">{b.bairro}</td>
                  <td className="num border-b border-rule px-4 py-2.5 text-right">{b.unidades}</td>
                  <td className="num border-b border-rule px-4 py-2.5 text-right">{n(b.vagas)}</td>
                  <td className="num border-b border-rule px-4 py-2.5 text-right">{n(b.procura)}</td>
                  <td className="num border-b border-rule px-4 py-2.5 text-right font-semibold text-break">
                    {b.razao.toFixed(1)}×
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-[64ch] text-[14px] text-ink-3">
          Contagem de opções, não de crianças: a mesma criança escolhe até cinco creches. Serve para comparar
          pressão relativa entre bairros, não como demanda absoluta.
        </p>
      </section>

      {/* ─── ressalva */}
      <section className="mt-12 border-l-[3px] border-break bg-surface px-5 py-4">
        <p className="rotulo mb-2">Ressalvas que acompanham estes números</p>
        <ul className="list-inside list-disc space-y-1.5 text-[14.5px] text-ink-2">
          <li>
            A capacidade de cada assento é quantas crianças a rede matriculou nele em {backtest.processo.ano}.
            Não é a capacidade autorizada: para isso seria preciso subtrair renovações e transferências
            internas do sistema de gestão acadêmica.
          </li>
          <li>
            As tabelas de unidades parceiras vêm de planilhas consolidadas pelas CREs — é onde o ruído se
            concentra. Valide amostras antes de qualquer decisão de abertura de vaga.
          </li>
          <li>
            Os pesos das perguntas mudaram entre 2023 e 2024. Comparar anos sem versionar o catálogo produz
            número errado com aparência de certo. Este painel usa apenas o processo{" "}
            {backtest.processo.prmId}.
          </li>
        </ul>
      </section>
    </div>
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
  tom?: "match" | "signal" | "break";
}) {
  const cor = tom === "match" ? "text-match" : tom === "signal" ? "text-signal" : tom === "break" ? "text-break" : "";
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="rotulo mb-1">{rotulo}</dt>
      <dd
        className={`${mono ? "num text-[13px]" : "font-display text-[20px] font-bold tracking-tight"} ${cor} break-words`}
      >
        {valor}
        {apoio && (
          <span className="mt-1 block font-body text-[13px] font-normal leading-snug text-ink-3">{apoio}</span>
        )}
      </dd>
    </div>
  );
}
