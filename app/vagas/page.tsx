import type { Metadata } from "next";
import Link from "next/link";

import { parametros, proximaRodada, vacancia } from "@/lib/dados";

/** Depende só de dado versionado, então é gerada no build e serve instantânea. */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Onde ainda há vaga hoje · Vaga Certa",
  description:
    "Mapa de vacância da rede municipal de creche, com dois regimes: vaga sem fila é autoatendimento; vaga com fila é alocada pela rodada.",
};

const n = (v: number) => v.toLocaleString("pt-BR");

export default function Pagina() {
  const v = vacancia();
  const r = proximaRodada();
  const total = v.semFila.vagas + v.comFila.vagas;
  const pctSemFila = Math.round((100 * v.semFila.vagas) / Math.max(total, 1));

  return (
    <>
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <p className="rotulo mb-2 text-azul-medio">Fila contínua · Processo 195 · 2025</p>
          <h1 className="mb-4 text-[clamp(24px,4.2vw,34px)] font-black tracking-[-0.03em] text-azul">
            Onde ainda há vaga hoje.
          </h1>
          <p className="max-w-[72ch] text-[16px] text-texto-2">
            Quem procura vaga fora do período de inscrição não precisa entrar numa fila cega. A rede tem
            vaga sobrando em lugares onde ninguém está esperando — e fila longa em outros. As duas situações
            não podem ser tratadas do mesmo jeito.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-10">
        {/* ─── os dois regimes ─── */}
        <section>
          <h2 className="secao-titulo mb-4">Dois estados da vaga, dois regimes</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="cartao overflow-hidden border-ok">
              <p className="cartao-titulo bg-ok">Vaga sem fila · autoatendimento</p>
              <div className="p-4">
                <p className="num text-[30px] font-black text-ok">{n(v.semFila.vagas)}</p>
                <p className="mb-3 text-[13.5px] text-texto-2">
                  vagas em {n(v.semFila.assentos)} assentos — {pctSemFila}% do estoque disponível
                </p>
                <ul className="space-y-1.5 text-[14.5px] text-texto-2">
                  <li>Ninguém na lista de espera daquele assento.</li>
                  <li>
                    <strong className="text-texto">Ocupação imediata pelo mapa.</strong> Não prejudica
                    ninguém: não há fila para furar.
                  </li>
                  <li>A pontuação é irrelevante neste regime.</li>
                </ul>
              </div>
            </div>

            <div className="cartao overflow-hidden border-atencao">
              <p className="cartao-titulo bg-atencao">Vaga com fila · nunca autoatendimento</p>
              <div className="p-4">
                <p className="num text-[30px] font-black text-atencao">{n(v.comFila.vagas)}</p>
                <p className="mb-3 text-[13.5px] text-texto-2">
                  vagas em {n(v.comFila.assentos)} assentos, com {n(v.comFila.aguardando)} crianças
                  aguardando
                </p>
                <ul className="space-y-1.5 text-[14.5px] text-texto-2">
                  <li>
                    <strong className="text-texto">Nunca self-service.</strong> O celular mais rápido
                    passaria à frente da maior vulnerabilidade.
                  </li>
                  <li>A rodada semanal aloca por prioridade.</li>
                  <li>No mapa, a vaga aparece como &ldquo;entrar na lista&rdquo;.</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="tarja mt-4">
            <p className="max-w-[74ch] text-[14.5px] text-texto-2">
              A regra que impede o furo de fila está nos próprios dados: <strong>{pctSemFila}% das vagas
              disponíveis não têm ninguém na lista de espera.</strong> É essa separação que permite oferecer
              autoatendimento sem custar prioridade a ninguém — e é a vaga que hoje simplesmente apodrece.
            </p>
          </div>
        </section>

        {/* ─── rodada semanal ─── */}
        <section>
          <h2 className="secao-titulo mb-4">Rodada semanal e janela de manifestação</h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cel rotulo="Próxima rodada" valor={r.rodada} apoio={`toda ${r.diaRotulo}`} />
            <Cel rotulo="Prazo de manifestação" valor={r.prazo} apoio={r.prazoRotulo} tom="atencao" />
            <Cel rotulo="Janela" valor={`${r.janelaDias} dias`} apoio="para ocupar a vaga oferecida" />
            <Cel rotulo="Modelo" valor="pull" apoio="a família consulta, a escola não liga" tom="ok" />
          </dl>
          <p className="mt-3 max-w-[74ch] text-[14.5px] text-texto-2">
            {parametros.rodada.justificativa}
          </p>
        </section>

        {/* ─── regras de operação ─── */}
        <section>
          <h2 className="secao-titulo mb-4">Regras de operação</h2>
          <ul className="cartao divide-y divide-linha overflow-hidden">
            <Regra titulo="Ocupar vaga de vacância não custa a fila da opção mantida">
              E não altera a pontuação. Precisa estar no edital: sem essa garantia, a família racional recusa
              a vaga ociosa para proteger a posição — que é exatamente o comportamento que a SME relata hoje.
            </Regra>
            <Regra titulo="Reserva atômica com prazo curto">
              Duas famílias podem tocar a mesma vaga no mesmo segundo. O assento é travado no instante do
              toque e sai imediatamente da capacidade da rodada seguinte — senão o motor aloca um assento já
              tomado.
            </Regra>
            <Regra titulo="Filtro obrigatório por grupamento e turno">
              O mapa só pode oferecer assentos compatíveis com a idade da criança e com o turno declarado.
            </Regra>
            <Regra titulo="Canal presencial equivalente">
              A vaga também pelo polo e pela própria unidade, com o mesmo estoque e a mesma trava. Um mercado
              de vacância só por aplicativo transfere a exclusão digital para dentro da parte mais eficiente
              do processo.
            </Regra>
            <Regra titulo="Distância à mostra">
              A vacância está concentrada na Zona Oeste, e a fila não. Uma família pode ocupar por desespero
              uma vaga cujo deslocamento é inviável. A tela mostra a distância com destaque, e a lista de
              espera da opção mantida é o instrumento de correção.
            </Regra>
          </ul>
        </section>

        {/* ─── listas ─── */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="secao-titulo mb-4">Assentos com vaga e sem fila</h2>
            <ul className="cartao divide-y divide-linha overflow-hidden">
              {v.semFila.lista.slice(0, 12).map((x) => (
                <li key={x.assento} className="flex items-baseline gap-3 px-4 py-3">
                  <span className="num w-12 shrink-0 rounded bg-ok-fundo py-0.5 text-center text-[14px] font-bold text-ok">
                    {x.vaga}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-bold">{x.unidade}</span>
                    <span className="num block text-[12.5px] text-texto-3">
                      {x.bairro} · {x.grupamento} · {x.horario} · {x.turmas} turmas, {x.alunos} alunos
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="secao-titulo mb-4">Assentos com vaga e com fila</h2>
            <ul className="cartao divide-y divide-linha overflow-hidden">
              {v.comFila.lista.slice(0, 12).map((x) => (
                <li key={x.assento} className="flex items-baseline gap-3 px-4 py-3">
                  <span className="num w-16 shrink-0 rounded bg-atencao-fundo py-0.5 text-center text-[13px] font-bold text-atencao">
                    {n(x.aguardando)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-bold">{x.unidade}</span>
                    <span className="num block text-[12.5px] text-texto-3">
                      {x.bairro} · {x.grupamento} · {x.horario} · {x.vaga} vagas para {n(x.aguardando)}{" "}
                      aguardando
                    </span>
                  </span>
                </li>
              ))}
              {v.comFila.lista.length === 0 && (
                <li className="px-4 py-5 text-[14.5px] text-texto-3">
                  Nenhum assento com vaga e fila simultâneas nesta rodada.
                </li>
              )}
            </ul>
          </section>
        </div>

        {/* ─── bairros ─── */}
        <section>
          <h2 className="secao-titulo mb-4">Onde a vaga sem fila está concentrada</h2>
          <div className="cartao overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-[14.5px]">
              <thead>
                <tr className="bg-azul text-white">
                  <th scope="col" className="px-4 py-3 text-left text-[11.5px] font-bold tracking-[0.08em] uppercase">
                    Bairro
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[11.5px] font-bold tracking-[0.08em] uppercase">
                    Assentos
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[11.5px] font-bold tracking-[0.08em] uppercase">
                    Vagas sem fila
                  </th>
                </tr>
              </thead>
              <tbody>
                {v.porBairro.map((b) => (
                  <tr key={b.bairro} className="border-b border-linha last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium">
                      {b.bairro}
                    </th>
                    <td className="num px-4 py-2.5 text-right text-texto-2">{b.assentos}</td>
                    <td className="num px-4 py-2.5 text-right font-bold text-ok">{n(b.vagas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-[74ch] text-[14px] text-texto-3">
            O mapa torna visível um descasamento territorial que hoje ninguém enxerga: a vaga sobra onde a
            fila não está.
          </p>
        </section>

        {/* ─── como a vaga é calculada ─── */}
        <section>
          <h2 className="secao-titulo mb-4">Como a vaga é calculada</h2>
          <div className="tarja border-l-atencao bg-atencao-fundo">
            <p className="num mb-3 text-[15px] font-bold text-texto">
              turmas × {v.lotacaoDeReferencia} − alunos
            </p>
            <p className="mb-3 max-w-[74ch] text-[14.5px] text-texto-2">
              Com <strong className="text-texto">{v.rotuloLotacao}</strong>. A lotação é campo de
              parametrização, não constante de código: o gestor corrige por unidade sem que ninguém faça
              deploy.
            </p>
            <p className="max-w-[74ch] text-[14.5px] text-texto-2">
              <strong className="text-texto">{v.advertencia}</strong>
            </p>
          </div>
          <p className="mt-3 max-w-[74ch] text-[14px] text-texto-3">
            Fonte: consolidado de alunos e turmas por unidade e grupamento (2025), cruzado com o cadastro de
            unidades georreferenciadas. Unidades parceiras entram no catálogo de inscrição, mas o consolidado
            de turmas cobre as unidades públicas — por isso o estoque aqui é menor que a rede inteira.
          </p>
          <p className="mt-3 max-w-[74ch] text-[14px] text-texto-3">
            Uma nota de método, porque o número é mais duro do que o do estudo anterior: aqui &ldquo;fila&rdquo;
            é medida sobre a fila real inteira de 2025 — toda criança que listou o assento e ainda o prefere ao
            que recebeu. Com esse critério, a proporção de vaga sem fila é bem menor do que numa contagem
            restrita à lista de espera formal. Preferimos o número conservador: ele é o que sustenta a regra de
            autoatendimento sem risco de furar fila.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/inscricao" className="botao botao-primario">
            Fazer a inscrição
          </Link>
          <Link href="/painel" className="botao botao-secundario">
            Painel da rede
          </Link>
        </div>
      </div>
    </>
  );
}

function Cel({
  rotulo,
  valor,
  apoio,
  tom,
}: {
  rotulo: string;
  valor: string;
  apoio?: string;
  tom?: "ok" | "atencao";
}) {
  const cor = tom === "ok" ? "text-ok" : tom === "atencao" ? "text-atencao" : "text-azul";
  const borda = tom === "ok" ? "border-t-ok" : tom === "atencao" ? "border-t-atencao" : "border-t-azul-claro";
  return (
    <div className={`cartao border-t-[3px] ${borda} p-3.5`}>
      <dt className="rotulo mb-1">{rotulo}</dt>
      <dd>
        <span className={`num block text-[20px] font-bold ${cor}`}>{valor}</span>
        {apoio && <span className="mt-1 block text-[12.5px] leading-snug text-texto-2">{apoio}</span>}
      </dd>
    </div>
  );
}

function Regra({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <li className="px-4 py-3.5">
      <p className="mb-1 text-[14.5px] font-bold text-azul">{titulo}</p>
      <p className="text-[14px] text-texto-2">{children}</p>
    </li>
  );
}
