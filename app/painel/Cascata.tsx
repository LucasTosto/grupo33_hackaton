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
const dec = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

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
    <div className="cartao overflow-hidden">
      <p className="cartao-titulo">Rodada contínua · simulador de vaga liberada</p>

      <div className="p-5">
        <p className="mb-5 max-w-[72ch] text-[15px] text-texto-2">
          Hoje, uma vaga liberada em março leva semanas de telefonema até alguém ocupá-la. O motor resolve a
          cadeia inteira de uma vez: o assento vai para a criança de maior prioridade que o prefere ao que
          tem, o assento que ela larga vai para a próxima, e assim por diante — até chegar num assento que
          ninguém à espera prefere. Só o fecho da cascata é reprocessado, não a rede.
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[300px] flex-1">
            <span className="rotulo mb-1.5 block">Assento onde uma criança desiste</span>
            <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)} className="campo">
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
            className="botao botao-primario disabled:cursor-not-allowed disabled:border-linha-forte disabled:bg-linha-forte"
          >
            {rodando ? "Processando…" : "Liberar uma vaga"}
          </button>
        </div>

        {atual && !r && (
          <p className="num text-[13px] text-texto-3">
            {atual.bairro} · {dec(atual.procura / atual.vagas)} candidatos por vaga
          </p>
        )}

        {erro && (
          <div className="tarja border-l-erro bg-erro-fundo" role="alert">
            <p className="text-[14.5px]">{erro}</p>
          </div>
        )}

        {r && (
          <div>
            <div className="tarja mb-5 border-l-atencao bg-atencao-fundo">
              <p className="rotulo mb-1 text-atencao">Vaga liberada</p>
              <p className="text-[17px] font-bold text-azul">{r.unidade}</p>
              <p className="mt-0.5 text-[14px] text-texto-2">
                {r.bairro} · {r.grupamento} · {r.horario} — a criança{" "}
                <span className="num font-mono">{r.desistente}</span> desistiu
              </p>
            </div>

            <ol className="mb-5">
              {r.elos.map((e, i) => (
                <li key={e.passo} className="relative border-l-2 border-azul-claro pb-5 pl-6 last:pb-0">
                  <span className="num absolute -left-[15px] top-0 flex size-7 items-center justify-center rounded-full bg-azul text-[12px] font-bold text-white">
                    {e.passo}
                  </span>
                  <p className="text-[15.5px] font-bold text-azul">{e.unidade}</p>
                  <p className="mt-0.5 text-[14px] text-texto-2">
                    <span className="num font-mono text-[13px]">{e.candidato}</span> {e.descricao}
                  </p>
                  <p className="num mt-1 text-[12.5px] text-texto-3">
                    {e.grupamento} · {e.horario} · {n(e.disputavam)} disputavam este assento
                  </p>
                  {i === r.elos.length - 1 && r.assentoOcioso && (
                    <p className="mt-2 rounded bg-atencao-fundo px-2.5 py-1.5 text-[13.5px] text-atencao">
                      A cadeia para aqui: {r.assentoOcioso.unidade} ({r.assentoOcioso.grupamento} ·{" "}
                      {r.assentoOcioso.horario}) ficou com a vaga, e nenhuma criança à espera a prefere ao
                      que já tem.
                    </p>
                  )}
                </li>
              ))}
              {r.elos.length === 0 && (
                <li className="text-[14.5px] text-texto-2">
                  Nenhuma criança à espera prefere esta vaga ao que já tem. O assento fica ocioso — e é
                  exatamente esse caso que o painel de ociosidade precisa mostrar.
                </li>
              )}
            </ol>

            <dl className="grid gap-3 sm:grid-cols-3">
              <Metrica rotulo="Crianças remanejadas" valor={String(r.elos.length)} />
              <Metrica
                rotulo="Candidatos avaliados"
                valor={n(r.candidatosAvaliados)}
                apoio={`em vez das ${n(r.filaCompleta)} da fila inteira`}
              />
              <Metrica
                rotulo="Tempo"
                valor={`${dec(r.duracaoMs)} ms`}
                apoio="hoje: 3 dias úteis por convite, em série"
                destaque
              />
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

function Metrica({
  rotulo,
  valor,
  apoio,
  destaque,
}: {
  rotulo: string;
  valor: string;
  apoio?: string;
  destaque?: boolean;
}) {
  return (
    <div className={`rounded border p-3.5 ${destaque ? "border-ok bg-ok-fundo" : "border-linha bg-cinza"}`}>
      <dt className="rotulo mb-1">{rotulo}</dt>
      <dd>
        <span className={`num block text-[21px] font-black ${destaque ? "text-ok" : "text-azul"}`}>
          {valor}
        </span>
        {apoio && <span className="mt-0.5 block text-[12.5px] leading-snug text-texto-2">{apoio}</span>}
      </dd>
    </div>
  );
}
