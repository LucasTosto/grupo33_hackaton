"use client";

/**
 * Acompanhar a inscrição — responder "e a minha vaga?" sem ligar para ninguém.
 *
 * A linha do tempo é o que hoje não existe em 837 mil linhas de base: eventos
 * com carimbo de hora, do lado da família. É a mesma tabela de eventos do painel
 * da rede, filtrada por esta inscrição.
 *
 * A faixa de revalidação de contato é um toque, e é o que impede a inscrição de
 * virar "cancelado pelo sistema" — o desfecho de 44,1% das opções de 2025. O
 * ciclo pode levar treze meses; um número que mudou no meio do caminho é o
 * bastante para a vaga não chegar.
 *
 * Não há banco: a rodada é reproduzível, então esta tela reenvia a inscrição
 * guardada no aparelho e recebe a classificação recalculada sobre a fila do
 * momento.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BarraDePontuacao, DeOndeVemCadaPonto, SemCriterio, VersaoDaRegua } from "../inscricao/Pontuacao";
import type { Comprovacao, Resumo } from "../inscricao/tipos";

interface Guardada {
  protocolo: string;
  nascimento: string;
  cpfCrianca: string;
  dnvCrianca: string;
  cep: string;
  numero: string;
  bairro: string | null;
  horario: string;
  aceitaOutroTurno: boolean;
  opcoes: number[];
  itens: { grau: string; origem: "aferido" | "atestado" | "declarado" }[];
  desempates: number[];
  opcaoMantida: number;
  contato: { celular: string; whatsapp: boolean; canal: string; verificado: boolean };
  consentimento: { comum: boolean; sensivel: boolean };
  crianca: string | null;
  enviadaEm: string;
}

const CHAVE_ENVIADA = "vaga-certa:inscricao:enviada";
const n = (v: number) => v.toLocaleString("pt-BR");

function horaDe(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function celularMascarado(d: string) {
  if (d.length < 10) return d;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)}xxxx-${d.slice(-4)}`;
}

export default function Acompanhamento() {
  const [estado, setEstado] = useState<"carregando" | "sem-inscricao" | "pronto" | "erro">("carregando");
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [comprovacoes, setComprovacoes] = useState<Comprovacao[]>([]);
  const [guardada, setGuardada] = useState<Guardada | null>(null);
  const [erro, setErro] = useState("");
  const [contatoConfirmado, setContatoConfirmado] = useState(false);

  const consultar = useCallback(async (g: Guardada) => {
    try {
      const r = await fetch("/api/inscricao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(g),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro((d.erros ?? [d.erro])[0] ?? "Não foi possível consultar a inscrição.");
        setEstado("erro");
        return;
      }
      setResumo(d.resumo);
      setComprovacoes(d.comprovacoes ?? []);
      setEstado("pronto");
    } catch {
      setErro("Falha de rede ao consultar a inscrição.");
      setEstado("erro");
    }
  }, []);

  useEffect(() => {
    let bruto: string | null = null;
    try {
      bruto = localStorage.getItem(CHAVE_ENVIADA);
    } catch {
      bruto = null;
    }
    if (!bruto) {
      setEstado("sem-inscricao");
      return;
    }
    try {
      const g = JSON.parse(bruto) as Guardada;
      setGuardada(g);
      consultar(g);
    } catch {
      setEstado("sem-inscricao");
    }
  }, [consultar]);

  // Passados 90 dias sem confirmação, o contato precisa ser revalidado.
  const diasDesdeEnvio = guardada
    ? Math.floor((Date.now() - new Date(guardada.enviadaEm).getTime()) / 86_400_000)
    : 0;
  const precisaRevalidar = Boolean(guardada) && diasDesdeEnvio >= 90 && !contatoConfirmado;

  return (
    <div className="mx-auto max-w-4xl px-5 py-9">
      <p className="rotulo mb-2 text-azul-medio">Acompanhar</p>

      {estado === "carregando" && (
        <>
          <h1 className="mb-6 text-[clamp(24px,4.2vw,32px)] font-black tracking-[-0.025em] text-azul">
            Consultando a sua inscrição…
          </h1>
          <div className="cartao overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border-b border-linha px-4 py-4 last:border-0">
                <span className="block h-3.5 w-2/5 animate-pulse rounded bg-cinza" />
                <span className="mt-2 block h-3 w-3/5 animate-pulse rounded bg-cinza" />
              </div>
            ))}
          </div>
        </>
      )}

      {estado === "sem-inscricao" && (
        <>
          <h1 className="mb-3 text-[clamp(24px,4.2vw,32px)] font-black tracking-[-0.025em] text-azul">
            Não encontramos inscrição neste aparelho
          </h1>
          <p className="mb-6 max-w-[62ch] text-[16px] text-texto-2">
            Este protótipo guarda a inscrição no próprio navegador. No serviço real você entraria com o gov.br, ou
            informaria o protocolo, e a inscrição apareceria de qualquer aparelho.
          </p>
          <Link href="/inscricao" className="botao botao-primario">
            Fazer uma inscrição
          </Link>
        </>
      )}

      {estado === "erro" && (
        <>
          <h1 className="mb-3 text-[clamp(24px,4.2vw,32px)] font-black tracking-[-0.025em] text-azul">
            Não conseguimos consultar agora
          </h1>
          <div className="tarja mb-6 border-l-erro bg-erro-fundo" role="alert">
            <p className="text-[15px] text-texto-2">{erro}</p>
          </div>
          <button
            type="button"
            onClick={() => guardada && (setEstado("carregando"), consultar(guardada))}
            className="botao botao-primario"
          >
            Tentar de novo
          </button>
        </>
      )}

      {estado === "pronto" && resumo && guardada && (
        <>
          <h1 className="mb-3 text-[clamp(24px,4.2vw,32px)] font-black tracking-[-0.025em] text-azul">
            {resumo.convite ? "Há uma vaga reservada" : "Na fila de espera"}
          </h1>
          <p className="mb-6 max-w-[66ch] text-[16px] text-texto-2">
            {resumo.convite
              ? `Há vaga na ${resumo.convite.ordemPreferencia}ª escolha, e ela está reservada para ${guardada.crianca ?? "a criança"}.`
              : "Sua posição é atualizada sempre que abre vaga na rede."}
          </p>

          {precisaRevalidar && (
            <div className="tarja mb-6 border-l-atencao bg-atencao-fundo">
              <p className="rotulo mb-1 text-atencao">Confirme o seu celular</p>
              <p className="mb-3 max-w-[62ch] text-[14.5px] text-texto-2">
                Seu celular ainda é {celularMascarado(guardada.contato.celular)}? Sem um número que atenda, a vaga
                não chega.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setContatoConfirmado(true)}
                  className="botao botao-primario !min-h-[48px] !px-4 !text-[12px]"
                >
                  Sim, é este
                </button>
                <Link href="/inscricao" className="botao botao-secundario !min-h-[48px] !px-4 !text-[12px]">
                  Trocar
                </Link>
              </div>
            </div>
          )}

          {/* ── linha do tempo ── */}
          <section className="mb-7">
            <h2 className="secao-titulo mb-3">Linha do tempo</h2>
            <ol className="cartao divide-y divide-linha overflow-hidden">
              <Evento estado="feito" quando={horaDe(guardada.enviadaEm)}>
                Inscrição registrada · protocolo <span className="num font-mono">{resumo.protocolo}</span>
              </Evento>
              <Evento estado="feito" quando={horaDe(guardada.enviadaEm)}>
                Pontuação confirmada: <span className="num">{resumo.pontuacao.confirmados} pontos</span>
              </Evento>
              {comprovacoes.map((c) => (
                <Evento key={c.grau} estado="falta" quando="——">
                  {c.rotulo}: falta enviar
                  <Link
                    href="/inscricao"
                    className="ml-2 font-bold text-azul underline underline-offset-2"
                  >
                    Enviar
                  </Link>
                </Evento>
              ))}
              {resumo.filaDeMelhoria.map((p) => (
                <Evento key={p.assento} estado="futuro" quando="——">
                  Aguardando vaga · entre <span className="num">{n(p.faixa.de)}</span> e{" "}
                  <span className="num">{n(p.faixa.ate)}</span> na fila da {p.ordemPreferencia}ª escolha
                </Evento>
              ))}
              {resumo.convite && (
                <Evento estado="feito" quando={horaDe(new Date().toISOString())}>
                  Vaga disponível em {resumo.convite.unidade?.nome ?? resumo.convite.assento}
                </Evento>
              )}
            </ol>
          </section>

          {/* ── convite ativo ── */}
          {resumo.convite && (
            <div className="cartao mb-7 overflow-hidden border-ok bg-ok-fundo/40">
              <p className="cartao-titulo bg-ok">Convite ativo · responda em 3 dias</p>
              <div className="p-4">
                <p className="text-[19px] font-bold text-azul">
                  {resumo.convite.unidade?.nome ?? resumo.convite.assento}
                </p>
                <p className="mt-1 text-[14.5px] text-texto-2">
                  {resumo.convite.unidade?.bairro} ·{" "}
                  {resumo.convite.horario === "Integral" ? "dia inteiro" : "meio período"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="botao botao-primario !min-h-[48px] !px-4 !text-[12px]">
                    Aceitar a vaga
                  </button>
                  <button type="button" className="botao botao-secundario !min-h-[48px] !px-4 !text-[12px]">
                    Recusar
                  </button>
                </div>
                {/* A consequência de cada escolha, dita antes do toque. */}
                <ul className="mt-3 space-y-1 border-t border-linha pt-3 text-[13.5px] text-texto-2">
                  <li>
                    <strong className="text-texto">Aceitar:</strong> a matrícula é garantida, e você continua na
                    lista de espera da {resumo.opcaoMantida}ª escolha.
                  </li>
                  <li>
                    <strong className="text-texto">Recusar:</strong> a vaga passa para a próxima criança da fila e
                    a inscrição volta a aguardar.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ── pontuação ── */}
          <section className="mb-7">
            <h2 className="secao-titulo mb-3">Sua pontuação</h2>
            <BarraDePontuacao pontuacao={resumo.pontuacao} />
            <div className="mt-5">
              {resumo.pontuacao.blocos.length === 0 ? (
                <SemCriterio />
              ) : (
                <DeOndeVemCadaPonto pontuacao={resumo.pontuacao} />
              )}
            </div>
            <VersaoDaRegua versao={resumo.reguaVersao} vigencia={resumo.reguaVigenciaProcessos} />
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => (setEstado("carregando"), consultar(guardada))}
              className="botao botao-secundario"
            >
              Atualizar
            </button>
            <Link href="/como-funciona" className="botao botao-secundario">
              Como a pontuação é calculada
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Evento({
  estado,
  quando,
  children,
}: {
  estado: "feito" | "falta" | "futuro";
  quando: string;
  children: React.ReactNode;
}) {
  const sinal = { feito: "●", falta: "○", futuro: "○" }[estado];
  const cor = { feito: "text-ok", falta: "text-atencao", futuro: "text-texto-3" }[estado];
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
      <span aria-hidden className={`${cor} text-[13px]`}>
        {sinal}
      </span>
      <span className="num min-w-[105px] text-[12.5px] text-texto-3">{quando}</span>
      <span className="flex-1 text-[14.5px] text-texto-2">{children}</span>
    </li>
  );
}
