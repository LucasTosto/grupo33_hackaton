"use client";

/**
 * Peças de interface do formulário.
 *
 * Nenhuma cor e nenhum componente novo: só um uso disciplinado dos que já
 * existem. A regra de significado dos tokens funcionais, que vale sem exceção
 * em todas as telas:
 *
 * `ok` — confirmado por base oficial ou por serviço público. Nada mais usa verde.
 * `atencao` — depende de uma ação da família (comprovar, verificar, escolher).
 * `erro` — impedimento: não classifica, ou dado inválido.
 * `azul-10` — cabeçalho de bloco e destaque neutro.
 * `.num` — apenas números: pontuação, distância, protocolo, posição na fila.
 */

import { useId, useState } from "react";

import type { CartaoBase } from "./tipos";

export const dec = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
export const n = (v: number) => v.toLocaleString("pt-BR");

export function plural(q: number, um: string, muitos: string) {
  return `${n(q)} ${q === 1 ? um : muitos}`;
}

// ──────────────────────────────────────────────────── cabeçalho de tela

/**
 * Estrutura fixa de toda tela: uma pergunta em linguagem de gente, uma linha de
 * instrução, o campo, e — quando fizer sentido — o "por que pedimos isso".
 *
 * O texto de apoio responde a **uma** de três perguntas: por que precisamos
 * disto de você, o que acontece se você marcar, o que acontece se você não
 * marcar. Nada mais. Todo número comparativo saiu do formulário e está em
 * `/como-funciona`: o argumento do diagnóstico estava ocupando o lugar da
 * instrução.
 */
export function Tela({
  titulo,
  instrucao,
  porQue,
  children,
}: {
  titulo: string;
  instrucao?: string;
  porQue?: { rotulo?: string; texto: React.ReactNode };
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-2 text-[clamp(22px,3.6vw,29px)] font-black tracking-[-0.025em] text-azul">{titulo}</h2>
      {instrucao && <p className="mb-6 max-w-[62ch] text-[15px] text-texto-2">{instrucao}</p>}
      {children}
      {porQue && (
        <details className="mt-7 border-t border-linha pt-4">
          <summary className="cursor-pointer text-[14px] font-bold text-azul-medio underline-offset-2 hover:underline">
            {porQue.rotulo ?? "Por que pedimos isso?"}
          </summary>
          <div className="mt-2.5 max-w-[62ch] text-[14px] text-texto-2">{porQue.texto}</div>
        </details>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── campos

export function Campo({
  rotulo,
  apoio,
  erro,
  children,
}: {
  rotulo: string;
  apoio?: string;
  erro?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="rotulo mb-1.5 block">{rotulo}</span>
      {children}
      {apoio && !erro && <span className="mt-1.5 block text-[13.5px] text-texto-3">{apoio}</span>}
      {erro && (
        <span role="alert" className="mt-1.5 block text-[13.5px] font-bold text-erro">
          {erro}
        </span>
      )}
    </label>
  );
}

/**
 * Escolha em cartão, não em `radio` de 20 px.
 *
 * O alvo inteiro é clicável e tem 56 px de altura mínima — acima dos 44 px
 * pedidos. As setas e caixas pequenas do formulário anterior ficavam abaixo
 * disso justamente nas ações de precisão.
 */
export function Escolha({
  titulo,
  apoio,
  marcada,
  onEscolher,
  largura = "auto",
}: {
  titulo: string;
  apoio?: string;
  marcada: boolean;
  onEscolher: () => void;
  largura?: "auto" | "cheia";
}) {
  return (
    <button
      type="button"
      onClick={onEscolher}
      aria-pressed={marcada}
      className={`min-h-[56px] rounded border-2 px-4 py-3 text-left transition ${largura === "cheia" ? "w-full" : ""} ${
        marcada ? "border-azul bg-azul text-white" : "border-linha-forte bg-white hover:border-azul"
      }`}
    >
      <span className="block text-[16px] font-bold">{titulo}</span>
      {apoio && (
        <span className={`mt-0.5 block text-[13.5px] ${marcada ? "text-azul-claro" : "text-texto-3"}`}>{apoio}</span>
      )}
    </button>
  );
}

export function Tarja({
  tom = "azul",
  titulo,
  children,
}: {
  tom?: "azul" | "ok" | "atencao" | "erro";
  titulo?: string;
  children: React.ReactNode;
}) {
  const borda = {
    azul: "border-l-azul",
    ok: "border-l-ok bg-ok-fundo",
    atencao: "border-l-atencao bg-atencao-fundo",
    erro: "border-l-erro bg-erro-fundo",
  }[tom];
  const cor = { azul: "text-azul", ok: "text-ok", atencao: "text-atencao", erro: "text-erro" }[tom];
  return (
    <div className={`tarja ${borda}`}>
      {titulo && <p className={`rotulo mb-1 ${cor}`}>{titulo}</p>}
      <div className="max-w-[66ch] text-[14.5px] text-texto-2">{children}</div>
    </div>
  );
}

/** Esqueleto de carregamento. Nunca um *spinner* solto. */
export function Esqueleto({ linhas = 3 }: { linhas?: number }) {
  return (
    <ul className="cartao divide-y divide-linha overflow-hidden" aria-hidden>
      {Array.from({ length: linhas }, (_, i) => (
        <li key={i} className="px-4 py-4">
          <span className="block h-3.5 w-2/5 animate-pulse rounded bg-cinza" />
          <span className="mt-2 block h-3 w-3/5 animate-pulse rounded bg-cinza" />
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────── cartão de consulta à base

const SELO_ESTADO = {
  confirmado: { sinal: "✓", cor: "text-ok", borda: "border-ok" },
  atencao: { sinal: "⚠", cor: "text-atencao", borda: "border-atencao" },
  ausente: { sinal: "—", cor: "text-texto-3", borda: "border-linha" },
  indisponivel: { sinal: "…", cor: "text-texto-3", borda: "border-linha" },
} as const;

/**
 * Cartão do que a consulta encontrou.
 *
 * A pontuação aparece aqui — e deve aparecer. A diferença é decisiva: o número
 * está do lado do que já foi confirmado, não do lado de uma pergunta. Não há
 * como induzir resposta em campo de leitura, o que é o oposto de mostrar "51
 * pontos" ao lado de uma caixa de seleção.
 *
 * O valor da renda e o nome da faixa nunca aparecem no corpo do cartão: ficam
 * atrás de `Ver detalhe`, um toque deliberado. Carimbar "extrema pobreza" na
 * tela de alguém não acrescenta nada à decisão que ela está tomando ali, e no
 * polo a tela é vista pelo servidor e por quem está na fila atrás.
 */
export function CartaoDeBase({ cartao, onAcao }: { cartao: CartaoBase; onAcao?: (tipo: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [contestando, setContestando] = useState(false);
  const [contestado, setContestado] = useState(false);
  const selo = SELO_ESTADO[cartao.estado];
  const painel = useId();

  return (
    <li className="px-4 py-4">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[15.5px] font-bold">
          <span aria-hidden className={`mr-2 ${selo.cor}`}>
            {selo.sinal}
          </span>
          {cartao.titulo}
        </p>
        {cartao.rotuloPontos ? (
          <span className="rotulo text-azul">{cartao.rotuloPontos}</span>
        ) : cartao.pontos !== null ? (
          <span className="num text-[15px] font-bold text-azul">
            {cartao.pontos} <span className="text-[12.5px] font-medium text-texto-2">pts</span>
          </span>
        ) : null}
      </div>

      {cartao.linhas.map((l) => (
        <p key={l} className="max-w-[64ch] text-[14.5px] text-texto-2">
          {l}
        </p>
      ))}

      <p className="mt-1.5 text-[12.5px] text-texto-3">{cartao.fonte}</p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {cartao.detalhe && (
          <button
            type="button"
            onClick={() => setAberto((a) => !a)}
            aria-expanded={aberto}
            aria-controls={painel}
            className="min-h-[44px] rounded border border-linha-forte bg-white px-3 text-[13px] font-bold text-azul hover:border-azul"
          >
            {aberto ? "Esconder detalhe" : "Ver detalhe"}
          </button>
        )}
        {cartao.acao && (
          <button
            type="button"
            onClick={() => onAcao?.(cartao.acao!.tipo)}
            className="min-h-[44px] rounded border-2 border-azul bg-white px-3 text-[13px] font-bold text-azul hover:bg-azul-10"
          >
            {cartao.acao.rotulo}
          </button>
        )}
        {cartao.contestavel && !contestado && (
          <button
            type="button"
            onClick={() => setContestando((c) => !c)}
            className="min-h-[44px] rounded px-3 text-[13px] font-bold text-azul-medio underline underline-offset-2"
          >
            Isto está errado
          </button>
        )}
      </div>

      {aberto && cartao.detalhe && (
        <div id={painel} className="mt-3 rounded bg-cinza px-3.5 py-3">
          <p className="rotulo mb-1.5">{cartao.detalhe.titulo}</p>
          {cartao.detalhe.linhas.map((l) => (
            <p key={l} className="num text-[14px] text-texto-2">
              {l}
            </p>
          ))}
          {cartao.detalhe.encaminhamento && (
            <p className="mt-2 border-t border-linha pt-2 text-[13.5px] text-texto-2">
              {cartao.detalhe.encaminhamento}{" "}
              <button
                type="button"
                onClick={() => onAcao?.("cras")}
                className="font-bold text-azul underline underline-offset-2"
              >
                Ver CRAS perto de mim
              </button>
            </p>
          )}
        </div>
      )}

      {contestando && !contestado && <Contestacao onEnviar={() => { setContestado(true); setContestando(false); }} />}

      {contestado && (
        <p className="mt-3 rounded bg-atencao-fundo px-3.5 py-2.5 text-[13.5px] text-texto-2">
          Contestação registrada. Vai para análise humana e{" "}
          <strong className="text-texto">não muda sua pontuação agora.</strong>
        </p>
      )}
    </li>
  );
}

/**
 * Contestação, não declaração.
 *
 * Motivo em lista fechada, campo livre curto, e a consequência dita sem rodeio.
 * O caminho padrão é a base; a palavra da família é a exceção que precisa de
 * prova.
 */
function Contestacao({ onEnviar }: { onEnviar: () => void }) {
  const [motivo, setMotivo] = useState("");
  return (
    <div className="mt-3 rounded border border-linha bg-white px-3.5 py-3">
      <Campo rotulo="Qual é o problema?">
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="campo">
          <option value="">Escolha o motivo</option>
          <option>O dado não é meu</option>
          <option>O dado está desatualizado</option>
          <option>Falta uma informação que eu tenho</option>
          <option>Outro motivo</option>
        </select>
      </Campo>
      <label className="mt-3 block">
        <span className="rotulo mb-1.5 block">Quer explicar? (opcional)</span>
        <textarea rows={2} maxLength={300} className="campo" />
      </label>
      <p className="mt-2.5 text-[13px] text-texto-2">
        A contestação vai para análise humana e não muda sua pontuação agora.
      </p>
      <button
        type="button"
        disabled={!motivo}
        onClick={onEnviar}
        className="botao botao-secundario mt-3 !min-h-[44px] !px-4 !py-2 !text-[12px] disabled:cursor-not-allowed disabled:border-linha disabled:text-texto-3"
      >
        Enviar contestação
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────── semáforo de chance

/**
 * Chance em três níveis, sempre com a palavra junto da cor.
 *
 * Substitui "candidatos por vaga", que é métrica de gestor. E é calculada só
 * sobre a pontuação **confirmada**: mostrar a posição otimista de quem ainda
 * não comprovou seria o erro do processo atual com estética melhor — a família
 * escolheria a creche disputada contando com pontos que talvez não se realizem.
 */
export function Semaforo({ chance, aFrente }: { chance: "alta" | "media" | "longa"; aFrente: number }) {
  const estilo = {
    alta: { cor: "bg-ok-fundo text-ok", palavra: "chance alta" },
    media: { cor: "bg-atencao-fundo text-atencao", palavra: "chance média" },
    longa: { cor: "bg-erro-fundo text-erro", palavra: "fila longa" },
  }[chance];
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-1.5 rounded px-2 py-1 text-[13px] ${estilo.cor}`}>
      <strong className="font-bold">{estilo.palavra}</strong>
      <span className="num">
        {aFrente === 0
          ? "· ninguém na sua frente"
          : `· ${plural(aFrente, "criança na sua frente", "crianças na sua frente")}`}
      </span>
    </span>
  );
}
