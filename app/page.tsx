import Link from "next/link";

import { backtest, catalogo, fatos } from "@/lib/dados";

const n = (v: number) => v.toLocaleString("pt-BR");
const dec = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function Pagina() {
  const maiorCriterio = [...catalogo.criterios].sort((a, b) => b.pontos - a.pontos)[0];

  return (
    <>
      {/* ─────────────────────────────────────────── chamada principal */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-12 md:py-16">
          <div className="grid gap-10 md:grid-cols-[1.35fr_1fr] md:items-start">
            <div>
              <p className="rotulo mb-3 text-azul-medio">Processo seletivo · Creche · 2025</p>
              <h1 className="mb-5 text-[clamp(28px,4.6vw,42px)] font-black tracking-[-0.03em] text-azul">
                Uma criança, um convite.
              </h1>
              <p className="mb-4 max-w-[58ch] text-[17px] text-texto-2">
                Hoje uma inscrição gera até cinco filas paralelas para a mesma criança. Ela recebe cinco
                ofertas, ocupa cinco assentos, aceita um — e os outros quatro ficam congelados até serem
                repassados.
              </p>
              <p className="mb-7 max-w-[58ch] text-[17px] text-texto-2">
                Este serviço classifica por criança, e não por opção. A ordem de prioridade da Resolução é
                executada exatamente como está escrita. O que muda é a sequência das ofertas.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link href="/inscricao" className="botao botao-primario">
                  Fazer a inscrição
                </Link>
                <Link href="/painel" className="botao botao-secundario">
                  Painel da rede
                </Link>
              </div>
            </div>

            {/* Quadro de números, no padrão de caixa de dados dos portais da PCRJ */}
            <div className="cartao overflow-hidden">
              <p className="cartao-titulo">O processo de 2025 em números</p>
              <dl className="divide-y divide-linha">
                <Dado
                  rotulo="Crianças na fila"
                  valor={n(fatos.criancas)}
                  apoio={`em ${n(fatos.inscricoes)} inscrições, para ${n(backtest.rodada.vagas)} vagas`}
                />
                <Dado
                  rotulo="Empatadas em zero ponto"
                  valor={`${dec(fatos.empatadosEmZeroPct)}%`}
                  apoio={`${n(fatos.empatadosEmZero)} inscrições com a mesma nota`}
                />
                <Dado
                  rotulo="Assentos travados"
                  valor={n(backtest.historico.assentosTravados)}
                  apoio="vagas presas por crianças com mais de uma oferta simultânea"
                  destaque
                />
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────── o achado */}
      <section className="border-y border-linha bg-cinza">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <h2 className="secao-titulo mb-6">O que a base de 2025 mostra</h2>

          <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
            <div className="tarja border-l-atencao">
              <p className="rotulo mb-2 text-atencao">Declarar não é comprovar</p>
              <p className="mb-3 text-[15.5px] text-texto-2">
                <strong className="text-texto">{dec(fatos.declararamCriterioPct)}%</strong> das inscrições
                declararam ao menos um critério de prioridade. Apenas{" "}
                <strong className="text-texto">{dec(fatos.comprovaramCriterioPct)}%</strong> chegaram à
                classificação com pontuação acima de zero. O campo de confirmação não marca critério a
                critério: marca se a família compareceu para comprovar.
              </p>
              <p className="text-[15.5px] text-texto-2">
                Resultado:{" "}
                <strong className="text-texto">
                  {n(fatos.empatadosEmZero)} inscrições entram empatadas em zero ponto
                </strong>
                . Quem ordena a fila, na prática, é o critério de desempate.
              </p>
            </div>

            <div className="tarja">
              <p className="rotulo mb-2 text-azul-medio">Onde a lacuna pode ser fechada</p>
              <p className="mb-3 text-[15.5px] text-texto-2">
                O maior critério da régua de {catalogo.ano} vale {maiorCriterio.pontos} dos{" "}
                {catalogo.pontuacaoMaxima} pontos possíveis:
              </p>
              <p className="mb-3 border-l-2 border-linha pl-3 text-[15px] italic text-texto">
                {maiorCriterio.texto}
              </p>
              <p className="text-[15.5px] text-texto-2">
                É verificável no Data Lake da Prefeitura, sem a família precisar levar papel. Por isso este
                formulário entrega, no fim, a lista exata de documentos de cada critério marcado.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────── backtest */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <h2 className="secao-titulo mb-3">O motor aplicado ao processo real</h2>
          <p className="mb-7 max-w-[70ch] text-[15.5px] text-texto-2">
            Mesma fila, mesma capacidade. A capacidade de cada assento é exatamente quantas crianças a rede
            colocou nele em {backtest.processo.ano}, então o motor não pode ganhar inventando vaga que não
            existia.
          </p>

          <div className="cartao overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[15px]">
              <caption className="sr-only">
                Comparação entre o processo real de 2025 e o resultado do motor de alocação
              </caption>
              <thead>
                <tr className="bg-azul text-white">
                  <th scope="col" className="px-4 py-3 text-left text-[11.5px] font-bold tracking-[0.08em] uppercase">
                    Métrica
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[11.5px] font-bold tracking-[0.08em] uppercase">
                    {backtest.processo.ano} real
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[11.5px] font-bold tracking-[0.08em] uppercase">
                    Com o motor
                  </th>
                </tr>
              </thead>
              <tbody>
                <Linha
                  rotulo="Crianças ocupando mais de um assento"
                  real={n(backtest.historico.criancasComMaisDeUmAssento)}
                  motor="0"
                  ganho
                />
                <Linha
                  rotulo="Assentos travados por oferta múltipla"
                  real={n(backtest.historico.assentosTravados)}
                  motor="0"
                  ganho
                />
                <Linha
                  rotulo="Reservas que não viraram matrícula"
                  real={n(backtest.historico.reservasSemMatricula)}
                  motor="0"
                  ganho
                />
                <Linha
                  rotulo="Atendidas na 1ª opção"
                  real={`${dec(backtest.historico.primeiraOpcaoPct)}%`}
                  motor={`${dec(backtest.motor.primeiraOpcaoPct)}%`}
                  ganho
                />
                <Linha
                  rotulo="Vagas preenchidas"
                  real={n(backtest.historico.vagasPreenchidas)}
                  motor={n(backtest.motor.vagasPreenchidas)}
                />
                <Linha
                  rotulo="Violações de estabilidade"
                  real="não verificável"
                  motor={String(backtest.rodada.violacoes)}
                />
              </tbody>
            </table>
          </div>

          <p className="mt-5 max-w-[70ch] text-[15.5px] text-texto-2">
            O ganho não vem de acelerar o convite. Vem de nunca emitir os quatro convites que não podem ser
            aceitos. <strong className="text-texto">{n(backtest.ganhos.assentosLiberadosDeImediato)} assentos</strong>{" "}
            deixam de ficar congelados, e o atendimento na primeira opção sobe{" "}
            <strong className="text-texto">{dec(backtest.ganhos.pontosDeAumentoNaPrimeiraOpcao)} pontos percentuais</strong>.
          </p>
          <p className="mt-3 max-w-[70ch] text-[14px] text-texto-3">
            A rodada inteira — {n(backtest.rodada.criancas)} crianças, {n(backtest.rodada.assentos)} assentos,{" "}
            {n(backtest.rodada.propostas)} propostas avaliadas — leva {n(backtest.rodada.duracaoMs)} ms, e a
            verificação de que ninguém foi ultrapassado leva outros {n(backtest.rodada.verificacaoMs)} ms. A
            dificuldade desta solução não é computacional: é integração, auditabilidade e operação.
          </p>
        </div>
      </section>

      {/* ─────────────────────────────────────────── garantias */}
      <section className="border-t border-linha bg-cinza">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <h2 className="secao-titulo mb-6">O que o motor garante</h2>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Garantia titulo="Um convite por criança">
              A unidade de alocação é a criança, não a inscrição — mesmo quando ela se inscreveu em mais de um
              polo do mesmo processo.
            </Garantia>
            <Garantia titulo="Ninguém à frente é ultrapassado">
              Não existe par criança–assento em que a criança prefira aquele assento e ele esteja ocupado por
              alguém de prioridade menor. A propriedade é verificada a cada rodada, não prometida.
            </Garantia>
            <Garantia titulo="Dizer a verdade não custa vaga">
              Declarar a preferência real nunca prejudica a família, então não há vantagem em escolher unidade
              por cálculo de chance em vez de por onde se quer a vaga.
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
              A ordem de prioridade da Resolução é executada como está escrita. As {catalogo.criterios.length}{" "}
              perguntas e seus pesos são dado versionado, não código.
            </Garantia>
          </ul>
        </div>
      </section>
    </>
  );
}

function Dado({
  rotulo,
  valor,
  apoio,
  destaque,
}: {
  rotulo: string;
  valor: string;
  apoio: string;
  destaque?: boolean;
}) {
  return (
    <div className="px-4 py-3.5">
      <dt className="rotulo mb-1">{rotulo}</dt>
      <dd>
        <span
          className={`num block text-[26px] font-black tracking-[-0.02em] ${
            destaque ? "text-erro" : "text-azul"
          }`}
        >
          {valor}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-texto-2">{apoio}</span>
      </dd>
    </div>
  );
}

function Linha({
  rotulo,
  real,
  motor,
  ganho,
}: {
  rotulo: string;
  real: string;
  motor: string;
  ganho?: boolean;
}) {
  return (
    <tr className="border-b border-linha last:border-0">
      <th scope="row" className="px-4 py-3 text-left font-medium">
        {rotulo}
      </th>
      <td className="num px-4 py-3 text-right whitespace-nowrap text-texto-2">{real}</td>
      <td
        className={`num px-4 py-3 text-right whitespace-nowrap ${
          ganho ? "bg-ok-fundo font-bold text-ok" : "font-medium"
        }`}
      >
        {motor}
      </td>
    </tr>
  );
}

function Garantia({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <li className="cartao border-t-[3px] border-t-azul-claro p-4">
      <h3 className="mb-1.5 text-[15.5px] font-bold text-azul">{titulo}</h3>
      <p className="text-[14px] leading-relaxed text-texto-2">{children}</p>
    </li>
  );
}
