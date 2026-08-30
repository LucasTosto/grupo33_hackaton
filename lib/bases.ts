/**
 * Consulta às bases do governo — a camada que substitui oito das treze
 * perguntas do formulário de 2025.
 *
 * Oito critérios da régua de 2025 são respondidos por base, e valem 87 dos 100
 * pontos: CadÚnico, monoparental, Bolsa Família, fila do processo anterior,
 * irmão matriculado, responsável menor de 18, educação especial e deficiência
 * do responsável. Perguntá-los à família é pedir que ela comprove o que o
 * próprio governo já sabe — e foi assim que 6 de cada 10 famílias que
 * declararam critério chegaram à classificação com pontuação zero.
 *
 * ⚠ **Este arquivo é simulação de protótipo, não integração.** As consultas
 * reais dependem de convênio com MDS/Dataprev (CadÚnico), Dataprev (BPC/INSS),
 * SGA/SME, SISVAN e Vara da Infância. O que está aqui são perfis derivados da
 * base anonimizada de 2025, com fonte e data de consulta declaradas como as
 * integrações reais declararão. O formato de retorno é o contrato: quando a
 * integração entrar, muda a origem do dado, não a tela.
 *
 * A régua nova degrada por campo, e não por bloco: sem `renda_per_capita` o
 * cartão de renda cai para os graus que o binário do CadÚnico permite e diz
 * "cadastro confirmado" em vez da faixa. A tela não quebra — entrega menos.
 */

import "server-only";

import { bairroCanonico, geoAproximada } from "./bairros.ts";
import { grauPorId, type ItemDeclarado, type Origem } from "./regua.ts";
import { unidades } from "./dados.ts";

// ────────────────────────────────────────────────────────────── tipos

/**
 * Estado de um cartão da tela de conferência.
 *
 * `indisponivel` existe porque base que não respondeu **não** é base que
 * respondeu "não". Tratar indisponibilidade como ausência de direito é o erro
 * mais caro que essa tela poderia cometer, e é o motivo de o estado ser cinza e
 * nunca vermelho.
 */
export type EstadoCartao = "confirmado" | "ausente" | "indisponivel" | "atencao";

export interface CartaoBase {
  id: string;
  titulo: string;
  estado: EstadoCartao;
  /** Uma a três linhas, em linguagem de gente. */
  linhas: string[];
  /** Fonte e data: é o que substitui o comprovante de papel. */
  fonte: string;
  /** Pontos do grau confirmado, quando houver. `null` em desempate e ausência. */
  pontos: number | null;
  /** `desempate` quando o critério ordena sem pontuar. */
  rotuloPontos?: string;
  /** Faixa e valor da renda ficam atrás de um toque deliberado. Nunca abertos. */
  detalhe?: { titulo: string; linhas: string[]; encaminhamento?: string };
  /** Ação concreta que a família pode tomar agora. */
  acao?: { rotulo: string; tipo: "cras" | "laudo" | "contestar" };
  /** O cartão aceita contestação? A exceção é a informação protegida. */
  contestavel: boolean;
}

export interface Crianca {
  nome: string;
  nascimento: string;
  /** `yyyy-MM`, que é o recorte que o motor usa. */
  nascimentoMes: string;
  /** `false` quando o CPF não consta como filiação: não bloqueia, só marca. */
  vinculoConfirmado: boolean;
}

export interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  /** A distância sai do centro da região, e não da casa. A tela diz isso. */
  geoAproximada: boolean;
}

export interface Consulta {
  cpf: string;
  crianca: Crianca;
  endereco: Endereco | null;
  cartoes: CartaoBase[];
  /** Itens de régua que a consulta confirmou, com origem. */
  itens: ItemDeclarado[];
  /** Bases que não responderam: disparam as perguntas condicionais. */
  semBpc: boolean;
  semCadunico: boolean;
  /** Bases consultadas com sucesso, para o contador ao vivo da tela. */
  consultadas: number;
  totalDeBases: number;
  /** Selo da demonstração: o que este perfil serve para provar. */
  selo: string;
  /** Irmão matriculado: desempate, não pontuação. */
  irmao: { nome: string; unidade: string } | null;
}

// ────────────────────────────────────────────────────────── os perfis

interface Perfil {
  cpf: string;
  selo: string;
  nomeResponsavel: string;
  crianca: Crianca;
  endereco: Endereco;
  cadunico:
    | { estado: "ativo"; rendaPerCapita: number; atualizadoEm: string; adultosNoDomicilio: number; monoparental: boolean }
    | { estado: "vencido"; rendaPerCapita: number; atualizadoEm: string; adultosNoDomicilio: number; monoparental: boolean }
    | { estado: "sem_cadastro" }
    | { estado: "indisponivel" };
  bpc: { estado: "concedido"; alvo: "crianca" | "responsavel" } | { estado: "sem_registro" } | { estado: "indisponivel" };
  educacaoEspecial: boolean;
  sisvan: { estado: "deficit" } | { estado: "sem_registro" } | { estado: "indisponivel" };
  irmao: { nome: string; unidade: string } | null;
  responsavelMenor18: boolean;
  responsavel60mais: boolean;
  processosEmEspera: number;
  /**
   * Consultada sem consentimento do responsável, e nunca exibida no fluxo da
   * família: quem opera o formulário pode ser a pessoa contra quem a medida foi
   * expedida.
   */
  medidaProtetiva: boolean;
}

/**
 * Perfis da demonstração, cada um com o que serve para provar.
 *
 * Derivados de casos reais da base anonimizada de 2025. O CPF é fictício e o
 * dígito verificador é válido, para que a validação do formulário seja a mesma
 * que roda em produção.
 */
const PERFIS: Perfil[] = [
  {
    cpf: "12345678909",
    selo: "CadÚnico ativo · nenhuma pergunta necessária",
    nomeResponsavel: "ANA P. DA SILVA",
    crianca: {
      nome: "MARIA S. DA SILVA",
      nascimento: "14/07/2023",
      nascimentoMes: "2023-07",
      vinculoConfirmado: true,
    },
    endereco: {
      cep: "20735-030",
      logradouro: "Rua Silva Xavier, 120",
      numero: "120",
      bairro: "Engenho Novo",
      geoAproximada: false,
    },
    cadunico: { estado: "ativo", rendaPerCapita: 94, atualizadoEm: "12/03/2024", adultosNoDomicilio: 1, monoparental: true },
    bpc: { estado: "sem_registro" },
    educacaoEspecial: false,
    sisvan: { estado: "sem_registro" },
    irmao: { nome: "João", unidade: "EDI Ladeira dos Funcionários" },
    responsavelMenor18: false,
    responsavel60mais: false,
    processosEmEspera: 1,
    medidaProtetiva: false,
  },
  {
    cpf: "98765432100",
    selo: "Cadastro vencido · o que fazer, onde, e quanto muda",
    nomeResponsavel: "ROSANGELA M. COSTA",
    crianca: {
      nome: "PEDRO H. COSTA",
      nascimento: "02/11/2023",
      nascimentoMes: "2023-11",
      vinculoConfirmado: true,
    },
    endereco: {
      cep: "21051-000",
      logradouro: "Rua Leopoldina Rego, 450",
      numero: "450",
      bairro: "Olaria",
      geoAproximada: false,
    },
    cadunico: {
      estado: "vencido",
      rendaPerCapita: 180,
      atualizadoEm: "03/2023",
      adultosNoDomicilio: 2,
      monoparental: false,
    },
    bpc: { estado: "sem_registro" },
    educacaoEspecial: false,
    sisvan: { estado: "indisponivel" },
    irmao: null,
    responsavelMenor18: false,
    responsavel60mais: false,
    processosEmEspera: 0,
    medidaProtetiva: false,
  },
  {
    cpf: "11144477735",
    selo: "Sem nenhum critério · a inscrição continua válida",
    nomeResponsavel: "CARLOS E. FERREIRA",
    crianca: {
      nome: "LUIZA F. FERREIRA",
      nascimento: "20/01/2024",
      nascimentoMes: "2024-01",
      vinculoConfirmado: true,
    },
    endereco: {
      cep: "22775-036",
      logradouro: "Estrada dos Bandeirantes, 3200",
      numero: "3200",
      bairro: "Jacarepaguá",
      geoAproximada: false,
    },
    cadunico: { estado: "sem_cadastro" },
    bpc: { estado: "sem_registro" },
    educacaoEspecial: false,
    sisvan: { estado: "sem_registro" },
    irmao: null,
    responsavelMenor18: false,
    responsavel60mais: false,
    processosEmEspera: 0,
    medidaProtetiva: false,
  },
  {
    cpf: "52998224725",
    selo: "Risco agudo sem cadastro · o caso que a régua de 2025 invertia",
    nomeResponsavel: "JOSEFA R. DOS SANTOS",
    crianca: {
      nome: "ANTONIO R. DOS SANTOS",
      nascimento: "08/05/2023",
      nascimentoMes: "2023-05",
      vinculoConfirmado: false,
    },
    endereco: {
      cep: "22450-000",
      logradouro: "Rua 1, s/n",
      numero: "s/n",
      bairro: "Rocinha",
      geoAproximada: true,
    },
    cadunico: { estado: "sem_cadastro" },
    bpc: { estado: "indisponivel" },
    educacaoEspecial: false,
    sisvan: { estado: "deficit" },
    irmao: null,
    responsavelMenor18: false,
    responsavel60mais: true,
    processosEmEspera: 2,
    medidaProtetiva: true,
  },
  {
    cpf: "39053344705",
    selo: "Educação especial confirmada pelo INSS",
    nomeResponsavel: "MARCIA L. ALVES",
    crianca: {
      nome: "SOFIA L. ALVES",
      nascimento: "30/09/2023",
      nascimentoMes: "2023-09",
      vinculoConfirmado: true,
    },
    endereco: {
      cep: "20970-030",
      logradouro: "Rua Ana Néri, 88",
      numero: "88",
      bairro: "Rocha",
      geoAproximada: false,
    },
    cadunico: {
      estado: "ativo",
      rendaPerCapita: 260,
      atualizadoEm: "07/01/2026",
      adultosNoDomicilio: 2,
      monoparental: false,
    },
    bpc: { estado: "concedido", alvo: "crianca" },
    educacaoEspecial: true,
    sisvan: { estado: "sem_registro" },
    irmao: null,
    responsavelMenor18: false,
    responsavel60mais: false,
    processosEmEspera: 1,
    medidaProtetiva: false,
  },
];

export interface PerfilPublico {
  cpf: string;
  selo: string;
  responsavel: string;
  crianca: string;
}

/** O que a tela de identificação mostra. Nunca a pontuação nem o conteúdo. */
export function perfisDaDemonstracao(): PerfilPublico[] {
  return PERFIS.map((p) => ({
    cpf: p.cpf,
    selo: p.selo,
    responsavel: p.nomeResponsavel,
    crianca: p.crianca.nome,
  }));
}

// ────────────────────────────────────────────────────────────── CPF

/** Dígito verificador do CPF. A mesma validação que roda em produção. */
export function cpfValido(bruto: string): boolean {
  const d = bruto.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const [tamanho, posicao] of [
    [9, 10],
    [10, 11],
  ]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (posicao - i);
    const resto = (soma * 10) % 11;
    if ((resto === 10 ? 0 : resto) !== Number(d[tamanho])) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────── faixa de renda

/**
 * Grau de renda a partir da renda per capita e da data do cadastro.
 *
 * Os cortes são os do Cadastro Único: extrema pobreza até R$ 109, pobreza até
 * R$ 218, baixa renda até meio salário mínimo per capita. Ficam aqui, e não na
 * régua, porque são parâmetro de política federal e mudam por decreto — a régua
 * declara o grau, esta função diz em qual a família cai.
 */
const MEIO_SALARIO_MINIMO = 759;

function grauDeRenda(rendaPerCapita: number): string {
  if (rendaPerCapita <= 109) return "renda_extrema";
  if (rendaPerCapita <= 218) return "renda_pobreza";
  if (rendaPerCapita <= MEIO_SALARIO_MINIMO) return "renda_baixa";
  return "cadunico_atualizado";
}

function pontosDe(grauId: string): number {
  return grauPorId(grauId)?.grau.pontos ?? 0;
}

// ──────────────────────────────────────────────────────────── consulta

function agora(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const HOJE = () => `consultado hoje às ${agora()}`;

/**
 * Consulta as bases para um CPF.
 *
 * Cada cartão traz fonte e data porque é isso que substitui o comprovante de
 * papel — e porque a família precisa poder discordar de algo que tem origem
 * nomeada. `Isto está errado` abre contestação, que vai para análise humana e
 * **não** muda a pontuação na hora: o caminho padrão é a base, e a palavra da
 * família é a exceção que precisa de prova.
 */
export function consultaBases(cpfBruto: string): Consulta | null {
  const cpf = cpfBruto.replace(/\D/g, "");
  const p = PERFIS.find((x) => x.cpf === cpf);
  if (!p) return null;

  const cartoes: CartaoBase[] = [];
  const itens: ItemDeclarado[] = [];
  const aferido: Origem = "aferido";
  let consultadas = 0;

  // ── 1. renda ────────────────────────────────────────────────────────
  if (p.cadunico.estado === "ativo" || p.cadunico.estado === "vencido") {
    consultadas++;
    const vencido = p.cadunico.estado === "vencido";
    const grau = vencido ? "cadunico_vencido" : grauDeRenda(p.cadunico.rendaPerCapita);
    itens.push({ grau, origem: aferido });
    cartoes.push({
      id: "renda",
      titulo: "Renda",
      estado: vencido ? "atencao" : "confirmado",
      linhas: vencido
        ? [
            `Seu cadastro no CadÚnico está vencido desde ${p.cadunico.atualizadoEm}.`,
            `Por ele, você tem ${pontosDe(grau)} pontos. Atualizando no CRAS, pode chegar a até ${pontosDe("renda_extrema")}.`,
            "Sua inscrição continua valendo. Se você atualizar antes de sair a vaga, a pontuação é recalculada automaticamente.",
          ]
        : ["Confirmada pelo CadÚnico.", `Cadastro atualizado em ${p.cadunico.atualizadoEm}.`],
      fonte: `CECAD/Dataprev · ${HOJE()}`,
      pontos: pontosDe(grau),
      // A faixa e o valor ficam atrás de um toque. Carimbar "extrema pobreza"
      // na tela não acrescenta nada à decisão que a pessoa está tomando ali, e
      // no polo a tela é vista pelo servidor e por quem está na fila atrás.
      detalhe: {
        titulo: "Detalhe do cadastro",
        linhas: [
          `Renda por pessoa registrada: R$ ${p.cadunico.rendaPerCapita.toLocaleString("pt-BR")}`,
          `Cadastro atualizado em ${p.cadunico.atualizadoEm}`,
          `Pessoas no domicílio maiores de 18 anos: ${p.cadunico.adultosNoDomicilio}`,
        ],
        encaminhamento:
          "Este dado vem do seu cadastro no CRAS. Para corrigir, procure o CRAS — a Prefeitura não altera o CadÚnico.",
      },
      acao: vencido ? { rotulo: "Ver CRAS perto de mim", tipo: "cras" } : undefined,
      contestavel: true,
    });
  } else if (p.cadunico.estado === "sem_cadastro") {
    consultadas++;
    cartoes.push({
      id: "renda",
      titulo: "Renda",
      estado: "atencao",
      linhas: [
        "Você não tem cadastro no CadÚnico.",
        `Por isso, a renda não soma pontos agora. Com o cadastro feito no CRAS, pode chegar a até ${pontosDe("renda_extrema")}.`,
        "Sua inscrição continua valendo. Se você se cadastrar antes de sair a vaga, a pontuação é recalculada automaticamente.",
      ],
      fonte: `CECAD/Dataprev · ${HOJE()}`,
      pontos: 0,
      acao: { rotulo: "Ver CRAS perto de mim", tipo: "cras" },
      contestavel: true,
    });
  } else {
    cartoes.push({
      id: "renda",
      titulo: "Renda",
      estado: "indisponivel",
      linhas: [
        "O sistema do CadÚnico não respondeu agora.",
        "Vamos tentar de novo automaticamente e avisar você. Isso não reduz a sua pontuação.",
      ],
      fonte: "CECAD/Dataprev",
      pontos: null,
      contestavel: false,
    });
  }

  // ── 2. cuidado no núcleo ────────────────────────────────────────────
  if (p.cadunico.estado === "ativo" || p.cadunico.estado === "vencido") {
    consultadas++;
    const unico = p.cadunico.adultosNoDomicilio <= 1;
    const grau = unico
      ? "responsavel_unico"
      : p.cadunico.monoparental
        ? "monoparental"
        : p.responsavelMenor18 || p.responsavel60mais
          ? "responsavel_idade"
          : null;
    if (grau) itens.push({ grau, origem: aferido });
    cartoes.push({
      id: "cuidado",
      titulo: "Cuidado no núcleo",
      estado: grau ? "confirmado" : "ausente",
      linhas: grau
        ? [
            unico
              ? "Você é o único adulto no domicílio."
              : p.cadunico.monoparental
                ? "A criança vive em família monoparental."
                : "Você é responsável único e está na faixa de idade que o critério considera.",
          ]
        : ["Não há na composição familiar situação que some pontos neste grupo."],
      fonte: `Composição familiar do CadÚnico · ${HOJE()}`,
      pontos: grau ? pontosDe(grau) : null,
      contestavel: true,
    });
  }

  // ── 3. deficiência e saúde ──────────────────────────────────────────
  const bpcIndisponivel = p.bpc.estado === "indisponivel";
  if (!bpcIndisponivel) consultadas++;
  let grauSaude: string | null = null;
  if (p.educacaoEspecial || (p.bpc.estado === "concedido" && p.bpc.alvo === "crianca")) {
    grauSaude = "educacao_especial";
  } else if (p.sisvan.estado === "deficit") {
    grauSaude = "crianca_doenca_grave";
  } else if (p.bpc.estado === "concedido" && p.bpc.alvo === "responsavel") {
    grauSaude = "responsavel_deficiencia";
  }
  if (grauSaude) itens.push({ grau: grauSaude, origem: aferido });
  cartoes.push({
    id: "saude",
    titulo: "Deficiência e saúde",
    estado: bpcIndisponivel && !grauSaude ? "indisponivel" : grauSaude ? "confirmado" : "ausente",
    linhas: grauSaude
      ? grauSaude === "educacao_especial"
        ? ["A criança é público-alvo da educação especial."]
        : grauSaude === "crianca_doenca_grave"
          ? ["A rede de saúde registra acompanhamento nutricional da criança."]
          : ["Você tem benefício por deficiência concedido."]
      : bpcIndisponivel
        ? ["O sistema do INSS não respondeu agora.", "Vamos tentar de novo. Se houver laudo, você pode informar."]
        : ["Não encontramos registro."],
    fonte: bpcIndisponivel
      ? "INSS/BPC · rede SME · SISVAN"
      : `INSS/BPC · rede SME · SISVAN · ${HOJE()}`,
    pontos: grauSaude ? pontosDe(grauSaude) : null,
    acao: grauSaude ? undefined : { rotulo: "A criança tem laudo — quero informar", tipo: "laudo" },
    contestavel: !bpcIndisponivel,
  });

  // ── 4. espera ───────────────────────────────────────────────────────
  consultadas++;
  const grauEspera =
    p.processosEmEspera >= 2 ? "espera_dois_processos" : p.processosEmEspera === 1 ? "espera_anterior" : null;
  if (grauEspera) itens.push({ grau: grauEspera, origem: aferido });
  cartoes.push({
    id: "espera",
    titulo: "Espera",
    estado: grauEspera ? "confirmado" : "ausente",
    linhas: grauEspera
      ? [
          p.processosEmEspera >= 2
            ? `Você aguardou vaga em ${p.processosEmEspera} processos anteriores.`
            : "Você aguardou vaga no processo anterior.",
        ]
      : ["Esta é a sua primeira inscrição neste processo."],
    fonte: `Histórico da inscrição · ${HOJE()}`,
    pontos: grauEspera ? pontosDe(grauEspera) : null,
    contestavel: true,
  });

  // ── 5. irmão matriculado: desempate, não pontuação ──────────────────
  consultadas++;
  cartoes.push({
    id: "irmao",
    titulo: "Irmão na rede",
    estado: p.irmao ? "confirmado" : "ausente",
    linhas: p.irmao ? [`${p.irmao.nome}, ${p.irmao.unidade}.`] : ["Não encontramos irmão matriculado na rede."],
    fonte: `Sistema de Gestão Acadêmica · ${HOJE()}`,
    pontos: null,
    rotuloPontos: p.irmao ? "desempate" : undefined,
    contestavel: true,
  });

  // ── 6. medida protetiva: consultada, nunca exibida ──────────────────
  //
  // O ponto entra no score e a tela da pontuação mostra uma linha neutra, sem
  // nome de órgão, sem data e sem contestação. Não há cartão aqui de propósito:
  // exibir "consta medida protetiva em favor de ANTONIO" entregaria a
  // informação exatamente a quem não deve tê-la. A exceção à regra de "toda
  // origem é auditável pelo usuário" está declarada, para que ninguém a
  // "conserte" depois por consistência.
  consultadas++;
  if (p.medidaProtetiva) itens.push({ grau: "protecao_crianca", origem: aferido });

  return {
    cpf,
    crianca: p.crianca,
    endereco: { ...p.endereco, geoAproximada: geoAproximada(p.endereco.bairro) || p.endereco.geoAproximada },
    cartoes,
    itens,
    semBpc: p.bpc.estado !== "concedido",
    semCadunico: p.cadunico.estado === "sem_cadastro" || p.cadunico.estado === "indisponivel",
    consultadas,
    totalDeBases: 6,
    selo: p.selo,
    irmao: p.irmao,
  };
}

// ───────────────────────────────────────────────────────────────── CEP

/**
 * Endereço a partir do CEP.
 *
 * ⚠ Simulação de protótipo. A consulta real é ao serviço de CEP dos Correios ou
 * ao cadastro de logradouros do município; aqui o CEP é resolvido de forma
 * determinística contra o cadastro de unidades, que é a única fonte de
 * logradouro e bairro reais que o projeto tem. O contrato de retorno é o mesmo.
 *
 * O bairro é **sempre leitura, derivado do CEP** — nunca lista, nunca texto
 * livre. O seletor de bairro só aparece quando o CEP não resolve, e aí com a
 * lista canônica.
 */
export function enderecoPorCep(cepBruto: string, numero: string): Endereco | null {
  const cep = cepBruto.replace(/\D/g, "");
  if (cep.length !== 8) return null;

  // Perfis primeiro: o CEP do perfil resolve no endereço do perfil.
  const perfil = PERFIS.find((p) => p.endereco.cep.replace(/\D/g, "") === cep);
  if (perfil) {
    return { ...perfil.endereco, numero: numero || perfil.endereco.numero };
  }

  // Faixa de CEP do município do Rio de Janeiro. Fora dela o protótipo devolve
  // "não encontrado" em vez de inventar um endereço — e é o que faz aparecer o
  // seletor de bairro com a lista canônica, que é o caminho de recuperação.
  const prefixo = Number(cep.slice(0, 5));
  if (prefixo < 20000 || prefixo > 23799) return null;

  const comEndereco = unidades.filter((u) => u.rua && bairroCanonico(u.bairro));
  if (comEndereco.length === 0) return null;
  let h = 0;
  for (const c of cep) h = (h * 31 + Number(c)) % comEndereco.length;
  const u = comEndereco[h];
  const bairro = bairroCanonico(u.bairro) as string;
  // O cadastro de unidades traz complemento no mesmo campo do logradouro
  // ("RUA BYRON, 239, QUADRA 10, LOTE 16"). Só a via interessa aqui.
  const via = (u.rua as string).split(",")[0].replace(/\s+/g, " ").trim();
  return {
    cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
    logradouro: via,
    numero: numero || "s/n",
    bairro,
    geoAproximada: geoAproximada(bairro),
  };
}
