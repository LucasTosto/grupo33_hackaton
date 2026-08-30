"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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

interface Props {
  bairros: string[];
  criterios: Criterio[];
  pontuacaoMaxima: number;
  anoProcesso: number;
  maxOpcoes: number;
}

const CHAVE_LOCAL = "vaga-certa:inscricao";
const PASSOS = ["A criança", "Onde vocês moram", "As creches", "Critérios", "Conferir"] as const;

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

// ────────────────────────────────────────────────────────────── componente

export default function FormularioInscricao({
  bairros,
  criterios,
  pontuacaoMaxima,
  anoProcesso,
  maxOpcoes,
}: Props) {
  const [passo, setPasso] = useState(0);
  const [nascimento, setNascimento] = useState("");
  const [horario, setHorario] = useState<"Integral" | "Parcial" | "">("");
  const [bairro, setBairro] = useState("");
  const [escolhidas, setEscolhidas] = useState<number[]>([]);
  const [marcados, setMarcados] = useState<number[]>([]);
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

  // Busca as creches quando grupamento, horário ou bairro mudam.
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
        // Remove opções que deixaram de existir para o novo assento.
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
        body: JSON.stringify({ nascimento, bairro, horario, opcoes: escolhidas, criterios: marcados }),
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
  }, [nascimento, bairro, horario, escolhidas, marcados]);

  const podeAvancar = [
    Boolean(grupamento) && Boolean(horario),
    true, // bairro é opcional: sem ele, a lista não ordena por distância
    escolhidas.length > 0,
    true, // nenhum critério é obrigatório
    escolhidas.length > 0,
  ][passo];

  if (resposta) {
    return <Resultado resposta={resposta} porCodigo={porCodigo} onNova={() => setResposta(null)} />;
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Trilha passo={passo} />

      {passo === 0 && (
        <Secao
          titulo="A criança"
          apoio="O grupamento é calculado pela idade completada até 31 de março, como manda a Resolução. Você não escolhe: o sistema deriva."
        >
          <label className="block">
            <span className="rotulo">Mês e ano de nascimento</span>
            <input
              type="month"
              value={nascimento}
              max={`${anoProcesso}-12`}
              min={`${anoProcesso - 4}-01`}
              onChange={(e) => setNascimento(e.target.value)}
              className="mt-2 w-full border border-rule bg-white px-4 py-3 font-mono text-[15px]"
            />
          </label>

          {nascimento && (
            <div className="mt-4 border-l-[3px] border-ink bg-white px-4 py-3">
              {grupamento ? (
                <p className="text-[15px]">
                  Grupamento: <strong className="font-display">{grupamento}</strong>
                  <span className="ml-2 text-ink-3">— idade em 31/03/{anoProcesso}</span>
                </p>
              ) : (
                <p className="text-[15px] text-break">
                  Pela data informada, a criança não se enquadra em creche neste processo. A vaga de creche
                  atende até 3 anos incompletos em 31 de março.
                </p>
              )}
            </div>
          )}

          <fieldset className="mt-7">
            <legend className="rotulo mb-2">Horário</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["Integral", "Parcial"] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorario(h)}
                  aria-pressed={horario === h}
                  className={`border px-4 py-4 text-left transition ${
                    horario === h ? "border-ink bg-ink text-surface" : "border-rule bg-white hover:border-ink-3"
                  }`}
                >
                  <span className="font-display text-[16px] font-semibold">{h}</span>
                  <span className={`mt-1 block text-[13px] ${horario === h ? "text-paper/80" : "text-ink-3"}`}>
                    {h === "Integral" ? "Dia inteiro, com refeições" : "Meio período"}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        </Secao>
      )}

      {passo === 1 && (
        <Secao
          titulo="Onde vocês moram"
          apoio="Serve para ordenar as creches por proximidade. Em 2025, 48% das opções escolhidas ficavam em bairro diferente do da família — e a taxa de matrícula caía junto."
        >
          <label className="block">
            <span className="rotulo">Bairro</span>
            <select
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className="mt-2 w-full border border-rule bg-white px-4 py-3 text-[15px]"
            >
              <option value="">Prefiro não informar</option>
              {bairros.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-[13.5px] text-ink-2">
            A distância é calculada até o centro do bairro, não até sua casa. A base de dados não guarda
            endereço completo, e este protótipo também não pede.
          </p>
        </Secao>
      )}

      {passo === 2 && (
        <Secao
          titulo="As creches"
          apoio={`Escolha até ${maxOpcoes}, na ordem que você realmente prefere. Ordenar pela preferência verdadeira nunca reduz sua chance — o motor é à prova de estratégia.`}
        >
          {!grupamento || !horario ? (
            <p className="text-break">Volte ao primeiro passo: falta o nascimento ou o horário.</p>
          ) : (
            <>
              <div className="mb-5 border border-rule bg-white">
                <div className="border-b border-rule px-4 py-3">
                  <p className="rotulo">
                    Sua ordem de preferência · {escolhidas.length} de {maxOpcoes}
                  </p>
                </div>
                {escolhidas.length === 0 ? (
                  <p className="px-4 py-5 text-[14px] text-ink-3">
                    Nenhuma creche escolhida ainda. Use a lista abaixo.
                  </p>
                ) : (
                  <ol className="divide-y divide-rule">
                    {escolhidas.map((codigo, i) => {
                      const u = porCodigo.get(codigo);
                      return (
                        <li key={codigo} className="flex items-center gap-3 px-4 py-3">
                          <span className="num flex size-7 shrink-0 items-center justify-center bg-ink text-[13px] font-semibold text-surface">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-display text-[15px] font-semibold">
                              {u?.nome ?? codigo}
                            </span>
                            <span className="rotulo">
                              {u?.bairro}
                              {u && u.distanciaKm !== null ? ` · ${u.distanciaKm} km` : ""}
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

              <label className="block">
                <span className="rotulo">Buscar por nome ou bairro</span>
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Ex.: Caju, CM Ladeira"
                  className="mt-2 w-full border border-rule bg-white px-4 py-3 text-[15px]"
                />
              </label>

              <p className="rotulo mt-5 mb-2">
                {carregandoUnidades
                  ? "Carregando creches…"
                  : `${plural(unidades.length, "creche oferece", "creches oferecem")} ${grupamento} · ${horario}`}
              </p>

              <ul className="divide-y divide-rule border border-rule bg-white">
                {filtradas.map((u) => (
                  <li key={u.codigo} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[15px] font-semibold">{u.nome}</span>
                      <span className="rotulo">
                        {u.bairro}
                        {u.distanciaKm !== null ? ` · ${u.distanciaKm} km` : ""}
                        {u.cre ? ` · CRE ${u.cre}` : ""}
                      </span>
                      <span className="mt-1 block text-[13px] text-ink-2">
                        {plural(u.vagas, "vaga", "vagas")} ·{" "}
                        <span
                          className={
                            u.concorrencia > 6 ? "text-break" : u.concorrencia > 3 ? "text-signal" : "text-match"
                          }
                        >
                          {u.concorrencia} candidatos por vaga em 2025
                        </span>
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => adiciona(u.codigo)}
                      disabled={escolhidas.length >= maxOpcoes}
                      className="shrink-0 border border-ink px-4 py-2 font-mono text-[12px] tracking-wide transition hover:bg-ink hover:text-surface disabled:cursor-not-allowed disabled:border-rule disabled:text-ink-3"
                    >
                      escolher
                    </button>
                  </li>
                ))}
                {!carregandoUnidades && filtradas.length === 0 && (
                  <li className="px-4 py-5 text-[14px] text-ink-3">Nenhuma creche encontrada para essa busca.</li>
                )}
              </ul>
            </>
          )}
        </Secao>
      )}

      {passo === 3 && (
        <Secao
          titulo="Critérios de prioridade"
          apoio="Marque o que se aplica à sua família. Só conta na classificação o que for comprovado com documento — na tela seguinte você recebe a lista do que levar."
        >
          <div className="mb-5 flex items-baseline justify-between border border-rule bg-white px-4 py-3">
            <span className="rotulo">Pontuação declarada</span>
            <span className="num font-display text-[26px] font-extrabold">
              {pontos}
              <span className="text-[15px] font-normal text-ink-3"> / {pontuacaoMaxima}</span>
            </span>
          </div>

          <ul className="divide-y divide-rule border border-rule bg-white">
            {criterios.map((c) => {
              const ativo = marcados.includes(c.pergId);
              return (
                <li key={c.pergId}>
                  <label className="flex cursor-pointer items-start gap-3 px-4 py-4 hover:bg-paper/40">
                    <input
                      type="checkbox"
                      checked={ativo}
                      onChange={() =>
                        setMarcados((a) => (ativo ? a.filter((p) => p !== c.pergId) : [...a, c.pergId]))
                      }
                      className="mt-1 size-5 shrink-0"
                    />
                    <span className="flex-1">
                      <span className="block text-[15px]">{c.texto}</span>
                      <span className="rotulo mt-1 block">
                        {c.desempate
                          ? "critério de desempate · 0 ponto"
                          : `${c.pontos} ${c.pontos === 1 ? "ponto" : "pontos"}`}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 border-l-[3px] border-signal bg-white px-4 py-3">
            <p className="rotulo mb-1">Por que insistimos em comprovação</p>
            <p className="text-[14px] text-ink-2">
              Em 2025, 68,2% das inscrições declararam ao menos um critério e apenas 6,2% chegaram à
              classificação com pontuação acima de zero. A diferença não é fraude: é gente que não conseguiu
              comparecer para comprovar. Quem não comprova entra empatado em zero com 93,8% da fila.
            </p>
          </div>
        </Secao>
      )}

      {passo === 4 && (
        <Secao titulo="Conferir e enviar" apoio="Revise antes de enviar. Você pode voltar e mudar qualquer resposta.">
          <dl className="divide-y divide-rule border border-rule bg-white">
            <Linha rotulo="Grupamento">{grupamento ?? "—"}</Linha>
            <Linha rotulo="Horário">{horario || "—"}</Linha>
            <Linha rotulo="Bairro">{bairro || "não informado"}</Linha>
            <Linha rotulo="Pontuação declarada">
              {pontos} de {pontuacaoMaxima}
            </Linha>
            <Linha rotulo="Creches escolhidas">
              <ol className="list-inside list-decimal">
                {escolhidas.map((c) => (
                  <li key={c}>{porCodigo.get(c)?.nome ?? c}</li>
                ))}
              </ol>
            </Linha>
          </dl>

          {erros.length > 0 && (
            <div className="mt-5 border-l-[3px] border-break bg-break-soft px-4 py-3" role="alert">
              <p className="rotulo mb-1 text-break">Não foi possível enviar</p>
              <ul className="list-inside list-disc text-[14px]">
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
            className="mt-6 w-full bg-ink px-6 py-4 font-display text-[16px] font-semibold text-surface transition hover:bg-ink-2 disabled:cursor-not-allowed disabled:bg-rule"
          >
            {enviando ? "Rodando a classificação…" : "Enviar inscrição"}
          </button>
          <p className="mt-3 text-center text-[13px] text-ink-3">
            A rodada é executada na hora, sobre a fila real de 2025.
          </p>
        </Secao>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPasso((p) => Math.max(0, p - 1))}
          disabled={passo === 0}
          className="border border-rule px-5 py-3 font-mono text-[12px] tracking-wide disabled:opacity-40"
        >
          ← voltar
        </button>
        {passo < PASSOS.length - 1 && (
          <button
            type="button"
            onClick={() => setPasso((p) => Math.min(PASSOS.length - 1, p + 1))}
            disabled={!podeAvancar}
            className="border border-ink bg-ink px-6 py-3 font-mono text-[12px] tracking-wide text-surface disabled:cursor-not-allowed disabled:border-rule disabled:bg-rule"
          >
            continuar →
          </button>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────── subcomponentes

function Trilha({ passo }: { passo: number }) {
  return (
    <ol className="mb-9 flex flex-wrap gap-x-4 gap-y-1">
      {PASSOS.map((p, i) => (
        <li key={p} className="flex items-center gap-2">
          <span
            className={`num flex size-6 items-center justify-center text-[11px] font-semibold ${
              i === passo ? "bg-ink text-surface" : i < passo ? "bg-match text-surface" : "bg-rule text-ink-2"
            }`}
          >
            {i < passo ? "✓" : i + 1}
          </span>
          <span className={`text-[12.5px] ${i === passo ? "font-semibold" : "text-ink-3"}`}>{p}</span>
        </li>
      ))}
    </ol>
  );
}

function Secao({ titulo, apoio, children }: { titulo: string; apoio: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="subtitulo mb-2 text-[30px]">{titulo}</h1>
      <p className="mb-7 max-w-[58ch] text-[15.5px] text-ink-2">{apoio}</p>
      {children}
    </section>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3">
      <dt className="rotulo min-w-[150px] pt-1">{rotulo}</dt>
      <dd className="flex-1 text-[15px]">{children}</dd>
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
      className="size-9 border border-rule text-[13px] transition hover:border-ink disabled:opacity-30"
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
    <div className="mx-auto max-w-3xl px-5 py-10">
      <p className="eyebrow mb-3">Inscrição registrada</p>
      <h1 className="titulo mb-2 text-[clamp(28px,6vw,44px)]">
        {c ? "Você tem uma vaga." : "Você está na fila."}
      </h1>
      <p className="mb-8 max-w-[60ch] text-[16.5px] text-ink-2">{resumo.explicacao}</p>

      <div className="mb-8 border border-rule bg-white">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-5 py-4">
          <span className="rotulo">Protocolo</span>
          <span className="num font-display text-[22px] font-extrabold tracking-tight">{resumo.protocolo}</span>
        </div>
        <dl className="divide-y divide-rule">
          <Linha rotulo="Pontuação">
            {resumo.pontos} de {resumo.pontuacaoMaxima}
            {resumo.empatadaEmZero && (
              <span className="ml-2 text-[13.5px] text-ink-3">
                — empatada com 93,8% da fila; o desempate é o sorteio publicado
              </span>
            )}
          </Linha>
          <Linha rotulo="Rodada">
            <span className="num text-[13.5px]">{resumo.rodadaId}</span>
          </Linha>
          <Linha rotulo="Concorrentes">
            {resumo.totalCandidatos.toLocaleString("pt-BR")} crianças classificadas em {resumo.duracaoMs} ms
          </Linha>
        </dl>
      </div>

      {c && (
        <div className="mb-8 border-l-[3px] border-match bg-match-soft px-5 py-4">
          <p className="rotulo mb-1">Convite · {c.ordemPreferencia}ª opção</p>
          <p className="font-display text-[21px] font-bold">{c.unidade?.nome ?? c.assento}</p>
          <p className="mt-1 text-[14.5px] text-ink-2">
            {c.unidade?.bairro} · {c.grupamento} · {c.horario} · {plural(c.capacidade, "vaga", "vagas")} no assento
          </p>
          <p className="mt-3 text-[14px]">
            Um convite, não cinco. As outras opções não ficam com assento reservado no seu nome.
          </p>
        </div>
      )}

      {resumo.filaDeMelhoria.length > 0 && (
        <section className="mb-8">
          <h2 className="subtitulo mb-2 text-[20px]">Fila de melhoria</h2>
          <p className="mb-3 max-w-[60ch] text-[14.5px] text-ink-2">
            {c
              ? "Suas opções melhores continuam valendo. Se abrir vaga em alguma delas, o remanejamento é automático e a vaga atual entra em cascata para a próxima criança. A matrícula é piso, não teto."
              : "Estas são as vagas que você disputa. A posição é recalculada a cada vaga liberada na rede."}
          </p>
          <ul className="divide-y divide-rule border border-rule bg-white">
            {resumo.filaDeMelhoria.map((p) => (
              <li key={p.assento} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                <span className="num flex size-7 shrink-0 items-center justify-center bg-signal-soft text-[13px] font-semibold">
                  {p.ordemPreferencia}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] font-semibold">
                    {p.unidade?.nome ?? porCodigo.get(Number(p.assento.split("|")[0]))?.nome ?? p.assento}
                  </span>
                  <span className="rotulo">
                    {plural(p.capacidade, "vaga", "vagas")} · {p.concorrentes.toLocaleString("pt-BR")} disputando ·{" "}
                    {p.aFrente.toLocaleString("pt-BR")} com prioridade maior
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {comprovantes.length > 0 && (
        <section className="mb-8">
          <h2 className="subtitulo mb-2 text-[20px]">O que levar para comprovar</h2>
          <p className="mb-3 max-w-[60ch] text-[14.5px] text-ink-2">
            Sem estes documentos, a pontuação declarada não entra na classificação. É aqui que a rede perdeu
            62 pontos percentuais em 2025.
          </p>
          <ul className="divide-y divide-rule border border-rule bg-white">
            {comprovantes.map((doc) => (
              <li key={doc.pergId} className="px-4 py-4">
                <p className="rotulo mb-1">
                  {doc.desempate ? "desempate" : `${doc.pontos} ${doc.pontos === 1 ? "ponto" : "pontos"}`}
                </p>
                <p className="mb-1 text-[14.5px] font-semibold">{doc.texto}</p>
                <p className="text-[14px] text-ink-2">{doc.documento}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/acompanhar"
          className="border border-ink bg-ink px-6 py-3 font-mono text-[12px] tracking-wide text-surface"
        >
          acompanhar inscrição
        </Link>
        <button
          type="button"
          onClick={onNova}
          className="border border-rule px-6 py-3 font-mono text-[12px] tracking-wide"
        >
          fazer outra simulação
        </button>
      </div>
    </div>
  );
}
