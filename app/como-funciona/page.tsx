import type { Metadata } from "next";
import Link from "next/link";

import { catalogo, fatos, LACUNA_COMPROVACAO as lacuna, SEQUENCIA_DESEMPATE } from "@/lib/dados";
import { BAIRROS_OFICIAIS } from "@/lib/bairros";
import { BLOCOS, INDICADORES, PERGUNTAS, REGUA_VERSAO, REGUA_VIGENCIA_PROCESSOS } from "@/lib/regua";

export const metadata: Metadata = {
  title: "Como funciona · Vaga Certa",
  description:
    "A régua de pontuação item a item, as cinco perguntas que restaram, as três formas de comprovar, o sorteio auditável e os indicadores que dizem quando a régua precisa mudar.",
};

const n = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/**
 * O destino de todo número que saiu do formulário.
 *
 * Os textos de apoio dos campos vinham argumentando: "em 2025, 68,2% das
 * inscrições declararam ao menos um critério e apenas 6,2% chegaram à
 * classificação com pontuação acima de zero", "é aqui que a rede perdeu 62
 * pontos percentuais", "empatada com 93,8% da fila". Para quem preenche, isso é
 * o argumento do diagnóstico ocupando o lugar da instrução.
 *
 * Reunidos aqui, os mesmos números ficam mais fortes — e o formulário fica
 * limpo. Ganho duplo, e é o mesmo material que a apresentação usa.
 */
export default function Pagina() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-9">
      <p className="rotulo mb-2 text-azul-medio">Como funciona</p>
      <h1 className="mb-4 text-[clamp(26px,4.6vw,38px)] font-black tracking-[-0.03em] text-azul">
        Como a vaga de creche é distribuída
      </h1>
      <p className="mb-8 max-w-[64ch] text-[17px] text-texto-2">
        Esta página tem tudo o que decide a posição de uma criança na fila: a régua de pontuação item a item, o que
        o governo consulta em vez de perguntar, como comprovar, como o sorteio é auditado, e os indicadores que
        dizem quando a régua precisa mudar.
      </p>

      <nav aria-label="Nesta página" className="cartao mb-10 overflow-hidden">
        <p className="cartao-titulo">Nesta página</p>
        <ul className="divide-y divide-linha">
          {[
            ["#regua", "A régua de pontuação"],
            ["#perguntas", "Por que sobraram cinco perguntas"],
            ["#comprovar", "As três formas de comprovar"],
            ["#desempate", "O desempate e o sorteio auditável"],
            ["#indicadores", "Os indicadores que vigiam a régua"],
            ["#bairros", "Por que a distância é aproximada"],
            ["#polos", "Atendimento presencial e pelo 1746"],
            ["#lgpd", "Quais dados consultamos, e com que base legal"],
          ].map(([href, rotulo]) => (
            <li key={href}>
              <a
                href={href}
                className="block min-h-[48px] px-4 py-3 text-[15px] font-bold text-azul hover:bg-cinza"
              >
                {rotulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ────────────────────────────────────────────────────── a régua */}
      <Secao id="regua" titulo="A régua de pontuação">
        <p>
          São <strong>100 pontos em cinco grupos</strong>. Dentro de cada grupo vale o item de maior peso — não a
          soma. Entre grupos, soma. Régua do processo 2026, versão {REGUA_VERSAO}, vigente por{" "}
          {REGUA_VIGENCIA_PROCESSOS} processos.
        </p>
        <p>
          A regra do maior item dentro do grupo existe para impedir empilhamento. Até 2025, Bolsa Família, Cartão
          Família Carioca, Territórios Sociais e CadÚnico mediam a mesma coisa — registro no sistema de proteção
          social por baixa renda — e eram pontuados em separado e somados. Entre 2021 e 2023, 3,4% a 5,4% das
          famílias recebiam 200 ou 300 pontos pela mesma condição.
        </p>

        {BLOCOS.map((b) => (
          <div key={b.numero} className="cartao mt-5 overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-linha bg-azul-10 px-4 py-2.5">
              <p className="text-[15px] font-bold text-azul">{b.nome}</p>
              <p className="num text-[13px] font-bold text-azul">
                0 a {b.teto} pontos · {b.composicao === "maior" ? "vale o maior item" : "soma, com teto"}
              </p>
            </div>
            <ul className="divide-y divide-linha">
              {b.graus.map((g) => (
                <li key={g.id} className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-2.5">
                  <span className="max-w-[46ch] text-[14.5px]">
                    {DESCRICAO_DE_GRAU[g.id] ?? g.rotulo}
                    {!g.origens.includes("declarado") && (
                      <span className="ml-2 rounded bg-cinza px-1.5 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-texto-2">
                        exige confirmação
                      </span>
                    )}
                  </span>
                  <span className="num text-[15px] font-bold text-azul">{g.pontos}</span>
                </li>
              ))}
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-2.5 text-texto-3">
                <span className="text-[14.5px]">Nenhum dos itens acima</span>
                <span className="num text-[15px] font-bold">0</span>
              </li>
            </ul>
          </div>
        ))}

        <h3 className="mt-8 mb-2 text-[19px] font-bold text-azul">A regra que corrige a inversão</h3>
        <p>
          Proteção e risco somam com deficiência e saúde. Uma criança com deficiência em família com violência
          doméstica atestada faz 25 + 25 = <strong>50 pontos</strong>, contra os 35 do máximo de renda. Risco agudo
          acumulado passa a superar pobreza máxima.
        </p>
        <p>
          Na régua de 2025 isso era aritmeticamente impossível. O CadÚnico valia 51 pontos e a soma de{" "}
          <em>todos</em> os critérios de risco agudo — deficiência do responsável, violência doméstica, uso abusivo
          de substâncias, privação de liberdade no núcleo, doença crônica grave — dava 14. Nenhuma combinação de
          vulnerabilidade aguda vencia um cadastro. O efeito medido nas 71.930 inscrições de 2025:
        </p>
        <Tabela
          cabecalho={["Perfil", "Famílias", "Régua 2025", "Régua nova"]}
          linhas={[
            ["Cadastro, nenhum critério severo", "34.024 (47,3%)", "45,1 pts", "32,3 pts"],
            ["Dois ou mais critérios severos, sem cadastro", "626 (0,9%)", "11,0 pts", "27,1 pts"],
            ["Razão entre os dois", "—", "0,24", "0,84"],
          ]}
        />
        <p className="mt-3">
          De uma desvantagem de quatro vezes para paridade. E a fila não vira de cabeça para baixo: a correlação
          entre as duas réguas é de 0,944 — sobem mais de 10 pontos percentuais 9,3% das famílias, descem mais de
          10 p.p. 4,1%. É correção da cauda, não reescrita da política.
        </p>

        <h3 className="mt-8 mb-2 text-[19px] font-bold text-azul">Por que a escada de renda, e não outro peso</h3>
        <p>
          Um critério binário com prevalência próxima de 50% e peso máximo não ordena nada: parte a fila em duas
          metades. Em 2025 o CadÚnico tinha 48,9% de prevalência e 51 dos 100 pontos, e deixou{" "}
          <strong>15.956 famílias empatadas em exatamente 53 pontos</strong>. Variando só o número de degraus da
          renda, e mantendo todo o resto:
        </p>
        <Tabela
          cabecalho={["Degraus na renda", "Maior bloco de empate acima de zero"]}
          linhas={[
            ["2 — estrutura de 2025", "24.072 (33,5%)"],
            ["3", "9.672 (13,4%)"],
            ["5 — a régua nova", "8.409 (11,7%)"],
          ]}
        />
        <p className="mt-3">
          É a granularidade que faz o trabalho, não o peso. Rebalancear pesos — o que foi feito em 2024 e de novo
          em 2025 — não resolve; acrescentar degraus resolve.
        </p>

        <Ressalva>
          <strong>O que a régua não consegue fazer.</strong> O bloco em zero permanece em 31,7% da fila nas duas
          réguas, porque 26% das famílias não declaram critério nenhum — não há o que pontuar. Quebrar esse bloco é
          função da proximidade e do sorteio, não da régua. Uma régua que tentasse resolvê-lo acabaria inventando
          pontos para diferenças que não existem.
        </Ressalva>

        <Ressalva>
          <strong>Robustez a choque de cobertura é problema aberto.</strong> Foi um choque externo que quebrou a
          régua em 2023: a prevalência do Bolsa Família na fila saltou de 24,1% para 44,3% em um ano, com a
          retomada do programa, e o bloco de empate no valor máximo foi de 17,8% para 32,3% da fila. O backtest
          testou se a escada de cinco degraus resistiria melhor a um choque igual e{" "}
          <strong>não confirmou</strong>: em choques de +10 e +20 pontos percentuais a régua nova é pior que a
          vigente, porque a escada concentra os entrantes em degraus e um degrau muito povoado é um novo bloco de
          empate. O que se sustenta é mais estreito — a escada reduz o dano colateral sobre quem não mudou de
          situação, de 7,14 para 5,31 p.p. de deslocamento médio.
        </Ressalva>
      </Secao>

      {/* ─────────────────────────────────────────────────── perguntas */}
      <Secao id="perguntas" titulo="Por que sobraram cinco perguntas">
        <p>
          O formulário de 2025 tinha {catalogo.criterios.length} perguntas em autodeclaração. Oito delas são
          respondidas por sistemas do próprio governo — CadÚnico, família monoparental, Bolsa Família, fila do
          processo anterior, irmão matriculado, responsável menor de 18 anos, educação especial e deficiência do
          responsável — e valem 87 dos 100 pontos.
        </p>
        <p>
          Perguntá-las é pedir que a família comprove no balcão o que o governo já sabe. Foi assim que, em 2025,{" "}
          {pct(fatos.declararamCriterioPct)} das inscrições declararam ao menos um critério e apenas{" "}
          {pct(fatos.comprovaramCriterioPct)} chegaram à classificação com pontuação acima de zero — uma lacuna de{" "}
          {n(lacuna.inscricoes)} inscrições, {pct(lacuna.pctDoTotal)} do total do processo.
        </p>
        <Ressalva>
          <strong>O que esse número mede, e o que não mede.</strong> Ele mede o que a extração expõe: a diferença
          entre o critério declarado e o critério confirmado na base. Não mede a causa. A leitura de que a
          diferença é falta de comparecimento para comprovar é interpretação, e é a mais provável — mas a base não
          traz o motivo de cada caso.
        </Ressalva>
        <p>
          O que nenhum sistema responde são as {PERGUNTAS.filter((p) => !p.condicional).length} perguntas abaixo,
          mais {PERGUNTAS.filter((p) => p.condicional).length} que só aparecem quando a base não respondeu. Três
          delas pedem uma segunda parte, porque a régua precisa saber de quem se trata — a criança ou outra pessoa
          da casa. O número honesto é <strong>cinco perguntas, até oito toques</strong>.
        </p>
        <ol className="cartao mt-4 divide-y divide-linha overflow-hidden">
          {PERGUNTAS.map((p, i) => (
            <li key={p.id} className="px-4 py-3">
              <p className="text-[15px]">
                <span className="num mr-2 font-bold text-azul">{i + 1}.</span>
                {p.texto}
              </p>
              <p className="mt-1 flex flex-wrap gap-2 text-[12.5px]">
                {p.condicional && (
                  <span className="rounded bg-cinza px-1.5 py-0.5 font-bold uppercase tracking-[0.04em] text-texto-2">
                    só se a base não responder
                  </span>
                )}
                {p.qualificador && (
                  <span className="rounded bg-cinza px-1.5 py-0.5 font-bold uppercase tracking-[0.04em] text-texto-2">
                    tem segunda parte: {p.qualificador.pergunta.toLowerCase()}
                  </span>
                )}
                {p.sensivel && (
                  <span className="rounded bg-cinza px-1.5 py-0.5 font-bold uppercase tracking-[0.04em] text-texto-2">
                    dado protegido
                  </span>
                )}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-4">
          A pontuação não aparece ao lado de nenhuma dessas perguntas, e nem ao lado da segunda parte. Mostrar "51
          pontos" ao lado de "sua família está no CadÚnico?" — como o formulário de 2025 fazia — é ensinar a
          marcar, e piora o dado de que a política precisa.
        </p>
      </Secao>

      {/* ───────────────────────────────────────────────────── comprovar */}
      <Secao id="comprovar" titulo="As três formas de comprovar">
        <ol className="cartao divide-y divide-linha overflow-hidden">
          <Caminho titulo="Confirmado pelo governo" tom="ok">
            O dado é lido direto da base — CadÚnico, INSS, sistema acadêmico da SME, histórico da própria fila.
            Você não faz nada e não leva documento. É o caminho de 87 dos 100 pontos.
          </Caminho>
          <Caminho titulo="Confirmado por um serviço" tom="ok">
            Se um serviço público já acompanha a família — CREAS, CRAS, CAPS-AD, unidade de saúde —, ele lança a
            informação no sistema e você não leva documento. É o caminho preferencial para as situações de risco.
          </Caminho>
          <Caminho titulo="Precisa comprovar" tom="atencao">
            Só quando não há base nem serviço. Você tem 30 dias, e pode enviar foto pelo celular, anexar arquivo,
            ou levar num ponto de atendimento. O prazo de análise é de 3 dias úteis, e toda recusa vem com o
            motivo escrito.
          </Caminho>
        </ol>
        <p className="mt-4">
          A perda é <strong>por grupo</strong>, e não em bloco. Quem não comprova a violência no núcleo perde os 20
          pontos daquele grupo; os pontos da renda, que vieram da base, continuam valendo. O formulário de 2025
          dizia que "a pontuação declarada não entra na classificação", no plural, como se tudo caísse junto.
        </p>
        <p>
          E só o que foi confirmado ordena a fila. Ponto declarado e não confirmado aparece somado em separado,
          como "a confirmar", e não move a posição. A razão é medida: ao elevar os critérios de risco de 2–4 para
          10–25 pontos, a régua nova amplifica o sinal — e a autodeclaração desses critérios se contradiz entre
          processos em 80% a 92% dos casos. Publicar a régua nova sobre dado autodeclarado seria pior do que
          manter a régua de 2025.
        </p>
      </Secao>

      {/* ──────────────────────────────────────────────────── desempate */}
      <Secao id="desempate" titulo="O desempate e o sorteio auditável">
        <p>Quando duas crianças têm a mesma pontuação, a ordem é decidida nesta sequência:</p>
        <ol className="cartao my-4 divide-y divide-linha overflow-hidden">
          {SEQUENCIA_DESEMPATE.map((s, i) => (
            <li key={s} className="flex items-baseline gap-3 px-4 py-3">
              <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-azul text-[12px] font-bold text-white">
                {i + 1}
              </span>
              <span className="text-[15px]">{s}</span>
            </li>
          ))}
        </ol>
        <p>
          O sorteio é auditável: a posição de cada criança é calculada por uma função criptográfica a partir de uma
          semente única, publicada no Diário Oficial <em>antes</em> da rodada. Qualquer pessoa com a semente e a
          lista de inscrições refaz a conta e chega ao mesmo resultado, sem acesso ao banco. A semente é uma só
          para o processo inteiro — sorteio independente por unidade quebraria a verificabilidade sem ganho de
          equidade.
        </p>
        <p>
          A régua ordena por mérito social; a proximidade desempata. São funções distintas e não se misturam: a
          proximidade não vale pontos.
        </p>
      </Secao>

      {/* ──────────────────────────────────────────────── indicadores */}
      <Secao id="indicadores" titulo="Os indicadores que vigiam a régua">
        <p>
          A régua foi reescrita três vezes em cinco anos, e nenhuma das reescritas foi decisão conceitual: a régua
          de 2021 funcionava razoavelmente com o Bolsa Família em 27% de prevalência e virou moeda ao ar em 44%.{" "}
          <strong>Ninguém estava olhando para esse número.</strong>
        </p>
        <p>
          Estes três indicadores são publicados a cada processo. Quando um deles dispara, a resposta é
          padronizada: acrescenta-se <strong>degrau à escada daquele item</strong> — nunca se redistribuem os
          pesos da régua inteira. Foi a redistribuição geral que produziu as rupturas de 2024 e 2025 e tornou
          impossível explicar a uma família por que sua posição mudou.
        </p>
        <ul className="cartao mt-4 divide-y divide-linha overflow-hidden">
          {INDICADORES.map((i) => (
            <li key={i.rotulo} className="px-4 py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="max-w-[42ch] text-[15px] font-bold">{i.rotulo}</p>
                <p className="flex items-baseline gap-2">
                  <span
                    className={`num text-[18px] font-black ${i.valor2025 > i.limite ? "text-erro" : "text-ok"}`}
                  >
                    {pct(i.valor2025)}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.04em] ${
                      i.valor2025 > i.limite ? "bg-erro-fundo text-erro" : "bg-ok-fundo text-ok"
                    }`}
                  >
                    {i.valor2025 > i.limite ? "em alerta" : "dentro do limite"}
                  </span>
                </p>
              </div>
              <p className="mt-1 text-[13.5px] text-texto-2">
                Alerta {i.alerta} · em 2025: {i.detalhe2025}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          Os três valores acima são os da régua de 2025, e os três estão em alerta. É o diagnóstico que motivou a
          régua nova — e o motivo de eles serem publicados: um indicador que ninguém vê não é mecanismo de
          detecção.
        </p>
      </Secao>

      {/* ────────────────────────────────────────────────────── bairros */}
      <Secao id="bairros" titulo="Por que a distância é aproximada">
        <p>
          A base do processo traz 1.607 valores distintos de bairro para {BAIRROS_OFICIAIS.length} bairros
          oficiais: o mesmo bairro em caixa alta e baixa, sub-localidade no lugar do bairro, conjunto habitacional,
          e mistura de bairro com Região Administrativa. O formulário antigo oferecia essa lista crua à família — o
          mesmo bairro aparecia até quatro vezes, sem nenhuma pista de qual era a certa, num campo que decide o
          desempate por proximidade.
        </p>
        <p>
          Agora o bairro é derivado do CEP e nunca digitado. As variações ficam num dicionário de normalização no
          servidor, e cada bairro aparece uma vez, no nome oficial.
        </p>
        <p>
          Onde um CEP único cobre milhares de endereços — Rocinha, Manguinhos, Complexo do Alemão, Maré, Cidade de
          Deus, Rio das Pedras, Santa Cruz, entre outros — a distância é calculada do centro da região, e não da
          casa. A tela diz isso à família em vez de esconder.
        </p>
      </Secao>

      {/* ──────────────────────────────────────────────────────── polos */}
      <Secao id="polos" titulo="Atendimento presencial e pelo 1746">
        <p>
          Tudo o que existe no formulário existe no balcão. Um servidor do polo, da unidade ou do 1746 preenche a
          inscrição pela família, com o próprio atendimento registrado — sem isso, exigir conta gov.br desloca a
          exclusão digital do fim do processo para o começo.
        </p>
        <p>
          A comprovação também: enviar foto pelo celular e levar o documento num ponto de atendimento têm o mesmo
          peso. Comprovação só por aplicativo reintroduz, no ponto mais sensível, a exclusão que o desenho quer
          eliminar.
        </p>
        <Ressalva>
          <strong>Neste protótipo</strong> o modo assistido e a lista de pontos de atendimento não estão
          implementados. A inscrição válida é a do{" "}
          <a
            href="https://matricula.rio"
            target="_blank"
            rel="noreferrer noopener"
            className="font-bold text-azul underline underline-offset-2"
          >
            matricula.rio
          </a>
          .
        </Ressalva>
      </Secao>

      {/* ───────────────────────────────────────────────────────── lgpd */}
      <Secao id="lgpd" titulo="Quais dados consultamos, e com que base legal">
        <p>
          A consulta é autorizada em duas caixas separadas, porque a base legal não é a mesma. Quem recusa a
          segunda perde os grupos de proteção, risco, deficiência e saúde — e a tela diz isso antes.
        </p>
        <h3 className="mt-6 mb-2 text-[17px] font-bold text-azul">
          Consulta comum — execução de política pública (LGPD, art. 7º, III)
        </h3>
        <Tabela
          cabecalho={["Sistema", "O que consultamos"]}
          linhas={[
            ["Receita Federal", "nome e data de nascimento do responsável e da criança"],
            ["CadÚnico (CECAD/Dataprev)", "renda por pessoa, quem mora com você e a data do cadastro"],
            ["Sistema de Gestão Acadêmica (SME)", "se a criança tem irmão matriculado na rede"],
            ["Histórico da própria inscrição", "em quantos processos você já esperou vaga"],
          ]}
        />
        <h3 className="mt-6 mb-2 text-[17px] font-bold text-azul">
          Consulta de dado sensível — art. 11, II, "b"
        </h3>
        <Tabela
          cabecalho={["Sistema", "O que consultamos"]}
          linhas={[
            ["INSS / BPC", "benefício por deficiência do responsável ou da criança"],
            ["Rede municipal de saúde / SISVAN", "acompanhamento nutricional e de saúde da criança"],
          ]}
        />
        <h3 className="mt-6 mb-2 text-[17px] font-bold text-azul">
          Informação protegida de outro órgão — não depende da sua autorização
        </h3>
        <Tabela
          cabecalho={["Sistema", "O que consultamos"]}
          linhas={[
            [
              "Vara da Infância · Conselho Tutelar · acolhimento (SMAS)",
              "se existe medida de proteção em favor da criança",
            ],
          ]}
        />
        <p className="mt-3">
          Esta última consulta pontua e <strong>nunca é exibida</strong> em nenhuma tela — aparece como "informação
          protegida de outro órgão", sem nome de órgão, sem data e sem contestação em tela. O motivo é operacional:
          em violência intrafamiliar, quem opera o formulário pode ser a pessoa contra quem a medida foi expedida,
          e uma tela que mostrasse "consta medida protetiva em favor de MARIA, expedida em 03/2026" entregaria a
          informação exatamente a quem não deve tê-la. A contestação, se houver, é presencial, e o registro
          completo fica restrito ao analista, com log nominal.
        </p>
        <p>
          O valor da renda e o nome da faixa também não aparecem no corpo do cartão: ficam atrás de um toque
          deliberado. Carimbar "extrema pobreza" na tela de alguém não acrescenta nada à decisão que ela está
          tomando ali, e no balcão a tela é vista pelo servidor e por quem está na fila atrás. Correção de renda é
          no CRAS: a Prefeitura não altera o CadÚnico.
        </p>
        <p className="mt-6">
          <strong>Finalidade:</strong> classificar a inscrição no processo 195. <strong>Guarda:</strong> até o
          encerramento do processo, mais o prazo legal de cinco anos.{" "}
          <strong>Compartilhamento:</strong> nenhum, além dos órgãos consultados.
        </p>
      </Secao>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-linha pt-8">
        <Link href="/inscricao" className="botao botao-primario">
          Fazer a inscrição
        </Link>
        <Link href="/painel" className="botao botao-secundario">
          Painel da rede
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────── subcomponentes

function Secao({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-6">
      <h2 className="secao-titulo mb-4">{titulo}</h2>
      <div className="space-y-3 text-[15.5px] leading-[1.65] text-texto-2 [&_strong]:text-texto">{children}</div>
    </section>
  );
}

function Tabela({ cabecalho, linhas }: { cabecalho: string[]; linhas: string[][] }) {
  return (
    <div className="cartao mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-azul-10">
            {cabecalho.map((c) => (
              <th key={c} className="rotulo px-4 py-2.5 text-azul">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.join("|")} className="border-t border-linha">
              {l.map((celula, i) => (
                <td key={i} className={`px-4 py-2.5 text-[14.5px] ${i > 0 ? "num" : ""}`}>
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Caminho({
  titulo,
  tom,
  children,
}: {
  titulo: string;
  tom: "ok" | "atencao";
  children: React.ReactNode;
}) {
  return (
    <li className="px-4 py-3.5">
      <p className={`mb-1 text-[15px] font-bold ${tom === "ok" ? "text-ok" : "text-atencao"}`}>{titulo}</p>
      <p className="text-[14.5px] text-texto-2">{children}</p>
    </li>
  );
}

/** Limite conhecido, dito na página. Assumir a limitação é mais forte que esconder. */
function Ressalva({ children }: { children: React.ReactNode }) {
  return (
    <div className="tarja my-4 border-l-atencao bg-atencao-fundo">
      <p className="max-w-[66ch] text-[14.5px] text-texto-2">{children}</p>
    </div>
  );
}

/**
 * Descrição pública de cada grau.
 *
 * Aqui — e só aqui — a faixa de renda aparece por nome e por valor, porque esta
 * é a página da régua e não a tela de uma família. Dentro do formulário, o
 * cartão diz "renda confirmada pelo CadÚnico" e os pontos.
 */
const DESCRICAO_DE_GRAU: Record<string, string> = {
  renda_extrema: "Extrema pobreza — renda per capita até R$ 109",
  renda_pobreza: "Pobreza — de R$ 109,01 a R$ 218",
  renda_baixa: "Baixa renda — até meio salário mínimo per capita",
  cadunico_atualizado: "CadÚnico ativo e atualizado, acima de meio salário mínimo per capita",
  cadunico_vencido: "CadÚnico com atualização vencida, há mais de 24 meses",
  protecao_crianca: "Criança sob medida protetiva ou em acolhimento institucional",
  violencia_crianca: "Violência contra a criança, atestada por serviço público",
  violencia_nucleo: "Violência doméstica no núcleo familiar, atestada por serviço público",
  substancias: "Uso abusivo de álcool ou outras drogas no núcleo",
  privacao_responsavel: "Responsável direto privado de liberdade",
  privacao_outro_membro: "Outra pessoa do núcleo privada de liberdade",
  educacao_especial: "Criança público-alvo da educação especial",
  crianca_doenca_grave: "Criança com doença crônica grave ou déficit nutricional",
  responsavel_deficiencia: "Responsável com deficiência ou doença incapacitante",
  doenca_outro_membro: "Doença crônica grave em outro membro do núcleo",
  responsavel_unico: "Responsável único, sem outro adulto no domicílio",
  monoparental: "Família monoparental",
  responsavel_idade: "Responsável único com 60 anos ou mais, ou menor de 18",
  espera_dois_processos: "Aguarda vaga há dois processos ou mais",
  espera_anterior: "Aguardou no processo anterior",
  refugiado: "Refugiado ou solicitante de refúgio",
};
