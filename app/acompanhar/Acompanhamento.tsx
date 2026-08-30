"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface PosicaoNaFila {
  assento: string;
  unidade: { codigo: number; nome: string; bairro: string | null } | undefined;
  grupamento: string;
  horario: string;
  ordemPreferencia: number;
  capacidade: number;
  aFrente: number;
  concorrentes: number;
}

interface Resumo {
  protocolo: string;
  pontos: number;
  pontuacaoMaxima: number;
  empatadaEmZero: boolean;
  convite: PosicaoNaFila | null;
  filaDeMelhoria: PosicaoNaFila[];
  rodadaId: string;
  duracaoMs: number;
  totalCandidatos: number;
  remanejadas: number;
  propostasAvaliadas: number;
  explicacao: string;
}

interface Guardada {
  nascimento: string;
  bairro: string;
  horario: string;
  opcoes: number[];
  criterios: number[];
  protocolo: string;
}

const CHAVE_LOCAL = "vaga-certa:inscricao";
const n = (v: number) => v.toLocaleString("pt-BR");

export default function Acompanhamento() {
  const [estado, setEstado] = useState<"carregando" | "sem-inscricao" | "pronto" | "erro">("carregando");
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");

  const consultar = useCallback(async (guardada: Guardada) => {
    try {
      const r = await fetch("/api/inscricao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(guardada),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro((d.erros ?? [d.erro])[0] ?? "Não foi possível consultar a inscrição.");
        setEstado("erro");
        return;
      }
      setResumo(d.resumo);
      setEstado("pronto");
    } catch {
      setErro("Falha de rede ao consultar a inscrição.");
      setEstado("erro");
    }
  }, []);

  useEffect(() => {
    let bruto: string | null = null;
    try {
      bruto = localStorage.getItem(CHAVE_LOCAL);
    } catch {
      bruto = null;
    }
    if (!bruto) {
      setEstado("sem-inscricao");
      return;
    }
    try {
      consultar(JSON.parse(bruto) as Guardada);
    } catch {
      setEstado("sem-inscricao");
    }
  }, [consultar]);

  const limpar = () => {
    try {
      localStorage.removeItem(CHAVE_LOCAL);
    } catch {
      // sem localStorage: nada a limpar
    }
    setResumo(null);
    setEstado("sem-inscricao");
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="eyebrow mb-3">Acompanhar inscrição</p>

      {estado === "carregando" && (
        <>
          <h1 className="titulo mb-3 text-[clamp(28px,6vw,44px)]">Consultando a fila…</h1>
          <p className="text-[16px] text-ink-2">Recalculando a rodada com a fila real de 2025.</p>
        </>
      )}

      {estado === "sem-inscricao" && (
        <>
          <h1 className="titulo mb-4 text-[clamp(28px,6vw,44px)]">Nenhuma inscrição neste navegador.</h1>
          <p className="mb-4 max-w-[60ch] text-[16.5px] text-ink-2">
            Este protótipo não mantém banco de dados: a inscrição fica guardada no seu próprio navegador e é
            reenviada ao motor para recalcular a posição. Como a rodada é determinística, a mesma inscrição
            devolve sempre o mesmo resultado.
          </p>
          <p className="mb-8 max-w-[60ch] text-[15px] text-ink-3">
            Em produção, a consulta seria pelo protocolo e pelo CPF do responsável, contra o registro da
            inscrição — sem depender do navegador.
          </p>
          <Link
            href="/inscricao"
            className="inline-block bg-ink px-7 py-4 font-display text-[16px] font-semibold text-surface"
          >
            Fazer a inscrição
          </Link>
        </>
      )}

      {estado === "erro" && (
        <>
          <h1 className="titulo mb-4 text-[clamp(28px,6vw,44px)]">Não deu para consultar.</h1>
          <div className="mb-6 border-l-[3px] border-break bg-break-soft px-4 py-3" role="alert">
            <p className="text-[15px]">{erro}</p>
          </div>
          <button type="button" onClick={limpar} className="border border-rule px-6 py-3 font-mono text-[12px]">
            limpar e começar de novo
          </button>
        </>
      )}

      {estado === "pronto" && resumo && (
        <>
          <h1 className="titulo mb-3 text-[clamp(28px,6vw,44px)]">
            {resumo.convite ? "Você tem uma vaga." : "Você está na fila."}
          </h1>
          <p className="mb-8 max-w-[60ch] text-[16.5px] text-ink-2">{resumo.explicacao}</p>

          <div className="mb-8 border border-rule bg-surface">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-5 py-4">
              <span className="rotulo">Protocolo</span>
              <span className="num font-display text-[22px] font-extrabold">{resumo.protocolo}</span>
            </div>
            <dl className="divide-y divide-rule">
              <Linha rotulo="Pontuação">
                {resumo.pontos} de {resumo.pontuacaoMaxima}
                {resumo.empatadaEmZero && (
                  <span className="ml-2 text-[13.5px] text-ink-3">— empatada com 93,8% da fila</span>
                )}
              </Linha>
              <Linha rotulo="Rodada">
                <span className="num text-[13.5px]">{resumo.rodadaId}</span>
              </Linha>
              <Linha rotulo="Recalculada agora">
                {n(resumo.totalCandidatos)} crianças na fila ·{" "}
                {resumo.duracaoMs.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ms
              </Linha>
            </dl>
          </div>

          {resumo.convite && (
            <div className="mb-8 border-l-[3px] border-match bg-match-soft px-5 py-4">
              <p className="rotulo mb-1">Convite · {resumo.convite.ordemPreferencia}ª opção</p>
              <p className="font-display text-[21px] font-bold">
                {resumo.convite.unidade?.nome ?? resumo.convite.assento}
              </p>
              <p className="mt-1 text-[14.5px] text-ink-2">
                {resumo.convite.unidade?.bairro} · {resumo.convite.grupamento} · {resumo.convite.horario}
              </p>
            </div>
          )}

          {resumo.filaDeMelhoria.length > 0 && (
            <section className="mb-8">
              <h2 className="subtitulo mb-2 text-[20px]">Fila de melhoria</h2>
              <p className="mb-3 max-w-[60ch] text-[14.5px] text-ink-2">
                {resumo.convite
                  ? "Suas opções melhores continuam valendo. Se abrir vaga, o remanejamento é automático e a vaga atual passa para a próxima criança."
                  : "Estas são as vagas que você disputa, recalculadas a cada vaga liberada na rede."}
              </p>
              <ul className="divide-y divide-rule border border-rule bg-surface">
                {resumo.filaDeMelhoria.map((p) => (
                  <li key={p.assento} className="flex items-baseline gap-3 px-4 py-3">
                    <span className="num flex size-7 shrink-0 items-center justify-center bg-signal-soft text-[13px] font-semibold">
                      {p.ordemPreferencia}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[15px] font-semibold">
                        {p.unidade?.nome ?? p.assento}
                      </span>
                      <span className="rotulo">
                        {p.capacidade} vagas · {n(p.concorrentes)} disputando · {n(p.aFrente)} com prioridade
                        maior
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button type="button" onClick={limpar} className="border border-rule px-6 py-3 font-mono text-[12px]">
            esquecer esta inscrição
          </button>
        </>
      )}
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-3">
      <dt className="rotulo min-w-[150px] pt-1">{rotulo}</dt>
      <dd className="flex-1 text-[15px]">{children}</dd>
    </div>
  );
}
