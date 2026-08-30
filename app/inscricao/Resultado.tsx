"use client";

/**
 * Inscrição registrada — provar que acabou, e dizer o que vem depois.
 *
 * O que saiu desta tela, e por quê:
 *
 * — **"Empatada com 93,8% da fila"** dizia ao usuário que ele é uma estatística,
 *   e "semente publicada" é jargão criptográfico. No lugar entra o que a família
 *   precisa saber: a pontuação já está confirmada, e ela não precisa ir a lugar
 *   nenhum para provar o que já foi confirmado.
 *
 * — **A métrica da rodada** (propostas avaliadas, milissegundos, crianças
 *   remanejadas) é evidência de auditoria e continua existindo — no `/painel`,
 *   que é a tela da rede. Para a família ficou o protocolo, a posição e a data.
 *
 * — **"Nova simulação"** revelava, no fim do fluxo, que aquilo era demonstração.
 *   Os controles da demo ficam na tarja de protótipo, do lado de fora do
 *   serviço.
 */

import Link from "next/link";
import { useState } from "react";

import { BarraDePontuacao, DeOndeVemCadaPonto, SemCriterio, VersaoDaRegua } from "./Pontuacao";
import { n, plural, Tarja } from "./pecas";
import type { RespostaInscricao, UnidadeEscolha } from "./tipos";

function emDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function mesQueVem() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString("pt-BR", { month: "long" });
}

export default function Resultado({
  resposta,
  porCodigo,
  crianca,
  turma,
  onAcompanhar,
}: {
  resposta: RespostaInscricao;
  porCodigo: Map<number, UnidadeEscolha>;
  crianca: string;
  turma: { nome: string; idade: string } | null;
  onAcompanhar: () => void;
}) {
  const { resumo, comprovacoes, inscricao } = resposta;
  const { pontuacao } = resumo;
  const convite = resumo.convite;
  const [copiado, setCopiado] = useState(false);

  return (
    <div className="mx-auto max-w-4xl px-5 py-9">
      <p className="rotulo mb-2 text-ok">✓ Registrada</p>
      <h1 className="mb-3 text-[clamp(24px,4.2vw,34px)] font-black tracking-[-0.025em] text-azul">
        Inscrição registrada
      </h1>
      <p className="mb-7 max-w-[66ch] text-[16px] text-texto-2">
        {convite
          ? `Há vaga na sua ${convite.ordemPreferencia}ª escolha, e ela está reservada para ${crianca}.`
          : `Nenhuma das creches escolhidas tem vaga agora. ${crianca} entra na fila e a posição é atualizada sempre que abre vaga.`}
      </p>

      {/* ── protocolo ── */}
      <div className="cartao mb-6 overflow-hidden">
        <p className="cartao-titulo">Comprovante de inscrição</p>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha bg-azul-10 px-4 py-4">
          <span className="rotulo text-azul">Número do protocolo</span>
          <span className="num font-mono text-[24px] font-medium text-azul">{resumo.protocolo}</span>
        </div>
        <div className="flex flex-wrap gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(resumo.protocolo);
              setCopiado(true);
            }}
            className="botao botao-secundario !min-h-[48px] !px-4 !text-[12px]"
          >
            {copiado ? "Copiado" : "Copiar"}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Protocolo da inscrição em creche: ${resumo.protocolo}`,
            )}`}
            target="_blank"
            rel="noreferrer noopener"
            className="botao botao-secundario !min-h-[48px] !px-4 !text-[12px]"
          >
            Enviar por WhatsApp
          </a>
        </div>
        <dl className="divide-y divide-linha border-t border-linha">
          <Item rotulo="Criança">
            {crianca}
            {turma && <span className="block text-[13.5px] text-texto-3">{turma.nome}</span>}
          </Item>
          <Item rotulo="Horário">
            {inscricao.horario === "Integral" ? "Dia inteiro (7h–17h)" : "Meio período"}
            {inscricao.aceitaOutroTurno && (
              <span className="block text-[13.5px] text-texto-3">Aceita o outro horário se não houver vaga</span>
            )}
          </Item>
          <Item rotulo="Pontuação">
            <span className="num">
              {pontuacao.confirmados} confirmados
              {pontuacao.aConfirmar > 0 && (
                <span className="text-texto-2"> + {pontuacao.aConfirmar} a comprovar</span>
              )}
            </span>
          </Item>
          <Item rotulo="Suas escolhas">
            <ol className="space-y-1">
              {inscricao.opcoes.map((c, i) => (
                <li key={c} className="flex gap-2">
                  <span className="num font-bold text-azul">{i + 1}ª</span>
                  <span>{porCodigo.get(c)?.nome ?? c}</span>
                </li>
              ))}
            </ol>
          </Item>
          <Item rotulo="Régua usada">
            <span className="num text-[14px]">
              versão {resumo.reguaVersao} · vigente por {resumo.reguaVigenciaProcessos} processos
            </span>
          </Item>
        </dl>
      </div>

      {/* ── convite ── */}
      {convite && (
        <div className="cartao mb-6 overflow-hidden border-ok">
          <p className="cartao-titulo bg-ok">Vaga reservada · {convite.ordemPreferencia}ª escolha</p>
          <div className="p-4">
            <p className="text-[19px] font-bold text-azul">{convite.unidade?.nome ?? convite.assento}</p>
            <p className="mt-1 text-[14.5px] text-texto-2">
              {convite.unidade?.bairro} · {turma?.nome ?? convite.grupamento} ·{" "}
              {convite.horario === "Integral" ? "dia inteiro" : "meio período"}
            </p>
            <p className="mt-3 border-t border-linha pt-3 text-[14.5px] text-texto-2">
              Você recebe <strong className="text-texto">um</strong> convite — da melhor opção que conseguimos. As
              outras continuam valendo se abrir vaga.
            </p>
          </div>
        </div>
      )}

      {/* ── posição na fila ── */}
      {resumo.filaDeMelhoria.length > 0 && (
        <section className="mb-6">
          <h2 className="secao-titulo mb-2">Sua posição na fila</h2>
          <p className="mb-3 max-w-[66ch] text-[14.5px] text-texto-2">
            Sua posição é atualizada sempre que abre vaga. Ela vai como faixa, e não como número cravado: se move
            enquanto outras famílias ainda estão escolhendo.
            {convite &&
              ` Se abrir vaga na sua ${resumo.opcaoMantida}ª escolha, a gente move ${crianca} automaticamente.`}
          </p>
          <ul className="cartao divide-y divide-linha overflow-hidden">
            {resumo.filaDeMelhoria.map((p) => (
              <li key={p.assento} className="flex items-baseline gap-3 px-4 py-3">
                <span className="num flex size-9 shrink-0 items-center justify-center rounded bg-cinza text-[14px] font-bold text-azul">
                  {p.ordemPreferencia}ª
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">
                    {p.unidade?.nome ?? porCodigo.get(Number(p.assento.split("|")[0]))?.nome ?? p.assento}
                  </span>
                  <span className="num block text-[12.5px] text-texto-3">
                    entre {n(p.faixa.de)} e {n(p.faixa.ate)} na fila · {plural(p.capacidade, "vaga", "vagas")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── pontuação ── */}
      <section className="mb-6">
        <h2 className="secao-titulo mb-3">Sua pontuação</h2>
        <BarraDePontuacao pontuacao={pontuacao} />
        <div className="mt-5">
          {pontuacao.blocos.length === 0 ? <SemCriterio /> : <DeOndeVemCadaPonto pontuacao={pontuacao} />}
        </div>
        <VersaoDaRegua versao={resumo.reguaVersao} vigencia={resumo.reguaVigenciaProcessos} />
      </section>

      {/* ── o que acontece agora ── */}
      <section className="mb-7">
        <h2 className="secao-titulo mb-3">O que acontece agora</h2>
        <ol className="cartao divide-y divide-linha overflow-hidden">
          <Passo numero="1" estado="feito" quando="Hoje">
            Inscrição registrada.
          </Passo>
          {comprovacoes.length > 0 && (
            <Passo numero="2" estado="falta" quando={`Até ${emDias(30)}`}>
              Você envia {comprovacoes.length === 1 ? "o documento" : "os documentos"} de{" "}
              {comprovacoes.map((c) => c.rotulo.toLowerCase()).join(", ")}.
              <button
                type="button"
                onClick={onAcompanhar}
                className="mt-1.5 block min-h-[44px] text-[13.5px] font-bold text-azul underline underline-offset-2"
              >
                Enviar agora
              </button>
            </Passo>
          )}
          <Passo
            numero={comprovacoes.length > 0 ? "3" : "2"}
            estado="futuro"
            quando={`A partir de ${mesQueVem()}`}
          >
            Se abrir vaga na sua ordem de escolha, avisamos no {inscricao.contato.canal}. Você tem 3 dias para
            responder.
          </Passo>
        </ol>
      </section>

      <div className="mb-7">
        <Tarja tom="ok">
          {pontuacao.confirmados > 0 ? (
            <>
              Sua pontuação já está confirmada nos sistemas do governo.{" "}
              <strong className="text-texto">
                Você não precisa ir a nenhum lugar para provar o que já confirmamos.
              </strong>
            </>
          ) : (
            <>
              Sua inscrição está válida e vai concorrer às vagas. O desempate será pela proximidade da creche e
              por sorteio auditável.
            </>
          )}
        </Tarja>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/acompanhar" className="botao botao-primario">
          Acompanhar inscrição
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="botao botao-secundario"
        >
          Baixar comprovante
        </button>
        <Link href="/inscricao" className="botao botao-secundario">
          Inscrever outra criança
        </Link>
      </div>
    </div>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3">
      <dt className="rotulo min-w-[150px] pt-1">{rotulo}</dt>
      <dd className="flex-1 text-[15px]">{children}</dd>
    </div>
  );
}

function Passo({
  numero,
  estado,
  quando,
  children,
}: {
  numero: string;
  estado: "feito" | "falta" | "futuro";
  quando: string;
  children: React.ReactNode;
}) {
  const sinal = { feito: "✓", falta: "⏳", futuro: "○" }[estado];
  const cor = { feito: "text-ok", falta: "text-atencao", futuro: "text-texto-3" }[estado];
  return (
    <li className="flex gap-3 px-4 py-3.5">
      <span className="num flex size-8 shrink-0 items-center justify-center rounded bg-cinza text-[14px] font-bold text-azul">
        {numero}
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 flex items-baseline gap-2">
          <span aria-hidden className={cor}>
            {sinal}
          </span>
          <span className="rotulo">{quando}</span>
        </span>
        <span className="block text-[14.5px] text-texto-2">{children}</span>
      </span>
    </li>
  );
}
