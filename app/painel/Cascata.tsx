"use client";

import { useState } from "react";

interface AssentoOpcao {
  assento: string;
  unidade: string;
  bairro: string | null;
  grupamento: string;
  horario: string;
  vagas: number;
  procura: number;
}

interface Elo {
  passo: number;
  candidato: string;
  unidade: string;
  bairro: string | null;
  grupamento: string;
  horario: string;
  ordemRecebida: number;
  ordemAnterior: number | null;
  unidadeAnterior: string | null;
  disputavam: number;
  descricao: string;
}

interface Resultado {
  assento: string;
  unidade: string;
  bairro: string | null;
  grupamento: string;
  horario: string;
  desistente: string;
  elos: Elo[];
  assentoOcioso: { unidade: string; grupamento: string; horario: string } | null;
  candidatosAvaliados: number;
  duracaoMs: number;
  filaCompleta: number;
}

const n = (v: number) => v.toLocaleString("pt-BR");

export default function Cascata({ opcoes }: { opcoes: AssentoOpcao[] }) {
  const [escolhido, setEscolhido] = useState(opcoes[0]?.assento ?? "");
  const [rodando, setRodando] = useState(false);
  const [r, setR] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");

  const simular = async () => {
    setRodando(true);
    setErro("");
    setR(null);
    try {
      const resp = await fetch("/api/cascata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assento: escolhido }),
      });
      const d = await resp.json();
      if (!resp.ok) {
        setErro(d.erro ?? "Não foi possível simular.");
        return;
      }
      setR(d);
    } catch {
      setErro("Falha de rede ao simular a vaga liberada.");
    } finally {
      setRodando(false);
    }
  };

  const atual = opcoes.find((o) => o.assento === escolhido);

  return (
    <div>
      <p className="mb-5 max-w-[64ch] text-[15px] text-ink-2">
        Hoje, uma vaga liberada em março leva semanas de telefonema até alguém ocupá-la. O motor resolve a
        cadeia inteira de uma vez: o assento vai para a criança de maior prioridade que o prefere ao que tem,
        o assento que ela larga vai para a próxima, e assim por diante — até chegar num assento que ninguém à
        espera prefere. Só o fecho da cascata é reprocessado, não a rede.
      </p>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="min-w-[280px] flex-1">
          <span className="rotulo">Assento onde uma criança desiste</span>
          <select
            value={escolhido}
            onChange={(e) => setEscolhido(e.target.value)}
            className="mt-2 w-full border border-rule bg-white px-4 py-3 text-[14.5px]"
          >
            {opcoes.map((o) => (
              <option key={o.assento} value={o.assento}>
                {o.unidade} · {o.grupamento} · {o.horario} ({o.vagas} vagas, {n(o.procura)} opções)
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={simular}
          disabled={rodando || !escolhido}
          className="border border-ink bg-ink px-6 py-3 font-display text-[15px] font-semibold text-surface transition hover:bg-ink-2 disabled:cursor-not-allowed disabled:border-rule disabled:bg-rule"
        >
          {rodando ? "Rodando a cascata…" : "Liberar uma vaga"}
        </button>
      </div>

      {atual && !r && (
        <p className="rotulo mb-4">
          {atual.bairro} · {(atual.procura / atual.vagas).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}{" "}
          candidatos por vaga
        </p>
      )}

      {erro && (
        <div className="border-l-[3px] border-break bg-break-soft px-4 py-3" role="alert">
          <p className="text-[14.5px]">{erro}</p>
        </div>
      )}

      {r && (
        <div>
          <div className="mb-5 border-l-[3px] border-signal bg-white px-5 py-4">
            <p className="rotulo mb-1">Vaga liberada</p>
            <p className="font-display text-[18px] font-bold">{r.unidade}</p>
            <p className="mt-1 text-[14px] text-ink-2">
              {r.bairro} · {r.grupamento} · {r.horario} — a criança <span className="num">{r.desistente}</span>{" "}
              desistiu
            </p>
          </div>

          <ol className="mb-5">
            {r.elos.map((e, i) => (
              <li key={e.passo} className="relative border-l-2 border-rule pb-5 pl-6 last:pb-0">
                <span className="num absolute -left-[13px] top-0 flex size-6 items-center justify-center rounded-full bg-match text-[11px] font-semibold text-surface">
                  {e.passo}
                </span>
                <p className="font-display text-[15.5px] font-semibold">{e.unidade}</p>
                <p className="mt-0.5 text-[14px] text-ink-2">
                  <span className="num">{e.candidato}</span> {e.descricao}
                </p>
                <p className="rotulo mt-1">
                  {e.grupamento} · {e.horario} · {n(e.disputavam)} disputavam este assento
                </p>
                {i === r.elos.length - 1 && r.assentoOcioso && (
                  <p className="mt-2 text-[13.5px] text-signal">
                    A cadeia para aqui: {r.assentoOcioso.unidade} ({r.assentoOcioso.grupamento} ·{" "}
                    {r.assentoOcioso.horario}) ficou com a vaga, e nenhuma criança à espera a prefere ao que
                    já tem.
                  </p>
                )}
              </li>
            ))}
            {r.elos.length === 0 && (
              <li className="text-[14.5px] text-ink-2">
                Nenhuma criança à espera prefere esta vaga ao que já tem. O assento fica ocioso — e é
                exatamente esse caso que o painel de ociosidade precisa mostrar para o Eixo 1.
              </li>
            )}
          </ol>

          <dl className="grid gap-px border border-rule bg-rule sm:grid-cols-3">
            <div className="bg-white px-4 py-3">
              <dt className="rotulo mb-1">crianças remanejadas</dt>
              <dd className="font-display text-[20px] font-bold">{r.elos.length}</dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="rotulo mb-1">candidatos avaliados</dt>
              <dd className="font-display text-[20px] font-bold">
                {n(r.candidatosAvaliados)}
                <span className="mt-1 block font-body text-[12.5px] font-normal text-ink-3">
                  em vez das {n(r.filaCompleta)} da fila inteira
                </span>
              </dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="rotulo mb-1">tempo</dt>
              <dd className="font-display text-[20px] font-bold text-match">
                {r.duracaoMs.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ms
                <span className="mt-1 block font-body text-[12.5px] font-normal text-ink-3">
                  hoje: 3 dias úteis por convite, em série
                </span>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
