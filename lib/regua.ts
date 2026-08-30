/**
 * Régua de pontuação — 100 pontos, cinco blocos, teto por bloco.
 *
 * Substitui a régua de 2025, em que um único critério de alta prevalência
 * (CadÚnico, 51 pontos, 48,9% da fila) consumia 89,9% da escala e produzia a
 * inversão de severidade: uma família com violência doméstica, doença crônica
 * grave e um responsável privado de liberdade pontuava 11,8, contra 45,1 de uma
 * família cadastrada e sem nenhuma dessas condições.
 *
 * Duas regras estruturais, e a segunda é a que corrige a inversão:
 *
 * 1. **Dentro do bloco vale o item de maior grau, não a soma.** Impede
 *    empilhamento de proxies do mesmo construto — que é o defeito D2 do
 *    diagnóstico.
 * 2. **Entre blocos, soma.** Proteção e risco (25) mais deficiência e saúde
 *    (25) chegam a 50, contra os 35 do máximo de renda. Risco agudo acumulado
 *    passa a superar pobreza máxima.
 *
 * E uma regra de origem, que vem do backtest e não da régua:
 *
 * 3. **Só ordena a fila o que foi aferido ou atestado.** Ao elevar os critérios
 *    de risco agudo de 2–4 para 10–25 pontos, a régua nova amplifica um sinal
 *    que se contradiz entre processos em 80% a 92% dos casos quando vem de
 *    autodeclaração. Ponto declarado e não confirmado é somado **em separado**,
 *    fica visível como "a confirmar", e não entra na ordenação.
 *
 * Arquivo sem import interno: roda sob o type-stripping do Node nos testes e é
 * o mesmo código que o Next executa no servidor e o formulário no cliente.
 */

// ───────────────────────────────────────────────────────────────── versão

/**
 * Versão da régua. Vigência fixa de três processos, com gatilho publicado.
 *
 * A régua foi reescrita três vezes em cinco anos e ninguém conseguia explicar a
 * uma família por que sua posição mudou. A versão vai na tela da pontuação e no
 * comprovante: a vigência só é garantia se a família puder ver qual régua a
 * classificou.
 */
export const REGUA_VERSAO = "2026.1";
export const REGUA_VIGENCIA_PROCESSOS = 3;
export const PONTUACAO_MAXIMA = 100;

// ─────────────────────────────────────────────────────────────── tipos

/**
 * De onde vem o ponto.
 *
 * `aferido` — lido de base oficial (CadÚnico, BPC/INSS, SGA, histórico da fila).
 * `atestado` — lançado por serviço público (CREAS, CRAS, CAPS-AD, UBS) ou
 *   comprovado por documento aceito pelo analista.
 * `declarado` — a família disse, e ainda não há confirmação.
 *
 * A família nunca lê estas palavras. Lê `base`, `serviço` e `falta`.
 */
export type Origem = "aferido" | "atestado" | "declarado";

export const ROTULO_ORIGEM: Record<Origem, string> = {
  aferido: "base",
  atestado: "serviço",
  declarado: "falta",
};

export interface Grau {
  /** Chave estável, gravada em `inscricao_criterio.grau`. */
  id: string;
  /** Como o grau aparece na decomposição da pontuação. Sem jargão de régua. */
  rotulo: string;
  pontos: number;
  /**
   * Origens que este grau admite. Grau alto exige aferição ou atestação: é a
   * recomendação do backtest de não deixar declaração carregar peso alto.
   */
  origens: Origem[];
  /**
   * Consultado, nunca exibido. Em violência intrafamiliar quem opera o
   * formulário pode ser o agressor, e uma tela que mostra "consta medida
   * protetiva em favor de MARIA" entrega a informação a quem não deve tê-la.
   * A pontuação entra; a linha aparece como "informação protegida de outro
   * órgão", sem fonte, sem data, sem contestação em tela.
   */
  protegido?: boolean;
}

export interface Bloco {
  numero: 1 | 2 | 3 | 4 | 5;
  /** Nome que a família lê na decomposição. */
  nome: string;
  teto: number;
  /** `maior`: vale o item de maior grau. `soma`: soma os itens, com teto. */
  composicao: "maior" | "soma";
  graus: Grau[];
}

// ────────────────────────────────────────────────────────────── a régua

export const BLOCOS: Bloco[] = [
  {
    numero: 1,
    nome: "Renda",
    teto: 35,
    composicao: "maior",
    graus: [
      // O valor em reais e o nome da faixa nunca aparecem na tela: carimbar
      // "extrema pobreza" não acrescenta nada à decisão que a pessoa está
      // tomando, e no polo a tela é vista pelo servidor e por quem está na fila
      // atrás. O rótulo é o mesmo nos quatro primeiros graus de propósito.
      { id: "renda_extrema", rotulo: "Renda confirmada pelo CadÚnico", pontos: 35, origens: ["aferido"] },
      { id: "renda_pobreza", rotulo: "Renda confirmada pelo CadÚnico", pontos: 28, origens: ["aferido"] },
      { id: "renda_baixa", rotulo: "Renda confirmada pelo CadÚnico", pontos: 20, origens: ["aferido"] },
      { id: "cadunico_atualizado", rotulo: "Cadastro no CadÚnico em dia", pontos: 12, origens: ["aferido"] },
      // O degrau de 6 é deliberado: hoje quem deixou de atualizar perde tudo, e
      // atualização vencida é falha de acesso ao CRAS, não de vulnerabilidade.
      // É também o único convite verdadeiro e acionável que o sistema tem para
      // dar a cerca de metade da fila — ver o cartão de renda vencida.
      { id: "cadunico_vencido", rotulo: "Cadastro no CadÚnico vencido", pontos: 6, origens: ["aferido"] },
    ],
  },
  {
    numero: 2,
    nome: "Proteção e risco",
    teto: 25,
    composicao: "maior",
    graus: [
      /**
       * O grau máximo do bloco tem duas portas, e elas precisam ser dois graus
       * distintos, não um só.
       *
       * `protecao_crianca` vem da consulta à Vara da Infância, ao Conselho
       * Tutelar e ao cadastro de acolhimento. Não pode virar cartão nem linha
       * nomeada em nenhuma tela: em violência intrafamiliar, quem opera o
       * formulário pode ser a pessoa contra quem a medida foi expedida.
       *
       * `violencia_crianca` vem da resposta da família à pergunta de violência,
       * quando ela diz que a vítima é a criança. Essa a família declarou, então
       * pode e deve ser exibida com o rótulo verdadeiro — e é ela que entra em
       * "a confirmar" até um serviço público atestar.
       *
       * Fundi-las num grau só faria a declaração da família aparecer na tela
       * como "informação protegida de outro órgão", que é falso, e faria o
       * cálculo recusar a declaração, porque o grau protegido não admite origem
       * declarada. Os dois valem 25 e estão no mesmo bloco, então o teto impede
       * dupla contagem.
       */
      {
        id: "protecao_crianca",
        rotulo: "Informação protegida de outro órgão",
        pontos: 25,
        origens: ["aferido"],
        protegido: true,
      },
      {
        id: "violencia_crianca",
        rotulo: "Violência contra a criança",
        pontos: 25,
        origens: ["atestado", "declarado"],
      },
      { id: "violencia_nucleo", rotulo: "Violência no núcleo familiar", pontos: 20, origens: ["atestado", "declarado"] },
      { id: "substancias", rotulo: "Álcool ou outras drogas no núcleo", pontos: 15, origens: ["atestado", "declarado"] },
      {
        id: "privacao_responsavel",
        rotulo: "Responsável privado de liberdade",
        pontos: 10,
        origens: ["atestado", "declarado"],
      },
      /**
       * Grau que não está no documento da régua e existe por decisão de
       * desenho: a régua nova pontua apenas "responsável direto privado de
       * liberdade", e quem responder "outra pessoa da casa" receberia 0, contra
       * os 2 pontos da régua de 2025. É o único caso em que a régua nova reduz
       * a pontuação de quem hoje pontua. A suposição adotada é grau menor, não
       * zero — e a opção precisa existir de todo modo, porque o sistema tem de
       * registrar por que atribuiu o valor que atribuiu.
       */
      {
        id: "privacao_outro_membro",
        rotulo: "Outra pessoa da casa privada de liberdade",
        pontos: 4,
        origens: ["atestado", "declarado"],
      },
    ],
  },
  {
    numero: 3,
    nome: "Deficiência e saúde",
    teto: 25,
    composicao: "maior",
    graus: [
      { id: "educacao_especial", rotulo: "Criança da educação especial", pontos: 25, origens: ["aferido", "atestado"] },
      {
        id: "crianca_doenca_grave",
        rotulo: "Doença grave ou déficit nutricional da criança",
        pontos: 18,
        origens: ["aferido", "atestado", "declarado"],
      },
      {
        id: "responsavel_deficiencia",
        rotulo: "Responsável com deficiência ou doença incapacitante",
        pontos: 12,
        origens: ["aferido", "atestado", "declarado"],
      },
      {
        id: "doenca_outro_membro",
        rotulo: "Doença grave em outra pessoa da casa",
        pontos: 8,
        origens: ["atestado", "declarado"],
      },
    ],
  },
  {
    numero: 4,
    nome: "Cuidado no núcleo",
    teto: 10,
    composicao: "maior",
    graus: [
      // O grau máximo exige aferição. Sem CadÚnico o bloco zeraria por ausência
      // de fonte, e não de condição — o que reintroduziria, num bloco novo, o
      // mesmo defeito de acesso que a régua quer corrigir. Daí a pergunta
      // condicional do formulário, que dá acesso apenas ao grau de 6.
      { id: "responsavel_unico", rotulo: "Único adulto no domicílio", pontos: 10, origens: ["aferido"] },
      { id: "monoparental", rotulo: "Família monoparental", pontos: 6, origens: ["aferido", "declarado"] },
      {
        id: "responsavel_idade",
        rotulo: "Responsável único com 60 anos ou mais, ou menor de 18",
        pontos: 4,
        origens: ["aferido"],
      },
    ],
  },
  {
    numero: 5,
    nome: "Espera",
    teto: 5,
    composicao: "soma",
    graus: [
      { id: "espera_dois_processos", rotulo: "Espera há dois processos ou mais", pontos: 5, origens: ["aferido"] },
      { id: "espera_anterior", rotulo: "Esperou no processo anterior", pontos: 3, origens: ["aferido"] },
      { id: "refugiado", rotulo: "Refugiado ou solicitante de refúgio", pontos: 3, origens: ["aferido", "atestado", "declarado"] },
    ],
  },
];

/** Soma dos tetos: fecha em 100 por construção, não por coincidência. */
export const SOMA_DOS_TETOS = BLOCOS.reduce((s, b) => s + b.teto, 0);

const POR_GRAU = new Map<string, { grau: Grau; bloco: Bloco }>();
for (const bloco of BLOCOS) {
  for (const grau of bloco.graus) {
    if (POR_GRAU.has(grau.id)) throw new Error(`régua ${REGUA_VERSAO}: grau duplicado "${grau.id}".`);
    POR_GRAU.set(grau.id, { grau, bloco });
  }
}
if (SOMA_DOS_TETOS !== PONTUACAO_MAXIMA) {
  throw new Error(`régua ${REGUA_VERSAO}: tetos somam ${SOMA_DOS_TETOS}, e a escala é ${PONTUACAO_MAXIMA}.`);
}

export function grauPorId(id: string): { grau: Grau; bloco: Bloco } | undefined {
  return POR_GRAU.get(id);
}

// ────────────────────────────────────────────────────────────── cálculo

export interface ItemDeclarado {
  grau: string;
  origem: Origem;
}

export interface ItemPontuado {
  grau: string;
  rotulo: string;
  pontos: number;
  origem: Origem;
  confirmado: boolean;
  /** Perdeu para outro item do mesmo bloco: entra na tela como "não soma". */
  suprimidoPeloTeto: boolean;
  protegido: boolean;
}

export interface BlocoPontuado {
  numero: number;
  nome: string;
  teto: number;
  /** Pontos que ordenam a fila: só o que foi aferido ou atestado. */
  confirmados: number;
  /** Quanto o bloco passa a valer quando o declarado for confirmado. */
  aConfirmar: number;
  itens: ItemPontuado[];
}

export interface Pontuacao {
  /** O número que ordena a fila. */
  confirmados: number;
  /** Somado em separado, exibido em cinza, fora do número grande. */
  aConfirmar: number;
  blocos: BlocoPontuado[];
  reguaVersao: string;
  pontuacaoMaxima: number;
  /** Itens declarados que ainda precisam de comprovação, para a tela de envio. */
  pendentes: ItemPontuado[];
}

function compoe(bloco: Bloco, pontos: number[]): number {
  if (pontos.length === 0) return 0;
  const bruto = bloco.composicao === "maior" ? Math.max(...pontos) : pontos.reduce((a, b) => a + b, 0);
  return Math.min(bloco.teto, bruto);
}

/**
 * Calcula a pontuação de uma inscrição.
 *
 * `confirmados` é composto **só** com os itens de origem aferida ou atestada.
 * `aConfirmar` é a diferença entre o que o bloco valeria com tudo e o que ele
 * vale hoje — e não a soma dos declarados, porque com teto por bloco declarar
 * um item que perde para um item já confirmado não acrescenta nada.
 */
export function calcula(itens: ItemDeclarado[]): Pontuacao {
  const aceitos = itens.filter((i) => {
    const achado = POR_GRAU.get(i.grau);
    // Grau inexistente é descartado. Origem não admitida pelo grau também: é o
    // que impede uma declaração de comprar o grau de 10 do bloco 4.
    return achado !== undefined && achado.grau.origens.includes(i.origem);
  });

  /**
   * Um grau, uma linha — pela origem mais forte.
   *
   * O mesmo grau chega por dois caminhos com frequência: o SISVAN registra
   * déficit nutricional da criança *e* a família responde "sim" à pergunta de
   * doença grave, e os dois viram `crianca_doenca_grave`. Sem esta redução a
   * decomposição mostraria a mesma linha duas vezes, uma como confirmada e
   * outra como pendente — e prometeria pontos a confirmar que já estão
   * confirmados.
   */
  const FORCA: Record<Origem, number> = { aferido: 3, atestado: 2, declarado: 1 };
  const porGrau = new Map<string, ItemDeclarado>();
  for (const i of aceitos) {
    const atual = porGrau.get(i.grau);
    if (!atual || FORCA[i.origem] > FORCA[atual.origem]) porGrau.set(i.grau, i);
  }
  const validos = [...porGrau.values()];

  const blocos: BlocoPontuado[] = [];
  const pendentes: ItemPontuado[] = [];
  let confirmados = 0;
  let aConfirmar = 0;

  for (const bloco of BLOCOS) {
    const doBloco = validos
      .filter((i) => POR_GRAU.get(i.grau)!.bloco.numero === bloco.numero)
      .map((i) => ({ item: i, grau: POR_GRAU.get(i.grau)!.grau }))
      .sort((a, b) => b.grau.pontos - a.grau.pontos);

    const ehConfirmado = (o: Origem) => o !== "declarado";

    const pontosConfirmados = compoe(bloco, doBloco.filter((d) => ehConfirmado(d.item.origem)).map((d) => d.grau.pontos));
    const pontosComTudo = compoe(bloco, doBloco.map((d) => d.grau.pontos));

    // Quem "conta" no bloco: com composição por maior, é o item de maior grau
    // entre os confirmados, e o de maior grau no total para o potencial.
    const maiorConfirmado = doBloco.find((d) => ehConfirmado(d.item.origem));
    const maiorNoTotal = doBloco[0];

    const itens: ItemPontuado[] = doBloco.map((d) => {
      const confirmado = ehConfirmado(d.item.origem);
      const conta =
        bloco.composicao === "soma" ? true : confirmado ? d === maiorConfirmado : d === maiorNoTotal && !maiorConfirmado;
      const registro: ItemPontuado = {
        grau: d.grau.id,
        rotulo: d.grau.rotulo,
        pontos: d.grau.pontos,
        origem: d.item.origem,
        confirmado,
        suprimidoPeloTeto: !conta,
        protegido: Boolean(d.grau.protegido),
      };
      if (!confirmado) pendentes.push(registro);
      return registro;
    });

    confirmados += pontosConfirmados;
    aConfirmar += pontosComTudo - pontosConfirmados;

    if (itens.length > 0) {
      blocos.push({
        numero: bloco.numero,
        nome: bloco.nome,
        teto: bloco.teto,
        confirmados: pontosConfirmados,
        aConfirmar: pontosComTudo - pontosConfirmados,
        itens,
      });
    }
  }

  return {
    confirmados,
    aConfirmar,
    blocos,
    reguaVersao: REGUA_VERSAO,
    pontuacaoMaxima: PONTUACAO_MAXIMA,
    pendentes,
  };
}

// ─────────────────────────────────────────────── as perguntas que restam

/**
 * O que nenhuma base do governo responde.
 *
 * Oito dos treze critérios de 2025 — e 87 dos 100 pontos — são respondidos por
 * consulta: CadÚnico, monoparental, Bolsa Família, fila do ano anterior, irmão
 * matriculado, responsável menor de 18, educação especial, deficiência do
 * responsável. Continuar perguntando é reproduzir o processo de 2025 com
 * estética melhor.
 *
 * Sobram cinco, mais duas condicionais que só aparecem quando a base não
 * respondeu. Três delas precisam de um qualificador de **quem**, porque a régua
 * nova pede grau e o grau depende de ser a criança ou outra pessoa da casa.
 *
 * O contador honesto é "5 perguntas, até 8 toques" — o qualificador conta como
 * parte da mesma pergunta porque está na mesma tela.
 */
export interface Pergunta {
  id: string;
  /** Reescrita para pessoa, não para norma. */
  texto: string;
  /** Dado sensível: a tela precisa dizer que a resposta é protegida. */
  sensivel?: boolean;
  /**
   * Via preferencial da trilha de atestação: se um serviço público já acompanha
   * a família, ele lança no sistema e a família não leva documento.
   */
  servico?: string;
  /** Grau atribuído quando não há qualificador. */
  grau?: string;
  qualificador?: {
    pergunta: string;
    /** Nunca com pontos ao lado: seria construir a superfície de manipulação
     *  que a régua nova acabou de eliminar. */
    opcoes: { rotulo: string; grau: string }[];
    /** Para que serve, dito à família sem falar de pontuação. */
    apoio: string;
  };
  /** Só aparece quando a condição é verdadeira. */
  condicional?: "sem_bpc" | "sem_cadunico";
}

export const PERGUNTAS: Pergunta[] = [
  {
    id: "violencia",
    texto: "A criança ou alguém que convive com ela sofre violência em casa?",
    sensivel: true,
    servico: "CREAS, CRAS ou Conselho Tutelar",
    qualificador: {
      pergunta: "Quem?",
      opcoes: [
        { rotulo: "A criança", grau: "violencia_crianca" },
        { rotulo: "Outra pessoa da casa", grau: "violencia_nucleo" },
      ],
      apoio: "Isso define qual serviço vamos procurar para confirmar.",
    },
  },
  {
    id: "doenca",
    texto: "A criança ou alguém da família tem uma doença grave e de longa duração?",
    servico: "unidade de saúde da família",
    qualificador: {
      pergunta: "Quem?",
      opcoes: [
        { rotulo: "A criança", grau: "crianca_doenca_grave" },
        { rotulo: "Outra pessoa da casa", grau: "doenca_outro_membro" },
      ],
      apoio: "Isso define qual serviço vamos procurar para confirmar.",
    },
  },
  {
    id: "substancias",
    texto: "Alguém da família faz uso abusivo de álcool ou outras drogas?",
    sensivel: true,
    servico: "CAPS-AD ou CRAS",
    grau: "substancias",
  },
  {
    id: "privacao",
    texto: "Alguém da família está preso ou foi preso nos últimos 5 anos?",
    sensivel: true,
    qualificador: {
      pergunta: "Quem?",
      opcoes: [
        { rotulo: "O responsável pela criança", grau: "privacao_responsavel" },
        { rotulo: "Outra pessoa da casa", grau: "privacao_outro_membro" },
      ],
      apoio: "Isso define qual documento vamos pedir.",
    },
  },
  {
    id: "refugio",
    texto: "A criança ou você é refugiado ou pediu refúgio no Brasil?",
    grau: "refugiado",
  },
  {
    id: "responsavel_saude",
    texto: "Você tem alguma deficiência ou doença que dificulte cuidar da criança?",
    servico: "unidade de saúde da família",
    grau: "responsavel_deficiencia",
    condicional: "sem_bpc",
  },
  {
    id: "outro_adulto",
    // Invertida de propósito: a resposta que pontua é "não", e perguntar pela
    // presença do outro adulto é menos constrangedor que perguntar pela
    // ausência. O grau é o de 6 — nunca o de 10, que exige aferição.
    texto: "Você mora com outro adulto que ajuda a cuidar da criança?",
    grau: "monoparental",
    condicional: "sem_cadunico",
  },
];

/**
 * Documentos aceitos por grau.
 *
 * O catálogo mapeia documento → grau, e **isso não vai para a tela**. Dizer
 * "com medida protetiva: 25 pontos · com relatório do CREAS: 20" transformaria
 * a comprovação em compra de pontuação e mandaria a família buscar o documento
 * mais caro de obter — justamente na trilha em que a barreira documental já é o
 * problema. O único texto necessário é "serve qualquer um destes".
 */
export const DOCUMENTOS_POR_GRAU: Record<string, string[]> = {
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
  privacao_responsavel: [
    "Atestado de execução penal",
    "Alvará de soltura dos últimos 5 anos",
    "Declaração do sistema penitenciário",
  ],
  privacao_outro_membro: [
    "Atestado de execução penal",
    "Alvará de soltura dos últimos 5 anos",
    "Declaração do sistema penitenciário",
  ],
  crianca_doenca_grave: [
    "Laudo ou relatório médico com CID, assinado e com CRM",
    "Relatório de acompanhamento nutricional da rede de saúde",
  ],
  doenca_outro_membro: ["Laudo ou relatório médico com CID do familiar, assinado e com CRM"],
  responsavel_deficiencia: ["Laudo médico do responsável", "Concessão de benefício do INSS"],
  educacao_especial: ["Laudo médico", "Relatório de avaliação da equipe de educação especial"],
  refugiado: ["Protocolo de solicitação de refúgio", "Documento de refugiado reconhecido pelo CONARE"],
  monoparental: ["Certidão de nascimento da criança"],
};

// ──────────────────────────────────────────── indicadores de degradação

/**
 * O problema não foi cada régua em particular: foi não haver mecanismo para
 * detectar a degradação antes do colapso. A régua de 2021 funcionava com Bolsa
 * Família a 27% de prevalência e virou moeda ao ar a 44% — e ninguém estava
 * olhando para esse número.
 *
 * Publicar os três é o mecanismo de detecção, e é conteúdo de front, não de
 * back. Quando um deles dispara, a resposta padronizada é acrescentar **degrau
 * à escada daquele item**, nunca redistribuir os pesos da régua inteira: foi a
 * redistribuição geral que produziu as rupturas de 2024 e 2025.
 */
export interface Indicador {
  rotulo: string;
  alerta: string;
  limite: number;
  valor2025: number;
  detalhe2025: string;
  unidade: "%";
}

export const INDICADORES: Indicador[] = [
  {
    rotulo: "Maior parte da escala consumida por um único item",
    alerta: "acima de 50%",
    limite: 50,
    valor2025: 89.9,
    detalhe2025: "CadÚnico, 51 dos 100 pontos, em 48,9% da fila",
    unidade: "%",
  },
  {
    rotulo: "Maior bloco de empate acima de zero",
    alerta: "acima de 15% da fila",
    limite: 15,
    valor2025: 22.2,
    detalhe2025: "15.956 crianças empatadas em exatamente 53 pontos",
    unidade: "%",
  },
  {
    rotulo: "Prevalência de qualquer item na fila",
    alerta: "acima de 40%",
    limite: 40,
    valor2025: 48.9,
    detalhe2025: "CadÚnico em 48,9%, Bolsa Família e Cartão Carioca em 46,6%",
    unidade: "%",
  },
];

// ───────────────────────────────────── convivência das duas réguas

/**
 * Equivalente da pontuação nova na escala de 2025, para posicionar na fila.
 *
 * Existe por uma limitação da base, e não por escolha de desenho: a extração
 * anonimizada guarda a pontuação total de cada inscrição de 2025, não quais
 * critérios foram comprovados. Sem o detalhe por critério não há como
 * reclassificar as 71.949 inscrições históricas pela régua nova — é a mesma
 * ressalva que a validação da régua registra ao simular o Bloco 1 com três
 * graus aproximados.
 *
 * A âncora usada é a que as duas réguas compartilham: zero é zero, o teto é
 * 100, e o máximo de renda vale 35 na régua nova contra os 51 do CadÚnico na de
 * 2025. Entre as âncoras, interpolação linear.
 *
 * O que isso **não** é: não é reclassificação da fila histórica, e não muda a
 * ordem relativa de ninguém nela. É só a projeção de um score novo sobre uma
 * escala antiga para estimar posição — e é por isso que a posição vai à família
 * como faixa, e nunca como número cravado.
 */
export function equivalenteNaFila2025(confirmados: number): number {
  const ancoras: [number, number][] = [
    [0, 0],
    [35, 51],
    [PONTUACAO_MAXIMA, 100],
  ];
  const p = Math.max(0, Math.min(PONTUACAO_MAXIMA, confirmados));
  for (let i = 1; i < ancoras.length; i++) {
    const [x0, y0] = ancoras[i - 1];
    const [x1, y1] = ancoras[i];
    if (p <= x1) return Math.round(y0 + ((p - x0) * (y1 - y0)) / (x1 - x0));
  }
  return 100;
}
