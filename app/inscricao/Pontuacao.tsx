"use client";

/**
 * A tela da pontuação — a que a régua nova muda por completo.
 *
 * Três decisões, e a segunda é a mais consequente de todo o desenho:
 *
 * **(1) A decomposição é por bloco, com o teto visível.** A frase do rodapé é
 * obrigatória. Sem ela, `20 + 15 = 20` é lido como erro do sistema, e a família
 * que ligar para o 1746 vai ter razão em achar estranho. Efeito colateral
 * desejável: dizer que marcar mais itens no mesmo grupo não soma remove, na
 * própria tela, o incentivo a super-declarar.
 *
 * **(2) Ponto declarado e não confirmado fica fora do número grande.** Com
 * critérios de risco valendo 10 a 25 pontos, deixar a autodeclaração ordenar a
 * fila amplificaria um sinal que se contradiz entre processos em 80% a 92% dos
 * casos. O que ordena a fila é `confirmados`; o resto aparece somado em
 * separado, e a família entende a diferença sem ouvir a palavra "aferição".
 *
 * **(3) A perda é por bloco, e a tela diz qual.** É a frase que hoje ninguém
 * consegue dizer a uma família: quem não comprova a violência perde os pontos
 * daquele grupo, não os da renda.
 *
 * E a versão da régua fica visível: a vigência de três processos só é garantia
 * se a família puder ver qual régua a classificou.
 */

import Link from "next/link";

import type { Pontuacao as PontuacaoRegua } from "@/lib/regua";

import { n } from "./pecas";

export function BarraDePontuacao({ pontuacao }: { pontuacao: PontuacaoRegua }) {
  const { confirmados, aConfirmar, pontuacaoMaxima } = pontuacao;
  const pctConfirmado = Math.round((confirmados / pontuacaoMaxima) * 100);
  const pctPendente = Math.min(100 - pctConfirmado, Math.round((aConfirmar / pontuacaoMaxima) * 100));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <p>
          <span className="num block text-[clamp(40px,9vw,64px)] font-black leading-none text-azul">{confirmados}</span>
          <span className="mt-1 block text-[15px] font-bold text-ok">
            confirmados{" "}
            <span className="num font-medium text-texto-2">
              de {pontuacaoMaxima} · valem na fila agora
            </span>
          </span>
        </p>
        {aConfirmar > 0 && (
          <p className="text-right">
            <span className="num block text-[26px] font-black leading-none text-atencao">+{aConfirmar}</span>
            <span className="mt-0.5 block text-[13.5px] font-bold text-atencao">se você comprovar</span>
          </p>
        )}
      </div>

      {/* Verde = confirmado. Hachurado = a confirmar. Só o verde ordena a fila. */}
      <div
        className="mt-4 flex h-4 w-full overflow-hidden rounded bg-cinza"
        role="img"
        aria-label={`${confirmados} de ${pontuacaoMaxima} pontos confirmados${
          aConfirmar > 0 ? `, mais ${aConfirmar} a confirmar` : ""
        }`}
      >
        <span className="h-full bg-ok" style={{ width: `${pctConfirmado}%` }} />
        <span
          className="h-full"
          style={{
            width: `${pctPendente}%`,
            backgroundImage:
              "repeating-linear-gradient(135deg, var(--color-atencao) 0 4px, transparent 4px 8px)",
          }}
        />
      </div>
    </div>
  );
}

export function DeOndeVemCadaPonto({ pontuacao }: { pontuacao: PontuacaoRegua }) {
  if (pontuacao.blocos.length === 0) return null;

  return (
    <div className="cartao overflow-hidden">
      <p className="cartao-titulo">De onde vem cada ponto</p>
      <ul className="divide-y divide-linha">
        {pontuacao.blocos.map((b) => {
          const confirmado = b.confirmados > 0 && b.aConfirmar === 0;
          const valor = b.confirmados + b.aConfirmar;
          return (
            <li key={b.numero} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="text-[15px] font-bold">{b.nome}</p>
                <p className="flex items-baseline gap-2">
                  <span className="num text-[16px] font-black text-azul">{valor}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11.5px] font-bold tracking-[0.04em] uppercase ${
                      confirmado ? "bg-ok-fundo text-ok" : "bg-atencao-fundo text-atencao"
                    }`}
                  >
                    {confirmado ? "✓ base" : "⏳ falta"}
                  </span>
                </p>
              </div>
              <ul className="mt-1.5 space-y-1">
                {b.itens.map((i) => (
                  <li
                    key={i.grau}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 text-[14px] text-texto-2"
                  >
                    <span>↳ {i.rotulo}</span>
                    <span className="flex items-baseline gap-2">
                      {i.suprimidoPeloTeto ? (
                        <span className="text-[13px] text-texto-3">— não soma</span>
                      ) : (
                        <span className="num font-bold">{i.pontos}</span>
                      )}
                      {/* `base` = consultado · `serviço` = atestado · `falta` = aguarda você. */}
                      <span className="rotulo">
                        {i.confirmado ? (i.origem === "aferido" ? "base" : "serviço") : "falta"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-linha bg-cinza px-4 py-3 text-[13.5px] text-texto-2">
        Em cada grupo conta o item de maior peso, não a soma. Marcar mais itens no mesmo grupo não aumenta a
        pontuação.
      </p>
    </div>
  );
}

/** Perda por bloco, com o nome do bloco. Nunca "a pontuação declarada se perde". */
export function PerdaPorBloco({ pontuacao }: { pontuacao: PontuacaoRegua }) {
  const pendentes = pontuacao.blocos.filter((b) => b.aConfirmar > 0);
  if (pendentes.length === 0) return null;
  const confirmados = pontuacao.blocos.filter((b) => b.confirmados > 0);

  return (
    <div className="tarja mt-5 border-l-atencao bg-atencao-fundo">
      <p className="rotulo mb-1 text-atencao">O que acontece se você não comprovar</p>
      <p className="max-w-[66ch] text-[14.5px] text-texto-2">
        {pendentes.map((b, i) => (
          <span key={b.numero}>
            {i > 0 && " "}
            Se você não comprovar {b.nome.toLowerCase()}, perde{" "}
            <strong className="text-texto">
              só os <span className="num">{b.aConfirmar}</span> pontos desse grupo.
            </strong>
          </span>
        ))}{" "}
        {confirmados.length > 0 && (
          <>
            Os{" "}
            <span className="num">
              {confirmados.reduce((s, b) => s + b.confirmados, 0)}
            </span>{" "}
            pontos de {confirmados.map((b) => b.nome.toLowerCase()).join(", ")} já estão confirmados e não se
            perdem.
          </>
        )}
      </p>
    </div>
  );
}

export function VersaoDaRegua({
  versao,
  vigencia,
  ano = 2026,
}: {
  versao: string;
  vigencia: number;
  ano?: number;
}) {
  return (
    <p className="mt-4 text-[12.5px] text-texto-3">
      Régua do processo {ano} · versão {versao} · vigente por {vigencia} processos ·{" "}
      <Link href="/como-funciona" className="font-bold text-azul-medio underline underline-offset-2">
        como a pontuação é calculada
      </Link>
    </p>
  );
}

/**
 * Sem nenhum critério. Não pode ser tela de fracasso.
 *
 * 26% das famílias não declaram critério nenhum, e nenhuma composição de régua
 * dissolve esse bloco — quebrá-lo é função da proximidade e do sorteio. O que a
 * tela não pode fazer é dizer à pessoa que ela é uma estatística.
 */
export function SemCriterio() {
  return (
    <div className="tarja border-l-azul">
      <p className="max-w-[66ch] text-[15px] text-texto-2">
        <strong className="text-texto">Sua inscrição está válida e vai concorrer às vagas.</strong> Você não se
        encaixa nos critérios de prioridade, então o desempate será pela proximidade da creche e por sorteio
        auditável.
      </p>
    </div>
  );
}

export function ResumoDePontuacao({ pontuacao }: { pontuacao: PontuacaoRegua }) {
  return (
    <span className="num">
      {pontuacao.confirmados} confirmados
      {pontuacao.aConfirmar > 0 && (
        <span className="text-texto-2"> + {pontuacao.aConfirmar} a comprovar</span>
      )}
      <span className="text-texto-2"> de {n(pontuacao.pontuacaoMaxima)}</span>
    </span>
  );
}
