"use client";

/**
 * Inscrição em creche — o formulário.
 *
 * O que mudou em relação ao fluxo anterior, e por quê:
 *
 * **1. A ordem se inverteu: saber antes de escolher.** Antes a família ordenava
 * até cinco creches sem saber a própria pontuação, e só depois descobria que
 * tinha zero ponto confirmado e que a 1ª opção tinha oito candidatos por vaga. A
 * informação que orienta a escolha chegava depois da escolha. Agora a pontuação
 * vem primeiro, e cada creche da lista é anotada com a fila real de quem tem
 * aquela pontuação.
 *
 * **2. Declaração virou conferência.** Oito dos treze critérios de 2025 — e 87
 * dos 100 pontos — são respondidos por base do governo. A tela de conferência
 * substitui essas oito perguntas; sobram cinco, mais duas condicionais que só
 * aparecem quando a base não respondeu.
 *
 * **3. O formulário instrui, não argumenta.** Todo número de diagnóstico saiu
 * dos textos de apoio e está em `/como-funciona`. Dentro do formulário, texto de
 * apoio responde a uma de três perguntas: por que precisamos disto de você, o
 * que acontece se você marcar, o que acontece se você não marcar.
 *
 * **4. Ponto confirmado e ponto declarado são coisas diferentes.** Só o que foi
 * aferido em base ou atestado por serviço público ordena a fila. O declarado
 * fica visível, à parte, como "a confirmar".
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { calcula, type ItemDeclarado, type Pergunta } from "@/lib/regua";

import {
  BarraDePontuacao,
  DeOndeVemCadaPonto,
  PerdaPorBloco,
  ResumoDePontuacao,
  SemCriterio,
  VersaoDaRegua,
} from "./Pontuacao";
import Resultado from "./Resultado";
import { Campo, CartaoDeBase, dec, Escolha, Esqueleto, n, plural, Semaforo, Tarja, Tela } from "./pecas";
import type { Consulta, PerfilPublico, RespostaInscricao, UnidadeEscolha } from "./tipos";

// ────────────────────────────────────────────────────────────── etapas

const ETAPAS = [
  "identificacao",
  "consentimento",
  "crianca",
  "endereco",
  "horario",
  "bases",
  "perguntas",
  "pontuacao",
  "comprovacao",
  "creches",
  "contato",
  "revisao",
] as const;

type Etapa = (typeof ETAPAS)[number];

/**
 * A trilha mostra grupos, não as doze etapas.
 *
 * Uma decisão por tela é o padrão — o formulário anterior punha dois campos na
 * etapa 1 e treze perguntas na etapa 4 —, mas doze rótulos numa barra de
 * progresso de celular não informam nada. A contagem "Etapa N de M" é real.
 */
const GRUPOS: { rotulo: string; etapas: Etapa[] }[] = [
  { rotulo: "Entrada", etapas: ["identificacao", "consentimento"] },
  { rotulo: "A criança", etapas: ["crianca", "endereco", "horario"] },
  { rotulo: "Sua pontuação", etapas: ["bases", "perguntas", "pontuacao", "comprovacao"] },
  { rotulo: "As creches", etapas: ["creches"] },
  { rotulo: "Contato", etapas: ["contato"] },
  { rotulo: "Envio", etapas: ["revisao"] },
];

const CHAVE_LOCAL = "vaga-certa:inscricao:v2";
/**
 * A inscrição enviada, para `/acompanhar` reconsultar.
 *
 * Não há banco: a rodada é reproduzível, então a tela de acompanhamento reenvia
 * a mesma inscrição e recebe a mesma classificação, recalculada sobre a fila do
 * momento. Chave separada da de rascunho para que retomar um preenchimento não
 * apague uma inscrição já feita.
 */
const CHAVE_ENVIADA = "vaga-certa:inscricao:enviada";

// ────────────────────────────────────────────────────────── auxiliares

/** Mesmo corte de 31 de março do motor, replicado para dar retorno imediato. */
function turmaDe(nascimento: string, ano: number): { nome: string; idade: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(nascimento);
  if (!m) return null;
  const idade = ano - Number(m[1]) - (Number(m[2]) > 3 ? 1 : 0);
  if (idade === 0) return { nome: "Berçário", idade: "menos de 1 ano" };
  if (idade === 1) return { nome: "Maternal I", idade: "1 ano" };
  if (idade === 2) return { nome: "Maternal II", idade: "2 anos" };
  return null;
}

function mascaraCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

function mascaraCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function mascaraCelular(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const relogio = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function emDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

interface Resposta {
  sim: boolean;
  /** Grau escolhido no qualificador, quando a pergunta tem um. */
  grau?: string;
}

interface Props {
  bairros: string[];
  anoProcesso: number;
  maxOpcoes: number;
  listaDeEspera: { modo: string; padrao: string; justificativa: string };
  posicaoAoVivo: { textoDaMecanica: string; janelaEstabilizacaoDias: number };
  usaProximidade: boolean;
}

// ───────────────────────────────────────────────────────────── componente

export default function FormularioInscricao({
  bairros,
  anoProcesso,
  maxOpcoes,
  listaDeEspera,
  posicaoAoVivo,
  usaProximidade,
}: Props) {
  const [etapa, setEtapa] = useState<Etapa>("identificacao");

  // ── identificação e consentimento
  const [perfis, setPerfis] = useState<PerfilPublico[]>([]);
  const [cpfResponsavel, setCpfResponsavel] = useState("");
  const [consentimento, setConsentimento] = useState({ comum: false, sensivel: false });

  // ── a criança
  const [usarDnv, setUsarDnv] = useState(false);
  const [cpfCrianca, setCpfCrianca] = useState("");
  const [dnvCrianca, setDnvCrianca] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [consultando, setConsultando] = useState(false);
  const [erroConsulta, setErroConsulta] = useState<string | null>(null);

  // ── endereço
  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");
  const [endereco, setEndereco] = useState<Consulta["endereco"]>(null);
  const [erroCep, setErroCep] = useState<string | null>(null);
  const [bairroManual, setBairroManual] = useState("");
  const [buscaBairro, setBuscaBairro] = useState("");

  // ── horário
  const [horario, setHorario] = useState<"Integral" | "Parcial" | "">("");
  const [aceitaOutroTurno, setAceitaOutroTurno] = useState<boolean | null>(null);

  // ── as perguntas que restam
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [iPergunta, setIPergunta] = useState(-1);

  // ── comprovação
  const [enviados, setEnviados] = useState<Record<string, "falta_enviar" | "recebido">>({});

  // ── as creches
  const [unidades, setUnidades] = useState<UnidadeEscolha[]>([]);
  const [carregandoUnidades, setCarregandoUnidades] = useState(false);
  const [escolhidas, setEscolhidas] = useState<number[]>([]);
  const [opcaoMantida, setOpcaoMantida] = useState(1);
  const [busca, setBusca] = useState("");

  // ── contato
  const [celular, setCelular] = useState("");
  const [whatsapp, setWhatsapp] = useState(true);
  const [canal, setCanal] = useState("WhatsApp");
  const [codigo, setCodigo] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [verificadoEm, setVerificadoEm] = useState<string | null>(null);

  // ── envio
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<{ campo: string; mensagem: string }[]>([]);
  const [resposta, setResposta] = useState<RespostaInscricao | null>(null);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  const bairro = endereco?.bairro ?? bairroManual ?? null;
  const turma = turmaDe(nascimento, anoProcesso);

  /**
   * Os itens da régua: o que a base confirmou, mais o que a família declarou.
   *
   * A origem faz parte do item porque é ela que decide se o ponto ordena a fila.
   * Nada aqui recalcula pesos: a composição por bloco e o teto ficam na régua.
   */
  const itens: ItemDeclarado[] = useMemo(() => {
    const declarados: ItemDeclarado[] = [];
    for (const p of perguntas) {
      const r = respostas[p.id];
      if (!r) continue;
      // A pergunta do outro adulto é invertida: quem pontua é quem responde "não".
      const pontua = p.id === "outro_adulto" ? r.sim === false : r.sim === true;
      if (!pontua) continue;
      const grau = r.grau ?? p.grau;
      if (grau) declarados.push({ grau, origem: "declarado" });
    }
    return [...(consulta?.itens ?? []), ...declarados];
  }, [consulta, perguntas, respostas]);

  const pontuacao = useMemo(() => calcula(itens), [itens]);

  const desempates = useMemo(() => {
    // 29 = irmão matriculado na rede · 30 = responsável com menos de 18 anos.
    // Ambos vêm de base, e a régua nova mantém os dois fora dos 100 pontos.
    return consulta?.irmao ? [29] : [];
  }, [consulta]);

  const pendentes = pontuacao.pendentes.filter((i) => !i.suprimidoPeloTeto);
  const temPendencia = pendentes.length > 0;

  const etapasAtivas = useMemo(
    () => ETAPAS.filter((e) => (e === "comprovacao" ? temPendencia : true)),
    [temPendencia],
  );

  const iEtapa = etapasAtivas.indexOf(etapa);
  const grupoAtual = GRUPOS.findIndex((g) => g.etapas.includes(etapa));

  // ── salvamento contínuo ───────────────────────────────────────────────
  //
  // O ciclo pode levar treze meses e o formulário roda quase todo no celular.
  // Perder o preenchimento por uma ligação recebida é abandono garantido.
  useEffect(() => {
    if (etapa === "identificacao") return;
    try {
      localStorage.setItem(
        CHAVE_LOCAL,
        JSON.stringify({
          etapa,
          cpfResponsavel,
          consentimento,
          cpfCrianca,
          dnvCrianca,
          nascimento,
          cep,
          numero,
          bairroManual,
          horario,
          aceitaOutroTurno,
          respostas,
          escolhidas,
          opcaoMantida,
          celular,
          whatsapp,
          canal,
          salvoEm: relogio(),
        }),
      );
      setSalvoEm(relogio());
    } catch {
      // navegador sem localStorage: o fluxo continua, só não retoma depois
    }
  }, [
    etapa,
    cpfResponsavel,
    consentimento,
    cpfCrianca,
    dnvCrianca,
    nascimento,
    cep,
    numero,
    bairroManual,
    horario,
    aceitaOutroTurno,
    respostas,
    escolhidas,
    opcaoMantida,
    celular,
    whatsapp,
    canal,
  ]);

  // ── perfis da demonstração ────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/bases")
      .then((r) => r.json())
      .then((d) => setPerfis(d.perfis ?? []))
      .catch(() => setPerfis([]));
  }, []);

  // ── aquecimento do motor ──────────────────────────────────────────────
  //
  // O primeiro envio numa instância fria paga a decodificação da fila inteira
  // mais a rodada base. Dispara quando a família chega na conferência, para que
  // o envio encontre a instância quente.
  const jaAqueceu = useRef(false);
  useEffect(() => {
    if (iEtapa < etapasAtivas.indexOf("bases") || jaAqueceu.current) return;
    jaAqueceu.current = true;
    fetch("/api/inscricao").catch(() => {
      // aquecimento é otimização: falhar aqui não impede o envio
    });
  }, [iEtapa, etapasAtivas]);

  // ── creches ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (etapa !== "creches" || !turma || !horario) return;
    let vivo = true;
    setCarregandoUnidades(true);
    const q = new URLSearchParams({ grupamento: turma.nome, horario, pontos: String(pontuacao.confirmados) });
    if (bairro) q.set("bairro", bairro);
    if (pontuacao.aConfirmar > 0) {
      q.set("pontosComPendentes", String(pontuacao.confirmados + pontuacao.aConfirmar));
    }
    fetch(`/api/unidades?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        const lista: UnidadeEscolha[] = d.unidades ?? [];
        setUnidades(lista);
        const validas = new Set(lista.map((u) => u.codigo));
        setEscolhidas((atual) => atual.filter((c) => validas.has(c)));
      })
      .finally(() => {
        if (vivo) setCarregandoUnidades(false);
      });
    return () => {
      vivo = false;
    };
  }, [etapa, turma?.nome, horario, bairro, pontuacao.confirmados, pontuacao.aConfirmar]);

  useEffect(() => {
    if (escolhidas.length > 0 && opcaoMantida > escolhidas.length) setOpcaoMantida(1);
  }, [escolhidas.length, opcaoMantida]);

  const porCodigo = useMemo(() => new Map(unidades.map((u) => [u.codigo, u])), [unidades]);

  // ── consultas ─────────────────────────────────────────────────────────

  const consultarBases = useCallback(async (cpf: string) => {
    setConsultando(true);
    setErroConsulta(null);
    try {
      const r = await fetch("/api/bases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cpf }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErroConsulta(d.erro ?? "Não conseguimos consultar agora.");
        return null;
      }
      setConsulta(d.consulta);
      setPerguntas(d.perguntas ?? []);
      const c: Consulta = d.consulta;
      setNascimento(c.crianca.nascimentoMes);
      if (c.endereco) {
        setCep(c.endereco.cep);
        setNumero(c.endereco.numero);
      }
      return c;
    } catch {
      setErroConsulta("Não conseguimos falar com os sistemas agora. Seus dados estão salvos.");
      return null;
    } finally {
      setConsultando(false);
    }
  }, []);

  const consultarCep = useCallback(async () => {
    setErroCep(null);
    try {
      const r = await fetch("/api/bases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cep, numero }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErroCep(d.erro ?? "Não encontramos esse CEP.");
        setEndereco(null);
        return;
      }
      setEndereco(d.endereco);
    } catch {
      setErroCep("Falha de rede ao consultar o CEP. Tente de novo.");
    }
  }, [cep, numero]);

  // ── envio ─────────────────────────────────────────────────────────────

  const enviar = useCallback(async () => {
    setEnviando(true);
    setErros([]);
    try {
      const r = await fetch("/api/inscricao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nascimento,
          cpfCrianca: usarDnv ? "" : cpfCrianca.replace(/\D/g, ""),
          dnvCrianca: usarDnv ? dnvCrianca.replace(/\D/g, "") : "",
          cpfResponsavel: cpfResponsavel.replace(/\D/g, ""),
          cep,
          numero,
          bairro,
          horario,
          aceitaOutroTurno: aceitaOutroTurno === true,
          opcoes: escolhidas,
          itens,
          desempates,
          opcaoMantida,
          contato: { celular: celular.replace(/\D/g, ""), whatsapp, canal, verificado: Boolean(verificadoEm) },
          consentimento,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErros(d.errosPorCampo ?? [{ campo: "revisao", mensagem: d.erro ?? "Não foi possível enviar." }]);
        return;
      }
      setResposta(d);
      try {
        localStorage.setItem(
          CHAVE_ENVIADA,
          JSON.stringify({
            protocolo: d.resumo.protocolo,
            nascimento,
            cpfCrianca: usarDnv ? "" : cpfCrianca.replace(/\D/g, ""),
            dnvCrianca: usarDnv ? dnvCrianca.replace(/\D/g, "") : "",
            cep,
            numero,
            bairro,
            horario,
            aceitaOutroTurno: aceitaOutroTurno === true,
            opcoes: escolhidas,
            itens,
            desempates,
            opcaoMantida,
            contato: { celular: celular.replace(/\D/g, ""), whatsapp, canal, verificado: Boolean(verificadoEm) },
            consentimento,
            crianca: consulta?.crianca.nome ?? null,
            enviadaEm: new Date().toISOString(),
          }),
        );
        localStorage.removeItem(CHAVE_LOCAL);
      } catch {
        // navegador sem localStorage: o protocolo na tela ainda serve
      }
    } catch {
      setErros([{ campo: "revisao", mensagem: "Falha de rede ao enviar a inscrição. Tente novamente." }]);
    } finally {
      setEnviando(false);
    }
  }, [
    nascimento,
    usarDnv,
    cpfCrianca,
    dnvCrianca,
    cpfResponsavel,
    cep,
    numero,
    bairro,
    horario,
    aceitaOutroTurno,
    escolhidas,
    itens,
    desempates,
    opcaoMantida,
    celular,
    whatsapp,
    canal,
    verificadoEm,
    consentimento,
    consulta,
  ]);

  // ── navegação ─────────────────────────────────────────────────────────

  const irPara = (destino: Etapa) => {
    setEtapa(destino);
    if (destino === "perguntas") setIPergunta(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const avancar = () => {
    const i = etapasAtivas.indexOf(etapa);
    if (i < etapasAtivas.length - 1) irPara(etapasAtivas[i + 1]);
  };

  const voltar = () => {
    if (etapa === "perguntas" && iPergunta > 0) {
      setIPergunta((i) => i - 1);
      return;
    }
    const i = etapasAtivas.indexOf(etapa);
    if (i > 0) irPara(etapasAtivas[i - 1]);
  };

  const criancaOk = Boolean(turma) && (usarDnv ? dnvCrianca.replace(/\D/g, "").length === 11 : cpfCrianca.replace(/\D/g, "").length === 11);

  const podeAvancar: Record<Etapa, boolean> = {
    identificacao: cpfResponsavel.replace(/\D/g, "").length === 11 && Boolean(consulta),
    consentimento: consentimento.comum,
    crianca: criancaOk,
    endereco: Boolean(bairro),
    horario: Boolean(horario) && aceitaOutroTurno !== null,
    bases: true,
    perguntas: iPergunta >= perguntas.length,
    pontuacao: true,
    comprovacao: true,
    creches: escolhidas.length > 0,
    contato: celular.replace(/\D/g, "").length >= 10,
    revisao: escolhidas.length > 0,
  };

  if (resposta) {
    return (
      <Resultado
        resposta={resposta}
        porCodigo={porCodigo}
        crianca={consulta?.crianca.nome ?? "a criança"}
        turma={turma}
        onAcompanhar={() => setResposta(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <p className="rotulo mb-2 text-azul-medio">Formulário de inscrição</p>
      <h1 className="mb-6 text-[clamp(21px,3.2vw,27px)] font-black tracking-[-0.025em] text-azul">
        Inscrição em creche · Processo 195/{anoProcesso}
      </h1>

      <Trilha grupoAtual={grupoAtual} />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="num text-[12.5px] text-texto-3" aria-live="polite">
          Etapa {iEtapa + 1} de {etapasAtivas.length}
          {salvoEm && <span className="ml-2 text-ok">· Salvo às {salvoEm}</span>}
        </p>
        <SalvarESair protocolo={cpfResponsavel} />
      </div>

      <div className="cartao mt-4 overflow-hidden">
        <div className="p-5 md:p-7">
          {/* ─────────────────────────────────────── tela 2 — identificação */}
          {etapa === "identificacao" && (
            <Tela
              titulo="Vamos começar pelo seu login"
              instrucao="Entre com a sua conta gov.br. É o que permite consultar seus dados nos sistemas do governo, para você não precisar digitar nem levar papel."
              porQue={{
                texto: (
                  <>
                    Com o login, oito das treze perguntas do formulário antigo passam a ser respondidas pelos
                    próprios sistemas do governo — e você não precisa comprovar no balcão o que o governo já
                    sabe.{" "}
                    <Link href="/como-funciona" className="font-bold text-azul underline underline-offset-2">
                      Como funciona
                    </Link>
                  </>
                ),
              }}
            >
              <button type="button" disabled className="botao botao-primario w-full sm:w-auto opacity-40">
                Entrar com gov.br
              </button>
              <p className="mt-2 text-[13px] text-texto-3">
                O acesso pelo gov.br não está disponível neste protótipo. Use um dos perfis abaixo.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="botao botao-secundario !min-h-[48px] !px-4 !text-[12px]"
                  onClick={() => alert("No serviço real: abre o gov.br em outra aba, e a inscrição fica salva.")}
                >
                  Não tenho conta gov.br
                </button>
                <Link href="/como-funciona#polos" className="botao botao-secundario !min-h-[48px] !px-4 !text-[12px]">
                  Fazer no polo ou pelo 1746
                </Link>
              </div>

              <div className="mt-7 border-2 border-dashed border-atencao/50 bg-atencao-fundo/40 p-4">
                <p className="rotulo mb-1 text-atencao">Demonstração</p>
                <p className="mb-3 max-w-[62ch] text-[14px] text-texto-2">
                  Entre como uma destas famílias. São casos da base de 2025, anonimizados. O selo diz o que cada
                  um serve para mostrar.
                </p>
                <ul className="space-y-2">
                  {perfis.map((p) => (
                    <li key={p.cpf}>
                      <button
                        type="button"
                        onClick={async () => {
                          setCpfResponsavel(mascaraCpf(p.cpf));
                          const c = await consultarBases(p.cpf);
                          if (c) irPara("consentimento");
                        }}
                        className="w-full rounded border border-linha-forte bg-white px-4 py-3 text-left transition hover:border-azul"
                      >
                        <span className="block text-[15px] font-bold text-azul">{p.responsavel}</span>
                        <span className="block text-[13.5px] text-texto-2">
                          Responsável de {p.crianca} · CPF {mascaraCpf(p.cpf)}
                        </span>
                        <span className="mt-1 inline-block rounded bg-azul-10 px-2 py-0.5 text-[12px] font-bold text-azul">
                          {p.selo}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {consultando && <p className="mt-3 text-[13.5px] text-texto-2">Consultando…</p>}
                {erroConsulta && (
                  <p className="mt-3 text-[13.5px] font-bold text-erro" role="alert">
                    {erroConsulta}
                  </p>
                )}
              </div>
            </Tela>
          )}

          {/* ──────────────────────────────────────── tela 3 — consentimento */}
          {etapa === "consentimento" && (
            <Tela
              titulo="Podemos consultar seus dados nos sistemas do governo?"
              instrucao="Assim você não precisa digitar nem levar documento do que o governo já sabe."
            >
              <BlocoDeConsentimento
                titulo="Consulta comum"
                base="Execução de política pública — LGPD, art. 7º, III"
                bases={[
                  ["Receita Federal", "nome e data de nascimento seus e da criança"],
                  ["CadÚnico (CECAD/Dataprev)", "renda por pessoa, quem mora com você e a data do cadastro"],
                  ["Sistema de Gestão Acadêmica (SME)", "se a criança tem irmão matriculado na rede"],
                  ["Histórico da própria inscrição", "em quantos processos você já esperou vaga"],
                ]}
                marcada={consentimento.comum}
                onMarcar={(v) => setConsentimento((c) => ({ ...c, comum: v }))}
                texto="Autorizo a consulta destes dados para a minha inscrição na creche."
              />

              {/* Caixa própria: a base legal do dado sensível não é a mesma, e
                  recusar aqui tem de ser possível — com a consequência dita. */}
              <div className="mt-5">
                <BlocoDeConsentimento
                  titulo="Consulta de dado sensível"
                  base='Proteção da vida e tutela da saúde — LGPD, art. 11, II, "b"'
                  bases={[
                    ["INSS / BPC", "benefício por deficiência seu ou da criança"],
                    ["Rede municipal de saúde / SISVAN", "acompanhamento nutricional e de saúde da criança"],
                  ]}
                  marcada={consentimento.sensivel}
                  onMarcar={(v) => setConsentimento((c) => ({ ...c, sensivel: v }))}
                  texto="Autorizo também a consulta dos dados de saúde e deficiência."
                  aviso="Sem essa autorização não conseguimos considerar deficiência, saúde nem situações de risco na sua pontuação."
                />
              </div>

              <div className="tarja mt-5 border-l-azul">
                <p className="rotulo mb-1 text-azul">Informação protegida de outro órgão</p>
                <p className="max-w-[66ch] text-[14px] text-texto-2">
                  Consultamos a Vara da Infância, o Conselho Tutelar e o cadastro de acolhimento para saber se
                  existe medida de proteção em favor da criança. Essa consulta não depende da sua autorização e o
                  conteúdo não aparece em nenhuma tela.
                </p>
              </div>

              <p className="mt-4 text-[12.5px] text-texto-3">
                Finalidade: classificar a inscrição no processo 195/{anoProcesso}. Guarda: até o encerramento do
                processo e cinco anos de prazo legal.{" "}
                <Link href="/como-funciona#lgpd" className="font-bold text-azul-medio underline underline-offset-2">
                  Ler o termo completo
                </Link>
              </p>

              {!consentimento.comum && (
                <div className="tarja mt-5 border-l-atencao bg-atencao-fundo">
                  <p className="max-w-[66ch] text-[14.5px] text-texto-2">
                    <strong className="text-texto">Prefiro não autorizar.</strong> Sem a consulta, você precisa
                    declarar cada critério e comprovar todos num ponto de atendimento. É o processo antigo, e é o
                    que fez 6 de cada 10 famílias que declararam critério perderem pontos em 2025.
                  </p>
                </div>
              )}
            </Tela>
          )}

          {/* ───────────────────────────────────────────── tela 4 — a criança */}
          {etapa === "crianca" && (
            <Tela
              titulo={usarDnv ? "Qual é o número da Declaração de Nascido Vivo?" : "Qual é o CPF da criança?"}
              instrucao={
                usarDnv
                  ? "A Declaração de Nascido Vivo tem 11 dígitos e vem da maternidade."
                  : "O CPF sai junto com a certidão de nascimento. Com ele, o nome e a data vêm preenchidos."
              }
              porQue={{
                texto:
                  "A turma é definida pela idade da criança em 31 de março. O CPF também é o que permite contar quantos processos a criança já esperou — sem ele, duas inscrições da mesma criança viram duas crianças diferentes na fila.",
              }}
            >
              <div className="max-w-sm">
                {usarDnv ? (
                  <Campo rotulo="Declaração de Nascido Vivo">
                    <input
                      inputMode="numeric"
                      value={dnvCrianca}
                      onChange={(e) => setDnvCrianca(e.target.value.replace(/\D/g, "").slice(0, 11))}
                      className="campo num"
                    />
                  </Campo>
                ) : (
                  <Campo rotulo="CPF da criança">
                    <input
                      inputMode="numeric"
                      value={cpfCrianca}
                      onChange={(e) => setCpfCrianca(mascaraCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      className="campo num"
                    />
                  </Campo>
                )}
              </div>

              <button
                type="button"
                onClick={() => setUsarDnv((v) => !v)}
                className="mt-3 min-h-[44px] text-[14px] font-bold text-azul underline underline-offset-2"
              >
                {usarDnv ? "A criança tem CPF" : "A criança não tem CPF"}
              </button>

              {usarDnv && (
                <div className="mt-3">
                  <Tarja tom="atencao">
                    Você pode tirar o CPF da criança agora, de graça, no site da Receita Federal — a inscrição
                    fica salva.
                  </Tarja>
                </div>
              )}

              {consulta && turma && (
                <div className="cartao mt-6 overflow-hidden border-ok">
                  <p className="cartao-titulo bg-ok">✓ Encontramos a criança</p>
                  <div className="p-4">
                    <p className="text-[18px] font-bold text-azul">{consulta.crianca.nome}</p>
                    <p className="num mt-1 text-[14.5px] text-texto-2">
                      Nascida em {consulta.crianca.nascimento}
                    </p>
                    <p className="mt-1 text-[14.5px] text-texto-2">
                      Turma: <strong className="text-texto">{turma.nome}</strong>{" "}
                      <span className="text-texto-3">
                        ({turma.idade} em 31/03/{anoProcesso})
                      </span>
                    </p>
                    <p className="mt-3 border-t border-linha pt-2.5 text-[12.5px] text-texto-3">
                      Receita Federal · consultado hoje às {relogio()}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCpfCrianca("");
                        setConsulta(null);
                      }}
                      className="mt-1 min-h-[44px] text-[13.5px] font-bold text-azul underline underline-offset-2"
                    >
                      Não é esta criança? Corrigir CPF
                    </button>
                  </div>
                </div>
              )}

              {nascimento && !turma && (
                <div className="mt-5">
                  <Tarja tom="erro" titulo="Fora da faixa da creche">
                    Pela data informada, a criança não se enquadra em creche neste processo — a vaga de creche vai
                    até 3 anos incompletos em 31 de março.{" "}
                    <Link href="/como-funciona#pre-escola" className="font-bold text-azul underline underline-offset-2">
                      Veja como se inscrever em pré-escola →
                    </Link>
                  </Tarja>
                </div>
              )}

              {/* Vínculo não confirmado não bloqueia: bloquear aqui excluiria
                  avó, tia e guarda de fato, que são arranjos familiares reais. */}
              {consulta && !consulta.crianca.vinculoConfirmado && (
                <div className="mt-4">
                  <Tarja tom="atencao">
                    A criança não consta como sua dependente nos sistemas. Isso não impede a inscrição — vamos
                    pedir um documento de vínculo mais adiante no processo.
                  </Tarja>
                </div>
              )}
            </Tela>
          )}

          {/* ──────────────────────────────────────────── tela 5 — endereço */}
          {etapa === "endereco" && (
            <Tela
              titulo="Onde a criança mora?"
              instrucao={
                usaProximidade
                  ? "Usamos para mostrar as creches mais perto e para desempatar por proximidade."
                  : "Usamos para mostrar as creches mais perto da criança."
              }
              porQue={{
                texto: usaProximidade
                  ? "A proximidade entra como critério de desempate entre crianças com a mesma pontuação."
                  : "A proximidade ordena a lista de creches. Ela ainda não é critério de desempate neste processo: o instrumento normativo está a confirmar.",
              }}
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                <Campo rotulo="CEP" erro={erroCep}>
                  <input
                    inputMode="numeric"
                    value={cep}
                    onChange={(e) => {
                      setCep(mascaraCep(e.target.value));
                      setEndereco(null);
                    }}
                    onBlur={() => cep.replace(/\D/g, "").length === 8 && consultarCep()}
                    placeholder="00000-000"
                    className="campo num"
                  />
                </Campo>
                <Campo rotulo="Número">
                  <input
                    value={numero}
                    onChange={(e) => setNumero(e.target.value.slice(0, 10))}
                    className="campo num sm:w-32"
                  />
                </Campo>
              </div>
              <button
                type="button"
                onClick={() => setNumero("s/n")}
                className="mt-2 min-h-[44px] text-[13.5px] font-bold text-azul underline underline-offset-2"
              >
                Meu endereço não tem número
              </button>

              {endereco && (
                <div className="cartao mt-5 overflow-hidden">
                  <p className="cartao-titulo">Endereço encontrado</p>
                  <div className="p-4">
                    <p className="text-[16px] font-bold">
                      {endereco.logradouro}
                      {endereco.numero && endereco.numero !== "s/n" ? `, ${endereco.numero}` : ", s/n"}
                    </p>
                    {/* Bairro é sempre leitura, derivado do CEP. Nunca lista,
                        nunca texto livre: no formulário antigo o seletor
                        oferecia as 1.607 variações cruas da base, o mesmo bairro
                        aparecia até quatro vezes, e escolher a variante errada
                        mudava a classificação da criança em silêncio. */}
                    <p className="mt-1 text-[14.5px] text-texto-2">
                      Bairro: <strong className="text-texto">{endereco.bairro}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setEndereco(null);
                        setCep("");
                      }}
                      className="mt-2 min-h-[44px] text-[13.5px] font-bold text-azul underline underline-offset-2"
                    >
                      Não é aqui? Corrigir CEP
                    </button>
                  </div>
                </div>
              )}

              {endereco?.geoAproximada && (
                <div className="mt-4">
                  <Tarja tom="atencao">
                    Neste CEP a distância é calculada pelo centro da região, não pela sua casa. Se a creche mais
                    perto não aparecer no topo, você ainda pode escolhê-la na lista.
                  </Tarja>
                </div>
              )}

              {/* Só quando o CEP não resolve — e aí com a lista canônica, com
                  busca tolerante a acento e caixa. */}
              {!endereco && erroCep && (
                <div className="mt-5 max-w-md">
                  <Campo rotulo="Ou escolha o bairro" apoio="Digite sem se preocupar com acento ou maiúscula.">
                    <input
                      value={buscaBairro}
                      onChange={(e) => setBuscaBairro(e.target.value)}
                      placeholder="Ex.: jacarepagua"
                      className="campo"
                    />
                  </Campo>
                  <ul className="cartao mt-2 max-h-64 divide-y divide-linha overflow-auto">
                    {bairros
                      .filter((b) => {
                        const t = buscaBairro
                          .normalize("NFD")
                          .replace(RegExp("[\\u0300-\\u036f]", "g"), "")
                          .toUpperCase();
                        const c = b.normalize("NFD").replace(RegExp("[\\u0300-\\u036f]", "g"), "").toUpperCase();
                        return !t || c.split(" ").some((p) => p.startsWith(t));
                      })
                      .slice(0, 20)
                      .map((b) => (
                        <li key={b}>
                          <button
                            type="button"
                            onClick={() => {
                              setBairroManual(b);
                              setBuscaBairro(b);
                            }}
                            className={`min-h-[48px] w-full px-4 text-left text-[15px] ${
                              bairroManual === b ? "bg-azul-10 font-bold text-azul" : "hover:bg-cinza"
                            }`}
                          >
                            {b}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </Tela>
          )}

          {/* ───────────────────────────────────────────── tela 6 — horário */}
          {etapa === "horario" && (
            <Tela titulo="De qual horário você precisa?">
              <div className="grid gap-3 sm:grid-cols-2">
                <Escolha
                  titulo="Dia inteiro"
                  apoio="7h às 17h · com refeições"
                  marcada={horario === "Integral"}
                  onEscolher={() => setHorario("Integral")}
                  largura="cheia"
                />
                <Escolha
                  titulo="Meio período"
                  apoio="4 horas · manhã ou tarde"
                  marcada={horario === "Parcial"}
                  onEscolher={() => setHorario("Parcial")}
                  largura="cheia"
                />
              </div>

              {horario && (
                <fieldset className="mt-7">
                  <legend className="mb-2 text-[16px] font-bold">
                    {horario === "Integral"
                      ? "Se não houver vaga de dia inteiro, você aceita meio período?"
                      : "Se não houver vaga de meio período, você aceita dia inteiro?"}
                  </legend>
                  <div className="flex gap-3">
                    <Escolha titulo="Sim" marcada={aceitaOutroTurno === true} onEscolher={() => setAceitaOutroTurno(true)} />
                    <Escolha titulo="Não" marcada={aceitaOutroTurno === false} onEscolher={() => setAceitaOutroTurno(false)} />
                  </div>
                  <p className="mt-2.5 max-w-[62ch] text-[14px] text-texto-2">
                    Quem aceita as duas opções concorre a mais vagas. Você pode mudar isso depois.
                  </p>
                </fieldset>
              )}
            </Tela>
          )}

          {/* ─────────────────────────── tela 7 — o que já sabemos */}
          {etapa === "bases" && consulta && (
            <Tela
              titulo="Consultamos os sistemas do governo. Isto é o que encontramos."
              instrucao="Você não precisa confirmar nem provar nada disto. Se algo estiver errado, pode contestar."
            >
              <p className="num rotulo mb-2" aria-live="polite">
                {consulta.consultadas} de {consulta.totalDeBases} sistemas consultados
              </p>
              <ul className="cartao divide-y divide-linha overflow-hidden">
                {consulta.cartoes.map((c) => (
                  <CartaoDeBase
                    key={c.id}
                    cartao={c}
                    onAcao={(tipo) =>
                      alert(
                        tipo === "cras"
                          ? "No serviço real: abre o mapa com os CRAS mais próximos e o horário de atendimento."
                          : "No serviço real: abre o envio do laudo, com câmera e arquivo.",
                      )
                    }
                  />
                ))}
              </ul>

              <div className="mt-5">
                <Tarja tom="ok">
                  Estas informações não foram perguntadas a você.{" "}
                  <strong className="text-texto">
                    {perguntas.length === 0
                      ? "Não sobrou nenhuma pergunta."
                      : `Sobraram ${perguntas.length === 1 ? "1 pergunta" : `${perguntas.length} perguntas`} — as que nenhum sistema do governo responde.`}
                  </strong>
                </Tarja>
              </div>
            </Tela>
          )}

          {/* ─────────────────────────── tela 8 — as perguntas que restam */}
          {etapa === "perguntas" && (
            <PerguntasQueRestam
              perguntas={perguntas}
              indice={iPergunta}
              respostas={respostas}
              onResponder={(id, r) => setRespostas((a) => ({ ...a, [id]: r }))}
              onAvancar={() => setIPergunta((i) => i + 1)}
              onComecar={() => setIPergunta(0)}
            />
          )}

          {/* ──────────────────────────────────────── tela 9 — a pontuação */}
          {etapa === "pontuacao" && (
            <Tela titulo={`Sua pontuação: ${pontuacao.confirmados} de ${pontuacao.pontuacaoMaxima}`}>
              <div aria-live="polite">
                <BarraDePontuacao pontuacao={pontuacao} />
              </div>

              {pontuacao.aConfirmar > 0 && (
                <p className="mt-4 max-w-[66ch] text-[15px] text-texto-2">
                  <span className="num font-bold text-texto">{pontuacao.confirmados} pontos</span> já estão
                  confirmados nos sistemas do governo e valem na fila agora. Os outros{" "}
                  <span className="num font-bold text-texto">{pontuacao.aConfirmar}</span> passam a valer quando o
                  documento for aceito.
                </p>
              )}

              <div className="mt-6">
                {pontuacao.blocos.length === 0 ? <SemCriterio /> : <DeOndeVemCadaPonto pontuacao={pontuacao} />}
              </div>

              <PerdaPorBloco pontuacao={pontuacao} />
              <VersaoDaRegua versao={pontuacao.reguaVersao} vigencia={3} />
            </Tela>
          )}

          {/* ────────────────────────── tela 10 — o que falta comprovar */}
          {etapa === "comprovacao" && (
            <Tela
              titulo={`Falta comprovar ${pendentes.length === 1 ? "1 coisa" : `${pendentes.length} coisas`}`}
              instrucao={`Você tem até ${emDias(30)} — 30 dias. Pode enviar pelo celular ou levar num ponto de atendimento.`}
            >
              <ul className="space-y-4">
                {pendentes.map((i) => (
                  <li key={i.grau} className="cartao overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha bg-cinza px-4 py-2.5">
                      <p className="text-[14.5px] font-bold">{i.rotulo}</p>
                      <span
                        className={`rotulo ${enviados[i.grau] === "recebido" ? "text-ok" : "text-atencao"}`}
                      >
                        {enviados[i.grau] === "recebido" ? "✓ recebido" : "⏳ falta enviar"}
                      </span>
                    </div>
                    <div className="p-4">
                      {/* Documento → grau fica no catálogo, e não na tela. Dizer
                          "com medida protetiva: 25 pontos" transformaria a
                          comprovação em compra de pontuação. */}
                      <p className="rotulo mb-1.5">Serve qualquer um destes</p>
                      <ul className="mb-4 list-inside list-disc text-[14.5px] text-texto-2">
                        {(DOCUMENTOS[i.grau] ?? ["Consulte o ponto de atendimento sobre o documento aceito"]).map(
                          (d) => (
                            <li key={d}>{d}</li>
                          ),
                        )}
                      </ul>

                      {/* O canal presencial tem o mesmo peso visual do digital:
                          comprovação só por aplicativo reintroduz, no ponto mais
                          sensível, a exclusão que o desenho quer eliminar. */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEnviados((a) => ({ ...a, [i.grau]: "recebido" }))}
                          className="botao botao-primario !min-h-[48px] !px-4 !text-[12px]"
                        >
                          Tirar foto ou enviar arquivo
                        </button>
                        <Link
                          href="/como-funciona#polos"
                          className="botao botao-secundario !min-h-[48px] !px-4 !text-[12px]"
                        >
                          Ver pontos de atendimento
                        </Link>
                      </div>

                      {SERVICO[i.grau] && (
                        <p className="mt-3 border-t border-linha pt-3 text-[14px] text-texto-2">
                          Se o {SERVICO[i.grau]} já acompanha sua família, ele pode informar direto no sistema — e
                          você não leva nada.{" "}
                          <button
                            type="button"
                            onClick={() => alert("No serviço real: registra o pedido de atestação ao serviço.")}
                            className="font-bold text-azul underline underline-offset-2"
                          >
                            Quero essa opção
                          </button>
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-5 text-[14px] text-texto-2">
                Bloquear a inscrição por causa da comprovação seria reproduzir a fila do balcão dentro do
                aplicativo.{" "}
                <button type="button" onClick={avancar} className="font-bold text-azul underline underline-offset-2">
                  Fazer isso depois
                </button>{" "}
                — o prazo é {emDias(30)}.
              </p>
            </Tela>
          )}

          {/* ─────────────────────────────── tela 11 — escolher as creches */}
          {etapa === "creches" && (
            <Tela
              titulo={`Escolha até ${maxOpcoes} creches, na ordem que você preferir`}
              instrucao="Coloque na ordem que você realmente quer. Dizer a verdade nunca diminui sua chance de vaga."
              porQue={{
                rotulo: "Como a fila de cada creche é calculada?",
                texto: (
                  <>
                    A fila mostrada usa <strong>só a sua pontuação confirmada</strong>. Mostrar a posição contando
                    com pontos que ainda não foram comprovados faria você escolher a creche disputada apostando em
                    algo que talvez não se realize.
                  </>
                ),
              }}
            >
              {escolhidas.length > 0 && (
                <div className="cartao mb-6 overflow-hidden border-azul">
                  <div className="flex items-baseline justify-between bg-azul-10 px-4 py-2.5">
                    <p className="rotulo text-azul">Suas escolhas</p>
                    <p className="num text-[13px] font-bold text-azul" aria-live="polite">
                      {escolhidas.length} de {maxOpcoes}
                    </p>
                  </div>
                  <ol className="divide-y divide-linha">
                    {escolhidas.map((codigo, i) => {
                      const u = porCodigo.get(codigo);
                      return (
                        <li key={codigo} className="flex flex-wrap items-center gap-3 px-3 py-3">
                          <span className="num flex size-9 shrink-0 items-center justify-center rounded bg-azul text-[14px] font-bold text-white">
                            {i + 1}ª
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-bold">{u?.nome ?? codigo}</span>
                            <span className="block text-[12.5px] text-texto-3">
                              {u?.bairro}
                              {u && u.distanciaKm !== null ? ` · ${dec(u.distanciaKm)} km` : ""}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {/* Três vias para reordenar. O formulário anterior
                                tinha só as setas, de 40 px, na ação de maior
                                precisão da tela. */}
                            <label className="flex items-center gap-1.5 text-[12.5px] text-texto-3">
                              <span className="sr-only">Posição de {u?.nome}</span>
                              <select
                                value={i + 1}
                                onChange={(e) => {
                                  const destino = Number(e.target.value) - 1;
                                  setEscolhidas((a) => {
                                    const c = [...a];
                                    const [x] = c.splice(i, 1);
                                    c.splice(destino, 0, x);
                                    return c;
                                  });
                                }}
                                className="min-h-[48px] rounded border border-linha-forte bg-white px-2 text-[14px]"
                              >
                                {escolhidas.map((_, j) => (
                                  <option key={j} value={j + 1}>
                                    {j + 1}ª
                                  </option>
                                ))}
                              </select>
                            </label>
                            <BotaoIcone
                              rotulo={`Subir ${u?.nome ?? ""}`}
                              desabilitado={i === 0}
                              onClick={() =>
                                setEscolhidas((a) => {
                                  const c = [...a];
                                  [c[i - 1], c[i]] = [c[i], c[i - 1]];
                                  return c;
                                })
                              }
                            >
                              ↑
                            </BotaoIcone>
                            <BotaoIcone
                              rotulo={`Descer ${u?.nome ?? ""}`}
                              desabilitado={i === escolhidas.length - 1}
                              onClick={() =>
                                setEscolhidas((a) => {
                                  const c = [...a];
                                  [c[i + 1], c[i]] = [c[i], c[i + 1]];
                                  return c;
                                })
                              }
                            >
                              ↓
                            </BotaoIcone>
                            <BotaoIcone
                              rotulo={`Remover ${u?.nome ?? ""}`}
                              onClick={() => setEscolhidas((a) => a.filter((c) => c !== codigo))}
                            >
                              ✕
                            </BotaoIcone>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {escolhidas.length === maxOpcoes && (
                <div className="mb-5">
                  <Tarja tom="ok">
                    Você vai receber <strong className="text-texto">um</strong> convite: da melhor opção que
                    conseguirmos. As outras continuam valendo — se abrir vaga numa opção melhor, a gente muda sua
                    criança automaticamente.
                  </Tarja>
                </div>
              )}

              <div className="max-w-md">
                <Campo rotulo="Buscar por nome ou bairro">
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Ex.: Caju, CM Ladeira"
                    className="campo"
                  />
                </Campo>
              </div>

              {carregandoUnidades ? (
                <div className="mt-6">
                  <Esqueleto linhas={3} />
                </div>
              ) : (
                <>
                  <p className="rotulo mt-6 mb-2" aria-live="polite">
                    {n(unidades.length)} creches oferecem {turma?.nome} · {horario === "Integral" ? "dia inteiro" : "meio período"}
                  </p>
                  <ul className="cartao divide-y divide-linha overflow-hidden">
                    {unidades
                      .filter((u) => !escolhidas.includes(u.codigo))
                      .filter((u) => {
                        const t = busca.trim().toLowerCase();
                        return !t || u.nome.toLowerCase().includes(t) || (u.bairro ?? "").toLowerCase().includes(t);
                      })
                      .slice(0, 40)
                      .map((u) => (
                        <li key={u.codigo} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-bold">{u.nome}</span>
                            <span className="block text-[12.5px] text-texto-3">
                              {u.bairro}
                              {u.distanciaKm !== null ? ` · ${dec(u.distanciaKm)} km` : ""}
                            </span>
                            <span className="num mt-0.5 block text-[13px] text-texto-2">
                              {plural(u.vagas, "vaga", "vagas")}
                            </span>
                            {u.chance && u.aFrente !== null && (
                              <span className="mt-1.5 block">
                                <Semaforo chance={u.chance} aFrente={u.aFrente} />
                              </span>
                            )}
                            {/* Sempre abaixo da posição real, e em cinza. */}
                            {u.aFrenteSeComprovar !== null && u.aFrente !== null && u.aFrenteSeComprovar < u.aFrente && (
                              <span className="num mt-1 block text-[12.5px] text-texto-3">
                                Comprovando os {pontuacao.aConfirmar} pontos que faltam, você subiria para{" "}
                                {u.aFrenteSeComprovar + 1}ª nesta creche.
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setEscolhidas((a) => (a.length >= maxOpcoes || a.includes(u.codigo) ? a : [...a, u.codigo]))
                            }
                            disabled={escolhidas.length >= maxOpcoes}
                            className="botao botao-secundario shrink-0 !min-h-[48px] !px-4 !text-[12px] disabled:cursor-not-allowed disabled:border-linha disabled:text-texto-3"
                          >
                            Escolher
                          </button>
                        </li>
                      ))}
                    {unidades.filter((u) => !escolhidas.includes(u.codigo)).length === 0 && (
                      <li className="px-4 py-5 text-[14.5px] text-texto-3">
                        Nenhuma creche encontrada com esse nome.{" "}
                        <button
                          type="button"
                          onClick={() => setBusca("")}
                          className="font-bold text-azul underline underline-offset-2"
                        >
                          Limpar busca
                        </button>
                      </li>
                    )}
                  </ul>
                </>
              )}

              {escolhidas.length > 1 && (
                <div className="cartao mt-6 overflow-hidden">
                  <p className="cartao-titulo">Lista de espera</p>
                  <div className="p-4">
                    <p className="mb-3 max-w-[66ch] text-[14.5px] text-texto-2">
                      Se a criança for atendida numa opção que não é a que vocês mais querem, ela continua na
                      lista de espera de <strong className="text-texto">uma</strong> das opções. Vocês escolhem
                      qual.
                    </p>
                    <Campo rotulo="Manter na lista de espera de" apoio={`Padrão: a 1ª escolha. ${listaDeEspera.justificativa}`}>
                      <select
                        value={opcaoMantida}
                        onChange={(e) => setOpcaoMantida(Number(e.target.value))}
                        className="campo"
                      >
                        {escolhidas.map((c, i) => (
                          <option key={c} value={i + 1}>
                            {i + 1}ª escolha — {porCodigo.get(c)?.nome ?? c}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                </div>
              )}
            </Tela>
          )}

          {/* ─────────────────────────────────────────── tela 12 — contato */}
          {etapa === "contato" && (
            <Tela
              titulo="Para onde avisamos quando sair a vaga?"
              instrucao="A vaga pode sair em alguns meses. Confirme um número que você vá continuar usando."
            >
              <div className="max-w-sm">
                <Campo rotulo="Celular com DDD">
                  <input
                    inputMode="numeric"
                    value={celular}
                    onChange={(e) => {
                      setCelular(mascaraCelular(e.target.value));
                      setVerificadoEm(null);
                      setCodigoEnviado(false);
                    }}
                    placeholder="(21) 90000-0000"
                    className="campo num"
                  />
                </Campo>
              </div>

              <div className="mt-4 flex gap-3">
                <Escolha titulo="Tem WhatsApp" marcada={whatsapp} onEscolher={() => setWhatsapp(true)} />
                <Escolha titulo="Não tem" marcada={!whatsapp} onEscolher={() => setWhatsapp(false)} />
              </div>

              <fieldset className="mt-7">
                <legend className="rotulo mb-2">Como você prefere ser avisado?</legend>
                <div className="grid gap-2.5 sm:grid-cols-4">
                  {["WhatsApp", "SMS", "E-mail", "Ligação"].map((c) => (
                    <Escolha key={c} titulo={c} marcada={canal === c} onEscolher={() => setCanal(c)} largura="cheia" />
                  ))}
                </div>
              </fieldset>

              <div className="mt-7 border-t border-linha pt-5">
                {verificadoEm ? (
                  <p className="text-[15px] font-bold text-ok">✓ Celular confirmado às {verificadoEm}</p>
                ) : codigoEnviado ? (
                  <div className="max-w-xs">
                    <Campo rotulo="Código de 6 dígitos" apoio="No protótipo, qualquer sequência de 6 dígitos confirma.">
                      <input
                        inputMode="numeric"
                        value={codigo}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setCodigo(v);
                          if (v.length === 6) setVerificadoEm(relogio());
                        }}
                        className="campo num tracking-[0.3em]"
                      />
                    </Campo>
                    <button
                      type="button"
                      onClick={() => setCodigoEnviado(false)}
                      className="mt-2 min-h-[44px] text-[13.5px] font-bold text-azul underline underline-offset-2"
                    >
                      Não recebi o código
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={celular.replace(/\D/g, "").length < 10}
                    onClick={() => setCodigoEnviado(true)}
                    className="botao botao-secundario !min-h-[48px] !px-5 !text-[12px] disabled:cursor-not-allowed disabled:border-linha disabled:text-texto-3"
                  >
                    Enviar código de confirmação
                  </button>
                )}
              </div>
            </Tela>
          )}

          {/* ──────────────────────────────── tela 13 — revisão e envio */}
          {etapa === "revisao" && (
            <Tela
              titulo="Confira antes de enviar"
              instrucao='Pode alterar qualquer resposta. Nada é enviado até você tocar em "Enviar inscrição".'
            >
              <dl className="cartao divide-y divide-linha overflow-hidden">
                <Linha rotulo="Criança" origem="base">
                  {consulta?.crianca.nome ?? "—"}
                  <span className="block text-[13.5px] text-texto-3">
                    {turma ? `${turma.nome} · ${turma.idade} em 31/03/${anoProcesso}` : "—"}
                  </span>
                </Linha>
                <Linha rotulo="Endereço" onAlterar={() => irPara("endereco")}>
                  {endereco ? `${endereco.logradouro} · ${endereco.bairro}` : (bairro ?? "—")}
                </Linha>
                <Linha rotulo="Horário" onAlterar={() => irPara("horario")}>
                  {horario === "Integral" ? "Dia inteiro (7h–17h)" : horario === "Parcial" ? "Meio período" : "—"}
                  <span className="block text-[13.5px] text-texto-3">
                    {aceitaOutroTurno ? "Aceita o outro horário se não houver vaga" : "Só este horário"}
                  </span>
                </Linha>
                <Linha rotulo="Pontuação" origem="base">
                  <ResumoDePontuacao pontuacao={pontuacao} />
                </Linha>
                <Linha rotulo="Creches escolhidas" onAlterar={() => irPara("creches")}>
                  <ol className="space-y-1">
                    {escolhidas.map((c, i) => (
                      <li key={c} className="flex gap-2">
                        <span className="num font-bold text-azul">{i + 1}ª</span>
                        <span>{porCodigo.get(c)?.nome ?? c}</span>
                      </li>
                    ))}
                  </ol>
                </Linha>
                <Linha rotulo="Contato" onAlterar={() => irPara("contato")}>
                  {celular || "—"} · {canal}
                  {verificadoEm && <span className="ml-2 text-[13.5px] font-bold text-ok">✓ confirmado</span>}
                </Linha>
                {temPendencia && (
                  <Linha rotulo="Falta comprovar" onAlterar={() => irPara("comprovacao")}>
                    {pendentes.map((p) => p.rotulo).join(" · ")}
                  </Linha>
                )}
              </dl>

              {erros.length > 0 && (
                <div className="tarja mt-5 border-l-erro bg-erro-fundo" role="alert">
                  <p className="rotulo mb-1 text-erro">Não foi possível enviar</p>
                  <ul className="space-y-1 text-[14.5px]">
                    {erros.map((e) => (
                      <li key={e.mensagem}>
                        {/* Cada erro é um link que leva ao campo. */}
                        <button
                          type="button"
                          onClick={() => irPara(e.campo === "pontuacao" ? "pontuacao" : (e.campo as Etapa))}
                          className="text-left font-bold text-erro underline underline-offset-2"
                        >
                          {e.mensagem}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={enviar}
                disabled={enviando || escolhidas.length === 0}
                className="botao botao-primario mt-6 w-full !min-h-[52px] disabled:cursor-not-allowed disabled:border-linha-forte disabled:bg-linha-forte"
              >
                {enviando ? "Enviando…" : "Enviar inscrição"}
              </button>
            </Tela>
          )}
        </div>

        {/* ───────────────────────────────────────────────── navegação */}
        <div className="flex items-center justify-between gap-3 border-t border-linha bg-cinza px-5 py-4">
          <button
            type="button"
            onClick={voltar}
            disabled={iEtapa === 0}
            className="botao botao-secundario !min-h-[48px] !px-5 !text-[12px] disabled:cursor-not-allowed disabled:border-linha disabled:text-texto-3"
          >
            Voltar
          </button>
          {etapa !== "revisao" && (
            <button
              type="button"
              onClick={avancar}
              disabled={!podeAvancar[etapa]}
              className="botao botao-primario !min-h-[48px] !px-6 !text-[12px] disabled:cursor-not-allowed disabled:border-linha-forte disabled:bg-linha-forte"
            >
              Continuar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────── as perguntas

/**
 * Uma pergunta por tela, com a consequência à frente da resposta.
 *
 * A pontuação **não** aparece ao lado da pergunta. No formulário anterior, "51
 * pontos" ficava ao lado de "sua família está no CadÚnico?" — que é ensinar a
 * marcar, e piora o dado que a política precisa. Aqui o número só aparece na
 * tela seguinte, na decomposição.
 *
 * O qualificador de *quem* também não mostra pontos: exibir `25` ao lado de "a
 * criança" e `20` ao lado de "outra pessoa da casa" construiria, com as próprias
 * mãos, a superfície de manipulação que a régua nova acabou de eliminar.
 */
function PerguntasQueRestam({
  perguntas,
  indice,
  respostas,
  onResponder,
  onAvancar,
  onComecar,
}: {
  perguntas: Pergunta[];
  indice: number;
  respostas: Record<string, Resposta>;
  onResponder: (id: string, r: Resposta) => void;
  onAvancar: () => void;
  onComecar: () => void;
}) {
  if (perguntas.length === 0) {
    return (
      <Tela titulo="Não sobrou nenhuma pergunta" instrucao="Os sistemas do governo responderam tudo o que a régua precisa.">
        <Tarja tom="ok">Siga para ver a sua pontuação.</Tarja>
      </Tela>
    );
  }

  if (indice < 0) {
    return (
      <Tela titulo={`Faltam ${perguntas.length === 1 ? "1 pergunta" : `${perguntas.length} perguntas`}`}>
        <p className="max-w-[64ch] text-[15px] text-texto-2">
          São situações que nenhum sistema do governo registra. Se você marcar "sim" em alguma, vai precisar
          comprovar depois — pela internet ou num ponto de atendimento.{" "}
          <strong className="text-texto">Marcar "não" não prejudica nada do que já foi confirmado.</strong>
        </p>
        <button type="button" onClick={onComecar} className="botao botao-primario mt-6">
          Começar
        </button>
      </Tela>
    );
  }

  if (indice >= perguntas.length) {
    return (
      <Tela titulo="Perguntas respondidas" instrucao="Siga para ver a sua pontuação.">
        <ul className="cartao divide-y divide-linha overflow-hidden">
          {perguntas.map((p) => (
            <li key={p.id} className="flex flex-wrap justify-between gap-x-4 px-4 py-3">
              <span className="max-w-[46ch] text-[14.5px] text-texto-2">{p.texto}</span>
              <span className="text-[14.5px] font-bold">{respostas[p.id]?.sim ? "Sim" : "Não"}</span>
            </li>
          ))}
        </ul>
      </Tela>
    );
  }

  const p = perguntas[indice];
  const r = respostas[p.id];
  const precisaQualificador = Boolean(p.qualificador) && r?.sim === true && !r?.grau;

  return (
    <div>
      <p className="rotulo mb-3" aria-live="polite">
        Pergunta {indice + 1} de {perguntas.length}
      </p>
      {/* Total variável sem regredir: as condicionais já entraram na lista
          quando a consulta às bases disse que a base não respondeu. */}
      <div className="mb-6 flex h-1.5 gap-1" aria-hidden>
        {perguntas.map((_, i) => (
          <span key={i} className={`h-full flex-1 rounded ${i <= indice ? "bg-azul" : "bg-linha"}`} />
        ))}
      </div>

      <h2 className="mb-5 max-w-[30ch] text-[clamp(21px,3.6vw,28px)] font-black tracking-[-0.02em] text-azul">
        {p.texto}
      </h2>

      <div className="flex gap-3">
        <Escolha
          titulo="Sim"
          marcada={r?.sim === true}
          onEscolher={() => {
            onResponder(p.id, { sim: true });
            if (!p.qualificador) setTimeout(onAvancar, 180);
          }}
        />
        <Escolha
          titulo="Não"
          marcada={r?.sim === false}
          onEscolher={() => {
            onResponder(p.id, { sim: false });
            setTimeout(onAvancar, 180);
          }}
        />
      </div>

      {precisaQualificador && p.qualificador && (
        <fieldset className="mt-6 border-t border-linha pt-5">
          <legend className="mb-2 text-[17px] font-bold">{p.qualificador.pergunta}</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {p.qualificador.opcoes.map((o) => (
              <Escolha
                key={o.grau}
                titulo={o.rotulo}
                marcada={r?.grau === o.grau}
                onEscolher={() => {
                  onResponder(p.id, { sim: true, grau: o.grau });
                  setTimeout(onAvancar, 180);
                }}
                largura="cheia"
              />
            ))}
          </div>
          <p className="mt-2.5 text-[14px] text-texto-2">{p.qualificador.apoio}</p>
        </fieldset>
      )}

      {r?.sim === true && (
        <div className="mt-5">
          <Tarja tom="atencao">Vamos pedir um documento. Dá para enviar pelo celular.</Tarja>
        </div>
      )}

      {p.sensivel && (
        <p className="mt-5 text-[13.5px] text-texto-3">
          Esta resposta é protegida e vista apenas por quem analisa a sua inscrição.
        </p>
      )}

      {p.servico && (
        <p className="mt-2 max-w-[64ch] text-[14px] text-texto-2">
          Se o {p.servico} já acompanha sua família, ele pode informar isso direto no sistema e você não precisa
          levar documento.
        </p>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────── subcomponentes

/**
 * Uma seção do consentimento, com a lista nominal das bases e o que exatamente
 * é lido de cada uma.
 *
 * "Dados do CadÚnico" não cumpre o dever de informar quando o que se lê é renda
 * por pessoa: o termo tem de listar nominalmente cada base **e** a finalidade.
 * E cada base legal tem a sua caixa, porque consulta de saúde e deficiência não
 * se autoriza no mesmo clique de consulta de nome e data de nascimento.
 */
function BlocoDeConsentimento({
  titulo,
  base,
  bases,
  marcada,
  onMarcar,
  texto,
  aviso,
}: {
  titulo: string;
  base: string;
  bases: [string, string][];
  marcada: boolean;
  onMarcar: (v: boolean) => void;
  texto: string;
  aviso?: string;
}) {
  return (
    <div className="cartao overflow-hidden">
      <div className="border-b border-linha bg-azul-10 px-4 py-2.5">
        <p className="rotulo text-azul">{titulo}</p>
        <p className="mt-0.5 text-[12.5px] text-texto-2">{base}</p>
      </div>
      <ul className="divide-y divide-linha">
        {bases.map(([sistema, oQue]) => (
          <li key={sistema} className="flex flex-wrap gap-x-5 gap-y-0.5 px-4 py-2.5">
            <span className="min-w-[220px] text-[14.5px] font-bold">{sistema}</span>
            <span className="flex-1 text-[14px] text-texto-2">{oQue}</span>
          </li>
        ))}
      </ul>
      <label className="flex cursor-pointer items-start gap-3 border-t border-linha px-4 py-3.5">
        <input
          type="checkbox"
          checked={marcada}
          onChange={(e) => onMarcar(e.target.checked)}
          className="mt-0.5 size-6 shrink-0 accent-[#13335a]"
        />
        <span className="text-[15px]">{texto}</span>
      </label>
      {aviso && !marcada && (
        <p className="border-t border-linha bg-atencao-fundo px-4 py-2.5 text-[13.5px] text-texto-2">{aviso}</p>
      )}
    </div>
  );
}

function Trilha({ grupoAtual }: { grupoAtual: number }) {
  return (
    <nav aria-label="Etapas da inscrição">
      <ol className="flex flex-wrap gap-x-1 gap-y-2">
        {GRUPOS.map((g, i) => {
          const estado = i === grupoAtual ? "atual" : i < grupoAtual ? "feito" : "futuro";
          return (
            <li key={g.rotulo} className="flex items-center gap-2">
              <span
                aria-current={estado === "atual" ? "step" : undefined}
                className={`num flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                  estado === "atual"
                    ? "bg-azul text-white"
                    : estado === "feito"
                      ? "bg-ok text-white"
                      : "bg-white text-texto-3 ring-1 ring-linha-forte"
                }`}
              >
                {estado === "feito" ? "✓" : i + 1}
              </span>
              <span className={`text-[12.5px] ${estado === "atual" ? "font-bold text-azul" : "text-texto-3"}`}>
                {g.rotulo}
              </span>
              {i < GRUPOS.length - 1 && <span aria-hidden className="mx-1.5 h-px w-4 bg-linha-forte" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Salvar e sair devolve um código de retomada, não uma promessa vaga. */
function SalvarESair({ protocolo }: { protocolo: string }) {
  const [codigo, setCodigo] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setCodigo((protocolo.replace(/\D/g, "").slice(-6) || "000000").padStart(6, "0"))}
        className="min-h-[44px] text-[12.5px] font-bold text-azul underline underline-offset-2"
      >
        Salvar e sair
      </button>
      {codigo && (
        <span className="num rounded bg-ok-fundo px-2 py-1 text-[12.5px] font-bold text-ok">
          Código de retomada: {codigo}
        </span>
      )}
    </span>
  );
}

function Linha({
  rotulo,
  origem,
  onAlterar,
  children,
}: {
  rotulo: string;
  /** Linha vinda de base não tem `Alterar`: no último olhar, reforça que aquilo
   *  não é declaração da família. */
  origem?: "base";
  onAlterar?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3">
      <dt className="rotulo min-w-[150px] pt-1">{rotulo}</dt>
      <dd className="flex-1 text-[15px]">{children}</dd>
      <dd className="shrink-0">
        {origem === "base" ? (
          <span className="rounded bg-ok-fundo px-2 py-0.5 text-[11.5px] font-bold tracking-[0.04em] uppercase text-ok">
            ✓ confirmado
          </span>
        ) : (
          onAlterar && (
            <button
              type="button"
              onClick={onAlterar}
              className="min-h-[44px] text-[13px] font-bold text-azul underline underline-offset-2"
            >
              Alterar
            </button>
          )
        )}
      </dd>
    </div>
  );
}

function BotaoIcone({
  children,
  rotulo,
  onClick,
  desabilitado,
}: {
  children: React.ReactNode;
  rotulo: string;
  onClick: () => void;
  desabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      aria-label={rotulo}
      className="size-12 rounded border border-linha-forte bg-white text-[15px] text-azul transition hover:border-azul hover:bg-azul-10 disabled:opacity-30 disabled:hover:bg-white"
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────── documentos e vias de serviço

/**
 * Cópia dos documentos aceitos, para a tela de comprovação.
 *
 * Duplicada aqui de propósito: `lib/regua.ts` é a fonte, e o servidor devolve a
 * mesma lista no envio. Manter no cliente evita uma ida ao servidor só para
 * mostrar a lista antes de a inscrição existir.
 */
const DOCUMENTOS: Record<string, string[]> = {
  violencia_crianca: [
    "Medida protetiva de urgência em favor da criança",
    "Declaração do Conselho Tutelar",
    "Relatório do CREAS ou do serviço de acolhimento",
    "Registro de ocorrência dos últimos 12 meses",
  ],
  violencia_nucleo: [
    "Declaração do CREAS, do CRAS ou do Conselho Tutelar",
    "Medida protetiva de urgência",
    "Registro de ocorrência dos últimos 12 meses",
    "Relatório de serviço socioassistencial",
  ],
  substancias: ["Encaminhamento ou relatório do CAPS-AD", "Relatório do CRAS ou de serviço de saúde"],
  privacao_responsavel: ["Atestado de execução penal", "Alvará de soltura dos últimos 5 anos", "Declaração do sistema penitenciário"],
  privacao_outro_membro: ["Atestado de execução penal", "Alvará de soltura dos últimos 5 anos", "Declaração do sistema penitenciário"],
  crianca_doenca_grave: [
    "Laudo ou relatório médico com CID, assinado e com CRM",
    "Relatório de acompanhamento nutricional da rede de saúde",
  ],
  doenca_outro_membro: ["Laudo ou relatório médico com CID do familiar, assinado e com CRM"],
  responsavel_deficiencia: ["Laudo médico do responsável", "Concessão de benefício do INSS"],
  refugiado: ["Protocolo de solicitação de refúgio", "Documento de refugiado reconhecido pelo CONARE"],
  monoparental: ["Certidão de nascimento da criança"],
};

/** Via da trilha de atestação: o serviço lança, e a família não leva nada. */
const SERVICO: Record<string, string> = {
  violencia_crianca: "CREAS ou Conselho Tutelar",
  violencia_nucleo: "CREAS ou CRAS",
  substancias: "CAPS-AD",
  crianca_doenca_grave: "posto de saúde da família",
  doenca_outro_membro: "posto de saúde da família",
  responsavel_deficiencia: "posto de saúde da família",
};
