"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Criterio } from "@/lib/dados";

// ─────────────────────────────────────────────────────────────────── tipos

interface UnidadeEscolha {
  codigo: number;
  nome: string;
  bairro: string | null;
  rua: string | null;
  cre: number | null;
  tipo: string | null;
  vagas: number;
  procura: number;
  concorrencia: number;
  distanciaKm: number | null;
}

interface PosicaoNaFila {
  assento: string;
  unidade: { codigo: number; nome: string; bairro: string | null } | undefined;
  grupamento: string;
  horario: string;
  ordemPreferencia: number;
  capacidade: number;
  aFrente: number;
  concorrentes: number;
  alocado: boolean;
  faixa: { de: number; ate: number };
}

interface Resumo {
  protocolo: string;
  pontos: number;
  pontuacaoMaxima: number;
  desempates: number[];
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

interface Comprovante {
  pergId: number;
  texto: string;
  pontos: number;
  desempate: boolean;
  documento: string;
}

interface Resposta {
  inscricao: {
    protocolo: string;
    grupamento: string;
    horario: string;
    opcoes: number[];
    criterios: number[];
    bairro: string | null;
  };
  resumo: Resumo;
  comprovantes: Comprovante[];
}

interface ListaDeEspera {
  modo: string;
  padrao: string;
  justificativa: string;
}

interface PosicaoAoVivo {
  exibir: boolean;
  formato: string;
  larguraFaixaPct: number;
  exibirEmTodasAsOpcoes: boolean;
  janelaEstabilizacaoDias: number;
  textoDaMecanica: string;
}

interface Props {
  bairros: string[];
  criterios: Criterio[];
  pontuacaoMaxima: number;
  anoProcesso: number;
  maxOpcoes: number;
  listaDeEspera: ListaDeEspera;
  posicaoAoVivo: PosicaoAoVivo;
}

const CHAVE_LOCAL = "vaga-certa:inscricao";
const PASSOS = ["A criança", "Endereço", "Creches", "Critérios", "Conferência"] as const;

// ───────────────────────────────────────────────────────────────── auxiliares

/** Mesmo corte de 31 de março do motor, replicado para dar retorno imediato. */
function grupamentoDe(nascimento: string, ano: number): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(nascimento);
  if (!m) return null;
  const idade = ano - Number(m[1]) - (Number(m[2]) > 3 ? 1 : 0);
  if (idade === 0) return "Berçário";
  if (idade === 1) return "Maternal I";
  if (idade === 2) return "Maternal II";
  return null;
}

function plural(n: number, um: string, muitos: string) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? um : muitos}`;
}

const n = (v: number) => v.toLocaleString("pt-BR");

// ────────────────────────────────────────────────────────────── componente

export default function FormularioInscricao({
  bairros,
  criterios,
  pontuacaoMaxima,
  anoProcesso,
  maxOpcoes,
  listaDeEspera,
  posicaoAoVivo,
}: Props) {
  const [passo, setPasso] = useState(0);
  const [nascimento, setNascimento] = useState("");
  const [horario, setHorario] = useState<"Integral" | "Parcial" | "">("");
  const [bairro, setBairro] = useState("");
  const [escolhidas, setEscolhidas] = useState<number[]>([]);
  const [marcados, setMarcados] = useState<number[]>([]);
  const [opcaoMantida, setOpcaoMantida] = useState(1);
  const [busca, setBusca] = useState("");

  const [unidades, setUnidades] = useState<UnidadeEscolha[]>([]);
  const [carregandoUnidades, setCarregandoUnidades] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [resposta, setResposta] = useState<Resposta | null>(null);

  const grupamento = grupamentoDe(nascimento, anoProcesso);
  const pontos = useMemo(
    () => criterios.filter((c) => marcados.includes(c.pergId)).reduce((s, c) => s + c.pontos, 0),
    [criterios, marcados],
  );

  useEffect(() => {
    if (!grupamento || !horario) return;
    let vivo = true;
    setCarregandoUnidades(true);
    const q = new URLSearchParams({ grupamento, horario });
    if (bairro) q.set("bairro", bairro);
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
  }, [grupamento, horario, bairro]);

  // Aquece o motor enquanto a família escolhe as creches: sem isso, o primeiro
  // envio numa instância fria paga a decodificação da fila inteira mais a rodada
  // base. Dispara uma vez só, e sem abortar na troca de passo.
  const jaAqueceu = useRef(false);
  useEffect(() => {
    if (passo < 2 || jaAqueceu.current) return;
    jaAqueceu.current = true;
    fetch("/api/inscricao").catch(() => {
      // aquecimento é otimização: falhar aqui não impede o envio
    });
  }, [passo]);

  useEffect(() => {
    if (escolhidas.length > 0 && opcaoMantida > escolhidas.length) setOpcaoMantida(1);
  }, [escolhidas.length, opcaoMantida]);

  const porCodigo = useMemo(() => new Map(unidades.map((u) => [u.codigo, u])), [unidades]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = unidades.filter((u) => !escolhidas.includes(u.codigo));
    if (!termo) return base.slice(0, 40);
    return base
      .filter((u) => u.nome.toLowerCase().includes(termo) || (u.bairro ?? "").toLowerCase().includes(termo))
      .slice(0, 40);
  }, [unidades, escolhidas, busca]);

  const adiciona = (codigo: number) =>
    setEscolhidas((a) => (a.length >= maxOpcoes || a.includes(codigo) ? a : [...a, codigo]));
  const remove = (codigo: number) => setEscolhidas((a) => a.filter((c) => c !== codigo));
  const move = (i: number, delta: number) =>
    setEscolhidas((a) => {
      const j = i + delta;
      if (j < 0 || j >= a.length) return a;
      const copia = [...a];
      const tmp = copia[i];
      copia[i] = copia[j];
      copia[j] = tmp;
      return copia;
    });

  const enviar = useCallback(async () => {
    setEnviando(true);
    setErros([]);
    try {
      const r = await fetch("/api/inscricao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nascimento,
          bairro,
          horario,
          opcoes: escolhidas,
          criterios: marcados,
          opcaoMantida,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErros(d.erros ?? [d.erro ?? "Não foi possível enviar a inscrição."]);
        return;
      }
      setResposta(d);
      try {
        localStorage.setItem(
          CHAVE_LOCAL,
          JSON.stringify({
            nascimento,
            bairro,
            horario,
            opcoes: escolhidas,
            criterios: marcados,
            opcaoMantida,
            protocolo: d.inscricao.protocolo,
          }),
        );
      } catch {
        // navegador sem localStorage: o protocolo na tela ainda serve
      }
    } catch {
      setErros(["Falha de rede ao enviar a inscrição. Tente novamente."]);
    } finally {
      setEnviando(false);
    }
  }, [nascimento, bairro, horario, escolhidas, marcados, opcaoMantida]);

  const podeAvancar = [
    Boolean(grupamento) && Boolean(horario),
    true,
    escolhidas.length > 0,
    true,
    escolhidas.length > 0,
  ][passo];

  if (resposta) {
    return <Resultado resposta={resposta} porCodigo={porCodigo} onNova={() => setResposta(null)} />;
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-9">
      <p className="rotulo mb-2 text-azul-medio">Formulário de inscrição</p>
      <h1 className="mb-7 text-[clamp(24px,4vw,32px)] font-black tracking-[-0.025em] text-azul">
        Inscrição em creche · Processo 195/2025
      </h1>

      <Trilha passo={passo} />

      <div className="cartao mt-6 overflow-hidden">
        <p className="cartao-titulo">
          Etapa {passo + 1} de {PASSOS.length} — {PASSOS[passo]}
        </p>

        <div className="p-5 md:p-7">
          {/* ───────────────────────────── etapa 1 */}
          {passo === 0 && (
            <Secao apoio="O grupamento é calculado pela idade completada até 31 de março, como determina a Resolução. A família não escolhe: o sistema deriva da data de nascimento.">
              <label className="block max-w-sm">
                <span className="rotulo mb-1.5 block">Mês e ano de nascimento</span>
                <input
                  type="month"
                  value={nascimento}
                  max={`${anoProcesso}-12`}
                  min={`${anoProcesso - 4}-01`}
                  onChange={(e) => setNascimento(e.target.value)}
                  className="campo num"
                />
              </label>

              {nascimento && (
                <div className={`tarja mt-4 ${grupamento ? "" : "border-l-erro bg-erro-fundo"}`}>
                  {grupamento ? (
                    <p className="text-[15px]">
                      Grupamento: <strong className="text-azul">{grupamento}</strong>
                      <span className="ml-2 text-texto-3">— idade em 31/03/{anoProcesso}</span>
                    </p>
                  ) : (
                    <p className="text-[15px] text-erro">
                      Pela data informada, a criança não se enquadra em creche neste processo. A vaga de
                      creche atende até 3 anos incompletos em 31 de março.
                    </p>
                  )}
                </div>
              )}

              <fieldset className="mt-7">
                <legend className="rotulo mb-2">Horário pretendido</legend>
                <div className="grid gap-3 sm:grid-cols-2 sm:max-w-lg">
                  {(["Integral", "Parcial"] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHorario(h)}
                      aria-pressed={horario === h}
                      className={`rounded border-2 px-4 py-3.5 text-left transition ${
                        horario === h
                          ? "border-azul bg-azul text-white"
                          : "border-linha-forte bg-white hover:border-azul"
                      }`}
                    >
                      <span className="block text-[16px] font-bold">{h}</span>
                      <span className={`mt-0.5 block text-[13px] ${horario === h ? "text-azul-claro" : "text-texto-3"}`}>
                        {h === "Integral" ? "Dia inteiro, com refeições" : "Meio período"}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </Secao>
          )}

          {/* ───────────────────────────── etapa 2 */}
          {passo === 1 && (
            <Secao apoio="Serve para ordenar as creches por proximidade. Em 2025, 48% das opções escolhidas ficavam em bairro diferente do da família — e a taxa de matrícula caía junto.">
              <label className="block max-w-md">
                <span className="rotulo mb-1.5 block">Bairro de residência</span>
                <select value={bairro} onChange={(e) => setBairro(e.target.value)} className="campo">
                  <option value="">Prefiro não informar</option>
                  {bairros.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-3 max-w-[62ch] text-[14px] text-texto-3">
                A distância é calculada até o centro do bairro, não até a residência. A base de dados não
                guarda endereço completo, e este formulário também não solicita.
              </p>
            </Secao>
          )}

          {/* ───────────────────────────── etapa 3 */}
          {passo === 2 && (
            <Secao
              apoio={`Escolha até ${maxOpcoes} creches, na ordem que a família realmente prefere. Declarar a preferência verdadeira nunca reduz a chance de vaga.`}
            >
              {!grupamento || !horario ? (
                <p className="text-erro">Volte à primeira etapa: falta o nascimento ou o horário.</p>
              ) : (
                <>
                  <div className="cartao mb-6 overflow-hidden border-azul">
                    <div className="flex items-baseline justify-between bg-azul-10 px-4 py-2.5">
                      <p className="rotulo text-azul">Ordem de preferência</p>
                      <p className="num text-[13px] font-bold text-azul">
                        {escolhidas.length} / {maxOpcoes}
                      </p>
                    </div>
                    {escolhidas.length === 0 ? (
                      <p className="px-4 py-5 text-[14.5px] text-texto-3">
                        Nenhuma creche escolhida. Use a lista abaixo para adicionar.
                      </p>
                    ) : (
                      <ol className="divide-y divide-linha">
                        {escolhidas.map((codigo, i) => {
                          const u = porCodigo.get(codigo);
                          return (
                            <li key={codigo} className="flex items-center gap-3 px-3 py-3">
                              <span className="num flex size-8 shrink-0 items-center justify-center rounded bg-azul text-[14px] font-bold text-white">
                                {i + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-bold">{u?.nome ?? codigo}</span>
                                <span className="block text-[12.5px] text-texto-3">
                                  {u?.bairro}
                                  {u && u.distanciaKm !== null ? ` · ${dec(u.distanciaKm)} km` : ""}
                                  {u ? ` · ${plural(u.vagas, "vaga", "vagas")}` : ""}
                                </span>
                              </span>
                              <span className="flex shrink-0 gap-1">
                                <BotaoIcone rotulo={`Subir ${u?.nome ?? ""}`} onClick={() => move(i, -1)} desabilitado={i === 0}>
                                  ↑
                                </BotaoIcone>
                                <BotaoIcone
                                  rotulo={`Descer ${u?.nome ?? ""}`}
                                  onClick={() => move(i, 1)}
                                  desabilitado={i === escolhidas.length - 1}
                                >
                                  ↓
                                </BotaoIcone>
                                <BotaoIcone rotulo={`Remover ${u?.nome ?? ""}`} onClick={() => remove(codigo)}>
                                  ✕
                                </BotaoIcone>
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>

                  <div className="tarja mb-5 border-l-ok">
                    <p className="text-[14.5px] text-texto-2">
                      <strong className="text-texto">{posicaoAoVivo.textoDaMecanica}</strong> Se a 1ª não
                      der, a inscrição desce para a 2ª intacta — não há vantagem em rebaixar a creche que
                      vocês realmente querem.
                    </p>
                  </div>

                  <label className="block max-w-md">
                    <span className="rotulo mb-1.5 block">Buscar por nome ou bairro</span>
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Ex.: Caju, CM Ladeira"
                      className="campo"
                    />
                  </label>

                  <p className="rotulo mt-6 mb-2">
                    {carregandoUnidades
                      ? "Carregando creches…"
                      : `${n(unidades.length)} creches oferecem ${grupamento} · ${horario}`}
                  </p>

                  <ul className="cartao divide-y divide-linha overflow-hidden">
                    {filtradas.map((u) => (
                      <li key={u.codigo} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-bold">{u.nome}</span>
                          <span className="block text-[12.5px] text-texto-3">
                            {u.bairro}
                            {u.distanciaKm !== null ? ` · ${dec(u.distanciaKm)} km` : ""}
                            {u.cre ? ` · CRE ${u.cre}` : ""}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
                            <span className="num rounded bg-cinza px-1.5 py-0.5 font-medium text-texto-2">
                              {plural(u.vagas, "vaga", "vagas")}
                            </span>
                            <Concorrencia valor={u.concorrencia} />
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => adiciona(u.codigo)}
                          disabled={escolhidas.length >= maxOpcoes}
                          className="botao botao-secundario shrink-0 !min-h-0 !px-4 !py-2 !text-[12px] disabled:cursor-not-allowed disabled:border-linha disabled:text-texto-3"
                        >
                          Escolher
                        </button>
                      </li>
                    ))}
                    {!carregandoUnidades && filtradas.length === 0 && (
                      <li className="px-4 py-5 text-[14.5px] text-texto-3">
                        Nenhuma creche encontrada para essa busca.
                      </li>
                    )}
                  </ul>
                </>
              )}
            </Secao>
          )}

          {/* ───────────────────────────── etapa 4 */}
          {passo === 3 && (
            <Secao apoio="Marque o que se aplica à família. Só conta na classificação o que for comprovado com documento — na tela final você recebe a lista do que levar.">
              <div className="cartao mb-5 flex flex-wrap items-center justify-between gap-3 bg-azul-10 px-4 py-3">
                <span className="rotulo text-azul">Pontuação declarada</span>
                <span className="num text-[26px] font-black text-azul">
                  {pontos}
                  <span className="text-[15px] font-medium text-texto-2"> / {pontuacaoMaxima}</span>
                </span>
              </div>

              <ul className="cartao divide-y divide-linha overflow-hidden">
                {criterios.map((c) => {
                  const ativo = marcados.includes(c.pergId);
                  return (
                    <li key={c.pergId} className={ativo ? "bg-azul-10" : ""}>
                      <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={ativo}
                          onChange={() =>
                            setMarcados((a) => (ativo ? a.filter((p) => p !== c.pergId) : [...a, c.pergId]))
                          }
                          className="mt-0.5 size-5 shrink-0 accent-[#13335a]"
                        />
                        <span className="flex-1">
                          <span className="block text-[15px]">{c.texto}</span>
                          <span className="mt-1 inline-block rounded bg-cinza px-1.5 py-0.5 text-[11.5px] font-bold tracking-[0.04em] uppercase text-texto-2">
                            {c.desempate ? "Critério de desempate" : `${c.pontos} ${c.pontos === 1 ? "ponto" : "pontos"}`}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="tarja mt-5 border-l-atencao bg-atencao-fundo">
                <p className="rotulo mb-1 text-atencao">Atenção à comprovação</p>
                <p className="text-[14.5px] text-texto-2">
                  Em 2025, 68,2% das inscrições declararam ao menos um critério e apenas 6,2% chegaram à
                  classificação com pontuação acima de zero. Quem entra sem pontuação fica empatado com 93,8%
                  da fila, e a posição passa a ser decidida pelo sorteio. Leve os documentos da lista que
                  aparece no fim deste formulário.
                </p>
              </div>
            </Secao>
          )}

          {/* ───────────────────────────── etapa 5 */}
          {passo === 4 && (
            <Secao apoio="Revise os dados antes de enviar. É possível voltar e alterar qualquer resposta.">
              <dl className="cartao divide-y divide-linha overflow-hidden">
                <Item rotulo="Grupamento">{grupamento ?? "—"}</Item>
                <Item rotulo="Horário">{horario || "—"}</Item>
                <Item rotulo="Bairro">{bairro || "não informado"}</Item>
                <Item rotulo="Pontuação declarada">
                  <span className="num">
                    {pontos} de {pontuacaoMaxima}
                  </span>
                </Item>
                <Item rotulo="Creches escolhidas">
                  <ol className="space-y-1">
                    {escolhidas.map((c, i) => (
                      <li key={c} className="flex gap-2">
                        <span className="num font-bold text-azul">{i + 1}.</span>
                        <span>{porCodigo.get(c)?.nome ?? c}</span>
                      </li>
                    ))}
                  </ol>
                </Item>
              </dl>

              {escolhidas.length > 1 && (
                <div className="cartao mt-5 overflow-hidden">
                  <p className="cartao-titulo">Lista de espera</p>
                  <div className="p-4">
                    <p className="mb-3 max-w-[66ch] text-[14.5px] text-texto-2">
                      Se a criança for atendida numa opção que não é a que vocês mais querem, ela continua na
                      lista de espera de <strong className="text-texto">uma</strong> das opções. Vocês
                      escolhem qual — a matrícula é piso, não teto.
                    </p>
                    <label className="block max-w-lg">
                      <span className="rotulo mb-1.5 block">Manter na lista de espera de</span>
                      <select
                        value={opcaoMantida}
                        onChange={(e) => setOpcaoMantida(Number(e.target.value))}
                        className="campo"
                      >
                        {escolhidas.map((c, i) => (
                          <option key={c} value={i + 1}>
                            {i + 1}ª opção — {porCodigo.get(c)?.nome ?? c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="mt-2.5 text-[13px] text-texto-3">
                      Padrão: a 1ª opção. {listaDeEspera.justificativa}
                    </p>
                  </div>
                </div>
              )}

              {erros.length > 0 && (
                <div className="tarja mt-5 border-l-erro bg-erro-fundo" role="alert">
                  <p className="rotulo mb-1 text-erro">Não foi possível enviar</p>
                  <ul className="list-inside list-disc text-[14.5px]">
                    {erros.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={enviar}
                disabled={enviando || escolhidas.length === 0}
                className="botao botao-primario mt-6 w-full disabled:cursor-not-allowed disabled:border-linha-forte disabled:bg-linha-forte"
              >
                {enviando ? "Processando a classificação…" : "Enviar inscrição"}
              </button>
              <p className="mt-2.5 text-center text-[13px] text-texto-3">
                A classificação é executada na hora, sobre a fila real do processo de 2025.
              </p>
            </Secao>
          )}
        </div>

        {/* ───────────────────────────── navegação */}
        <div className="flex items-center justify-between gap-3 border-t border-linha bg-cinza px-5 py-4">
          <button
            type="button"
            onClick={() => setPasso((p) => Math.max(0, p - 1))}
            disabled={passo === 0}
            className="botao botao-secundario !min-h-0 !px-5 !py-2.5 !text-[12px] disabled:cursor-not-allowed disabled:border-linha disabled:text-texto-3"
          >
            Voltar
          </button>
          {passo < PASSOS.length - 1 && (
            <button
              type="button"
              onClick={() => setPasso((p) => Math.min(PASSOS.length - 1, p + 1))}
              disabled={!podeAvancar}
              className="botao botao-primario !min-h-0 !px-6 !py-2.5 !text-[12px] disabled:cursor-not-allowed disabled:border-linha-forte disabled:bg-linha-forte"
            >
              Continuar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const dec = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

// ────────────────────────────────────────────────────────── subcomponentes

function Trilha({ passo }: { passo: number }) {
  return (
    <nav aria-label="Etapas da inscrição">
      <ol className="flex flex-wrap gap-x-1 gap-y-2">
        {PASSOS.map((p, i) => {
          const estado = i === passo ? "atual" : i < passo ? "feito" : "futuro";
          return (
            <li key={p} className="flex items-center gap-2">
              <span
                className={`num flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                  estado === "atual"
                    ? "bg-azul text-white"
                    : estado === "feito"
                      ? "bg-ok text-white"
                      : "bg-white text-texto-3 ring-1 ring-linha-forte"
                }`}
                aria-current={estado === "atual" ? "step" : undefined}
              >
                {estado === "feito" ? "✓" : i + 1}
              </span>
              <span
                className={`text-[12.5px] ${estado === "atual" ? "font-bold text-azul" : "text-texto-3"}`}
              >
                {p}
              </span>
              {i < PASSOS.length - 1 && <span aria-hidden className="mx-1.5 h-px w-4 bg-linha-forte" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Secao({ apoio, children }: { apoio: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-6 max-w-[68ch] text-[15px] text-texto-2">{apoio}</p>
      {children}
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

/** Concorrência com cor funcional, não decorativa: orienta a escolha. */
function Concorrencia({ valor }: { valor: number }) {
  const alta = valor > 6;
  const media = valor > 3;
  const cor = alta
    ? "bg-erro-fundo text-erro"
    : media
      ? "bg-atencao-fundo text-atencao"
      : "bg-ok-fundo text-ok";
  return (
    <span className={`num rounded px-1.5 py-0.5 font-medium ${cor}`}>
      {dec(valor)} candidatos por vaga em 2025
    </span>
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
      className="size-10 rounded border border-linha-forte bg-white text-[14px] text-azul transition hover:border-azul hover:bg-azul-10 disabled:opacity-30 disabled:hover:bg-white"
    >
      {children}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────── resultado

function Resultado({
  resposta,
  porCodigo,
  onNova,
}: {
  resposta: Resposta;
  porCodigo: Map<number, UnidadeEscolha>;
  onNova: () => void;
}) {
  const { resumo, comprovantes } = resposta;
  const c = resumo.convite;

  return (
    <div className="mx-auto max-w-4xl px-5 py-9">
      <p className="rotulo mb-2 text-azul-medio">Inscrição registrada</p>
      <h1 className="mb-3 text-[clamp(24px,4.2vw,34px)] font-black tracking-[-0.025em] text-azul">
        {c ? "Vaga reservada para a sua criança." : "Inscrição na fila de espera."}
      </h1>
      <p className="mb-7 max-w-[66ch] text-[16px] text-texto-2">{resumo.explicacao}</p>

      {/* ── comprovante ── */}
      <div className="cartao mb-6 overflow-hidden">
        <p className="cartao-titulo">Comprovante de inscrição</p>
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
                Empatada com 93,8% da fila. O desempate é o sorteio de semente publicada.
              </span>
            )}
          </Item>
          <Item rotulo="Identificador da rodada">
            <span className="num font-mono text-[13px]">{resumo.rodadaId}</span>
          </Item>
          <Item rotulo="Fila do processo">
            <span className="num">{n(resumo.totalCandidatos)}</span> crianças classificadas
          </Item>
          <Item rotulo="Classificação incremental">
            <span className="num">
              {resumo.propostasAvaliadas} {resumo.propostasAvaliadas === 1 ? "proposta" : "propostas"} avaliadas
              em {dec(resumo.duracaoMs)} ms
            </span>
            {resumo.remanejadas > 0 && (
              <span className="mt-1 block text-[13.5px] text-texto-3">
                {resumo.remanejadas} {resumo.remanejadas === 1 ? "criança foi remanejada" : "crianças foram remanejadas"}{" "}
                para a opção seguinte delas. Nenhuma perdeu a vaga, e nenhuma à frente na fila foi
                ultrapassada.
              </span>
            )}
          </Item>
        </dl>
      </div>

      {/* ── convite ── */}
      {c && (
        <div className="cartao mb-6 overflow-hidden border-ok">
          <p className="cartao-titulo bg-ok">Convite emitido · {c.ordemPreferencia}ª opção</p>
          <div className="p-4">
            <p className="text-[19px] font-bold text-azul">{c.unidade?.nome ?? c.assento}</p>
            <p className="mt-1 text-[14.5px] text-texto-2">
              {c.unidade?.bairro} · {c.grupamento} · {c.horario} · {plural(c.capacidade, "vaga", "vagas")} no
              assento
            </p>
            <p className="mt-3 border-t border-linha pt-3 text-[14.5px] text-texto-2">
              Um convite, não cinco. As outras opções não ficam com assento reservado neste nome.
            </p>
          </div>
        </div>
      )}

      {/* ── fila de melhoria ── */}
      {resumo.filaDeMelhoria.length > 0 && (
        <section className="mb-6">
          <h2 className="secao-titulo mb-2">Fila de melhoria</h2>
          <p className="mb-3 max-w-[66ch] text-[14.5px] text-texto-2">
            {c
              ? `A ${resumo.opcaoMantida}ª opção continua valendo. Se abrir vaga nela, o remanejamento é automático e a vaga atual entra em cascata para a próxima criança. A matrícula é piso, não teto.`
              : "Esta é a vaga em disputa. A posição é recalculada a cada vaga liberada na rede."}
            {" "}A posição vai como faixa, e não como número cravado: ela se move enquanto outras famílias
            ainda estão escolhendo.
          </p>
          <ul className="cartao divide-y divide-linha overflow-hidden">
            {resumo.filaDeMelhoria.map((p) => (
              <li key={p.assento} className="flex items-baseline gap-3 px-4 py-3">
                <span className="num flex size-8 shrink-0 items-center justify-center rounded bg-cinza text-[14px] font-bold text-azul">
                  {p.ordemPreferencia}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">
                    {p.unidade?.nome ?? porCodigo.get(Number(p.assento.split("|")[0]))?.nome ?? p.assento}
                  </span>
                  <span className="num block text-[12.5px] text-texto-3">
                    posição estimada entre {n(p.faixa.de)} e {n(p.faixa.ate)} ·{" "}
                    {plural(p.capacidade, "vaga", "vagas")} · {n(p.concorrentes)} disputando
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── comprovantes ── */}
      {comprovantes.length > 0 && (
        <section className="mb-7">
          <h2 className="secao-titulo mb-2">Documentos a apresentar</h2>
          <p className="mb-3 max-w-[66ch] text-[14.5px] text-texto-2">
            Sem estes documentos, a pontuação declarada não entra na classificação. É a etapa em que a maior
            parte da pontuação declarada se perdeu em 2025.
          </p>
          <ul className="cartao divide-y divide-linha overflow-hidden">
            {comprovantes.map((doc) => (
              <li key={doc.pergId} className="px-4 py-3.5">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-azul px-1.5 py-0.5 text-[11px] font-bold tracking-[0.04em] uppercase text-white">
                    {doc.desempate ? "Desempate" : `${doc.pontos} ${doc.pontos === 1 ? "ponto" : "pontos"}`}
                  </span>
                  <span className="text-[14.5px] font-bold">{doc.texto}</span>
                </div>
                <p className="text-[14px] text-texto-2">{doc.documento}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/acompanhar" className="botao botao-primario">
          Acompanhar inscrição
        </Link>
        <button type="button" onClick={onNova} className="botao botao-secundario">
          Nova simulação
        </button>
      </div>
    </div>
  );
}
