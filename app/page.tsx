import Link from "next/link";

import { backtest, catalogo, fatos } from "@/lib/dados";

const n = (v: number) => v.toLocaleString("pt-BR");

export default function Pagina() {
  const maiorCriterio = [...catalogo.criterios].sort((a, b) => b.pontos - a.pontos)[0];

  return (
    <div className="mx-auto max-w-4xl px-5">
      {/* ───────────────────────────────────────────────────── hero */}
      <header className="border-b border-rule py-14 sm:py-20">
        <p className="eyebrow mb-3">Claude Impact Lab Rio · Eixos 2 e 3</p>
        <h1 className="titulo mb-6 text-[clamp(32px,7vw,58px)]">
          O sistema classifica <span className="text-break">escolhas</span>, não crianças.
        </h1>
        <p className="mb-4 max-w-[56ch] text-[18.5px] text-ink-2">
          Uma inscrição gera até cinco filas paralelas para a mesma criança. Ela recebe cinco ofertas, ocupa
          cinco assentos, aceita um — e os outros quatro ficam congelados até serem repassados.
        </p>
        <p className="mb-9 max-w-[56ch] text-[18.5px] text-ink-2">
          Este site troca a classificação por opção pela classificação por criança. A ordem de prioridade da
          Resolução é preservada bit a bit. O que muda é a sequência das ofertas.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/inscricao"
            className="bg-ink px-7 py-4 font-display text-[16px] font-semibold text-surface transition hover:bg-ink-2"
          >
            Fazer a inscrição
          </Link>
          <Link
            href="/painel"
            className="border border-ink px-7 py-4 font-display text-[16px] font-semibold transition hover:bg-ink hover:text-surface"
          >
            Ver o painel da rede
          </Link>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────── o achado */}
      <section className="py-14">
        <div className="flex gap-4 border-t-2 border-ink pt-4">
          <span className="num shrink-0 pt-1 text-[12px] font-semibold tracking-wider text-signal">01</span>
          <div className="w-full">
            <h2 className="subtitulo mb-5 text-[clamp(23px,4.4vw,32px)]">O que a base de 2025 mostra</h2>

            <dl className="mb-7 grid gap-px border border-rule bg-rule sm:grid-cols-3">
              <Bloco
                rotulo="Fila do processo"
                valor={n(fatos.criancas)}
                apoio={`crianças em ${n(fatos.inscricoes)} inscrições, disputando ${n(backtest.rodada.vagas)} vagas`}
              />
              <Bloco
                rotulo="Empatadas em zero"
                valor={`${fatos.empatadosEmZeroPct}%`}
                apoio={`${n(fatos.empatadosEmZero)} inscrições com a mesma nota — a régua praticamente não classifica`}
              />
              <Bloco
                rotulo="Assentos travados"
                valor={n(backtest.historico.assentosTravados)}
                apoio={`vagas presas por crianças que receberam mais de uma oferta ao mesmo tempo`}
              />
            </dl>

            <div className="mb-6 border-l-[3px] border-break bg-surface px-5 py-4">
              <p className="rotulo mb-2">O achado que reordena as prioridades</p>
              <p className="mb-3 text-[15.5px]">
                <strong>{fatos.declararamCriterioPct}%</strong> das inscrições declararam ao menos um critério
                de prioridade. Apenas <strong>{fatos.comprovaramCriterioPct}%</strong> chegaram à
                classificação com pontuação acima de zero. O campo de confirmação não marca critério a
                critério: marca se a família compareceu para comprovar. Quem não vai perde tudo de uma vez.
              </p>
              <p className="text-[15.5px]">
                Resultado: <strong>{n(fatos.empatadosEmZero)} inscrições entram na fila empatadas em zero
                ponto.</strong> Quem ordena a fila, na prática, é o critério de desempate — e é por isso que
                este site publica a semente do sorteio.
              </p>
            </div>

            <p className="max-w-[62ch] text-[15.5px] text-ink-2">
              O maior critério da régua de {catalogo.ano} vale {maiorCriterio.pontos} dos{" "}
              {catalogo.pontuacaoMaxima} pontos possíveis: <em>{maiorCriterio.texto}</em> Ele é verificável no
              Data Lake da Prefeitura sem a família precisar levar papel — e é o primeiro lugar onde a lacuna
              entre declarar e comprovar pode ser fechada.
            </p>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────── backtest */}
      <section className="pb-14">
        <div className="flex gap-4 border-t-2 border-ink pt-4">
          <span className="num shrink-0 pt-1 text-[12px] font-semibold tracking-wider text-signal">02</span>
          <div className="w-full">
            <h2 className="subtitulo mb-3 text-[clamp(23px,4.4vw,32px)]">
              O motor rodado sobre o processo real
            </h2>
            <p className="mb-6 max-w-[62ch] text-[15.5px] text-ink-2">
              Mesma fila, mesma capacidade. A capacidade de cada assento é exatamente quantas crianças a rede
              colocou nele em {backtest.processo.ano}, então o motor não pode ganhar inventando vaga que não
              existia.
            </p>

            <div className="mb-6 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[14.5px]">
                <thead>
                  <tr>
                    <th className="rotulo border-b border-ink py-2 pr-3 text-left font-medium">Métrica</th>
                    <th className="rotulo border-b border-ink py-2 pr-3 text-right font-medium">
                      {backtest.processo.ano} real
                    </th>
                    <th className="rotulo border-b border-ink py-2 text-right font-medium">Motor</th>
                  </tr>
                </thead>
                <tbody>
                  <Comparacao
                    rotulo="Crianças ocupando mais de um assento"
                    real={n(backtest.historico.criancasComMaisDeUmAssento)}
                    motor="0"
                    destaque
                  />
                  <Comparacao
                    rotulo="Assentos travados por oferta múltipla"
                    real={n(backtest.historico.assentosTravados)}
                    motor="0"
                    destaque
                  />
                  <Comparacao
                    rotulo="Reservas que não viraram matrícula"
                    real={n(backtest.historico.reservasSemMatricula)}
                    motor="0"
                    destaque
                  />
                  <Comparacao
                    rotulo="Atendidas na 1ª opção"
                    real={`${backtest.historico.primeiraOpcaoPct}%`}
                    motor={`${backtest.motor.primeiraOpcaoPct}%`}
                    destaque
                  />
                  <Comparacao
                    rotulo="Vagas preenchidas"
                    real={n(backtest.historico.vagasPreenchidas)}
                    motor={n(backtest.motor.vagasPreenchidas)}
                  />
                  <Comparacao
                    rotulo="Violações de estabilidade"
                    real="não verificável"
                    motor={String(backtest.rodada.violacoes)}
                  />
                </tbody>
              </table>
            </div>

            <p className="mb-4 max-w-[62ch] text-[15.5px]">
              O ganho não vem de acelerar o convite. Vem de nunca emitir os quatro convites que não podem ser
              aceitos. <strong>{n(backtest.ganhos.assentosLiberadosDeImediato)} assentos</strong> deixam de
              ficar congelados, e o atendimento na primeira opção sobe{" "}
              <strong>{backtest.ganhos.pontosDeAumentoNaPrimeiraOpcao} pontos percentuais</strong>.
            </p>
            <p className="max-w-[62ch] text-[14.5px] text-ink-3">
              A rodada inteira — {n(backtest.rodada.criancas)} crianças, {n(backtest.rodada.assentos)} assentos,{" "}
              {n(backtest.rodada.propostas)} propostas avaliadas — leva {backtest.rodada.duracaoMs} ms, e a
              verificação de que ninguém foi ultrapassado leva outros {backtest.rodada.verificacaoMs} ms. A
              dificuldade desta solução não é computacional: é integração, auditabilidade e operação.
            </p>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────── garantias */}
      <section className="pb-16">
        <div className="flex gap-4 border-t-2 border-ink pt-4">
          <span className="num shrink-0 pt-1 text-[12px] font-semibold tracking-wider text-signal">03</span>
          <div className="w-full">
            <h2 className="subtitulo mb-5 text-[clamp(23px,4.4vw,32px)]">O que o motor garante</h2>
            <ul className="grid gap-px border border-rule bg-rule sm:grid-cols-2">
              <Garantia titulo="Um convite por criança">
                A unidade de alocação é a criança, não a inscrição — mesmo quando ela se inscreveu em mais de
                um polo do mesmo processo.
              </Garantia>
              <Garantia titulo="Ninguém à sua frente foi ultrapassado">
                Não existe par criança–assento em que a criança prefira aquele assento e ele esteja ocupado
                por alguém de prioridade menor. A propriedade é verificada a cada rodada, não prometida.
              </Garantia>
              <Garantia titulo="Dizer a verdade não custa vaga">
                Declarar a preferência real nunca prejudica a família. Isso ataca de frente a mãe que escolhe
                unidade por cálculo de chance, e não por onde quer a vaga.
              </Garantia>
              <Garantia titulo="Auditável por terceiros">
                Semente publicada antes da rodada, catálogo de pontuação versionado e hash das entradas: um
                auditor refaz a classificação inteira e chega ao mesmo resultado.
              </Garantia>
              <Garantia titulo="Matrícula é piso, não teto">
                Quem aceita a 3ª opção continua na fila da 1ª e da 2ª. Aceitar deixa de custar caro, e a vaga
                liberada entra em cascata automaticamente.
              </Garantia>
              <Garantia titulo="A política não muda">
                A ordem de prioridade da Resolução é executada exatamente como está escrita. As 13 perguntas
                e seus pesos são dado versionado, não código.
              </Garantia>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function Bloco({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio: string }) {
  return (
    <div className="bg-surface px-5 py-4">
      <dt className="rotulo mb-1">{rotulo}</dt>
      <dd className="font-display text-[27px] font-extrabold tracking-tight">
        {valor}
        <span className="mt-1 block font-body text-[13.5px] font-normal leading-snug text-ink-2">{apoio}</span>
      </dd>
    </div>
  );
}

function Comparacao({
  rotulo,
  real,
  motor,
  destaque,
}: {
  rotulo: string;
  real: string;
  motor: string;
  destaque?: boolean;
}) {
  return (
    <tr>
      <td className="border-b border-rule py-2.5 pr-3">{rotulo}</td>
      <td className="num border-b border-rule py-2.5 pr-3 text-right whitespace-nowrap">{real}</td>
      <td
        className={`num border-b border-rule py-2.5 text-right whitespace-nowrap ${
          destaque ? "font-semibold text-match" : ""
        }`}
      >
        {motor}
      </td>
    </tr>
  );
}

function Garantia({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <li className="bg-surface px-5 py-4">
      <h3 className="mb-1 font-display text-[16px] font-semibold">{titulo}</h3>
      <p className="text-[14px] text-ink-2">{children}</p>
    </li>
  );
}
