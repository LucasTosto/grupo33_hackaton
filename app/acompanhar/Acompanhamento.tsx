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
  faixa: { de: number; ate: number };
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
  opcaoMantida: number;
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
const dec = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

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
    <div className="mx-auto max-w-4xl px-5 py-9">
      <p className="rotulo mb-2 text-azul-medio">Consulta de inscrição</p>

      {estado === "carregando" && (
        <>
          <h1 className="mb-3 text-[clamp(24px,4.2vw,32px)] font-black tracking-[-0.025em] text-azul">
            Consultando a fila…
          </h1>
          <p className="text-[16px] text-texto-2">
            Recalculando a classificação sobre a fila real do processo de 2025.
          </p>
        </>
      )}

      {estado === "sem-inscricao" && (
        <>
          <h1 className="mb-4 text-[clamp(24px,4.2vw,32px)] font-black tracking-[-0.025em] text-azul">
            Nenhuma inscrição neste navegador.
          </h1>
          <div className="tarja mb-6 max-w-[66ch]">
            <p className="mb-3 text-[15.5px] text-texto-2">
              Este protótipo não mantém banco de dados: a inscrição fica guardada no próprio navegador e é
              reenviada ao motor para recalcular a posição. Como a rodada é determinística, a mesma inscrição
              devolve sempre o mesmo resultado.
            </p>
            <p className="text-[14.5px] text-texto-3">
              Em produção, a consulta seria pelo protocolo e pelo CPF do responsável, contra o registro da
              inscrição — sem depender do navegador.
            </p>
          </div>
          <Link href="/inscricao" className="botao botao-primario">
            Fazer a inscrição
          </Link>
        </>
      )}

      {estado === "erro" && (
        <>
          <h1 className="mb-4 text-[clamp(24px,4.2vw,32px)] font-black tracking-[-0.025em] text-azul">
            Não foi possível consultar.
          </h1>
          <div className="tarja mb-6 border-l-erro bg-erro-fundo" role="alert">
            <p className="text-[15px]">{erro}</p>
          </div>
          <button type="button" onClick={limpar} className="botao botao-secundario">
            Limpar e começar de novo
          </button>
        </>
      )}

      {estado === "pronto" && resumo && (
        <>
          <h1 className="mb-3 text-[clamp(24px,4.2vw,32px)] font-black tracking-[-0.025em] text-azul">
            {resumo.convite ? "Vaga reservada para a sua criança." : "Inscrição na fila de espera."}
          </h1>
          <p className="mb-7 max-w-[66ch] text-[16px] text-texto-2">{resumo.explicacao}</p>

          <div className="cartao mb-6 overflow-hidden">
            <p className="cartao-titulo">Situação da inscrição</p>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-linha bg-azul-10 px-4 py-3.5">
              <span className="rotulo text-azul">Número do protocolo</span>
              <span className="num font-mono text-[20px] font-medium text-azul">{resumo.protocolo}</span>
            </div>
            <dl className="divide-y divide-linha">
              <Item rotulo="Pontuação">
                <span className="num">
                  {resumo.pontos} de {resumo.pontuacaoMaxima}
                </span>
                {resumo.empatadaEmZero && (
                  <span className="mt-1 block text-[13.5px] text-texto-3">
                    Empatada com 93,8% da fila.
                  </span>
                )}
              </Item>
              <Item rotulo="Identificador da rodada">
                <span className="num font-mono text-[13px]">{resumo.rodadaId}</span>
              </Item>
              <Item rotulo="Recalculada agora">
                <span className="num">{n(resumo.totalCandidatos)}</span> crianças na fila ·{" "}
                <span className="num">{dec(resumo.duracaoMs)} ms</span>
              </Item>
            </dl>
          </div>

          {resumo.convite && (
            <div className="cartao mb-6 overflow-hidden border-ok">
              <p className="cartao-titulo bg-ok">
                Convite emitido · {resumo.convite.ordemPreferencia}ª opção
              </p>
              <div className="p-4">
                <p className="text-[19px] font-bold text-azul">
                  {resumo.convite.unidade?.nome ?? resumo.convite.assento}
                </p>
                <p className="mt-1 text-[14.5px] text-texto-2">
                  {resumo.convite.unidade?.bairro} · {resumo.convite.grupamento} · {resumo.convite.horario}
                </p>
              </div>
            </div>
          )}

          {resumo.filaDeMelhoria.length > 0 && (
            <section className="mb-7">
              <h2 className="secao-titulo mb-2">Fila de melhoria</h2>
              <p className="mb-3 max-w-[66ch] text-[14.5px] text-texto-2">
                {resumo.convite
                  ? "As opções melhores continuam valendo. Se abrir vaga, o remanejamento é automático e a vaga atual passa para a próxima criança."
                  : "Estas são as vagas em disputa, recalculadas a cada vaga liberada na rede."}
              </p>
              <ul className="cartao divide-y divide-linha overflow-hidden">
                {resumo.filaDeMelhoria.map((p) => (
                  <li key={p.assento} className="flex items-baseline gap-3 px-4 py-3">
                    <span className="num flex size-8 shrink-0 items-center justify-center rounded bg-cinza text-[14px] font-bold text-azul">
                      {p.ordemPreferencia}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold">{p.unidade?.nome ?? p.assento}</span>
                      <span className="num block text-[12.5px] text-texto-3">
                        posição estimada entre {n(p.faixa.de)} e {n(p.faixa.ate)} · {p.capacidade} vagas ·{' '}
                        {n(p.concorrentes)} disputando
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button type="button" onClick={limpar} className="botao botao-secundario">
            Esquecer esta inscrição
          </button>
        </>
      )}
    </div>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3">
      <dt className="rotulo min-w-[160px] pt-1">{rotulo}</dt>
      <dd className="flex-1 text-[15px]">{children}</dd>
    </div>
  );
}
