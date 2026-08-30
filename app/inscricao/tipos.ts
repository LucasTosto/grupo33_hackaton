/**
 * Contratos entre o formulário e as rotas de API.
 *
 * Ficam num arquivo só porque a tela da pontuação e a tela de revisão renderizam
 * a decomposição vinda do servidor sem recalcular nada: recalcular a régua no
 * cliente convidaria a divergência entre o número que a família vê e o número
 * que ordena a fila.
 */

import type { Pontuacao } from "@/lib/regua";

export interface UnidadeEscolha {
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
  geoAproximada: boolean;
  aFrente: number | null;
  chance: "alta" | "media" | "longa" | null;
  aFrenteSeComprovar: number | null;
}

export interface PosicaoNaFila {
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

export interface Resumo {
  protocolo: string;
  pontuacao: Pontuacao;
  pontos: number;
  pontuacaoMaxima: number;
  reguaVersao: string;
  reguaVigenciaProcessos: number;
  desempates: number[];
  semCriterio: boolean;
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

export interface Comprovacao {
  grau: string;
  rotulo: string;
  bloco: string;
  documentos: string[];
  estado: "falta_enviar" | "recebido" | "em_analise" | "confirmado";
}

export interface RespostaInscricao {
  inscricao: {
    protocolo: string;
    grupamento: string;
    horario: string;
    opcoes: number[];
    bairro: string | null;
    opcaoMantida?: number;
    aceitaOutroTurno: boolean;
    contato: { celular: string; whatsapp: boolean; canal: string };
  };
  resumo: Resumo;
  comprovacoes: Comprovacao[];
  regua: { versao: string; vigenciaProcessos: number };
}

// ─────────────────────────────────────────────── consulta às bases

export type EstadoCartao = "confirmado" | "ausente" | "indisponivel" | "atencao";

export interface CartaoBase {
  id: string;
  titulo: string;
  estado: EstadoCartao;
  linhas: string[];
  fonte: string;
  pontos: number | null;
  rotuloPontos?: string;
  detalhe?: { titulo: string; linhas: string[]; encaminhamento?: string };
  acao?: { rotulo: string; tipo: "cras" | "laudo" | "contestar" };
  contestavel: boolean;
}

export interface Consulta {
  cpf: string;
  crianca: { nome: string; nascimento: string; nascimentoMes: string; vinculoConfirmado: boolean };
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    geoAproximada: boolean;
  } | null;
  cartoes: CartaoBase[];
  itens: { grau: string; origem: "aferido" | "atestado" | "declarado" }[];
  semBpc: boolean;
  semCadunico: boolean;
  consultadas: number;
  totalDeBases: number;
  selo: string;
  irmao: { nome: string; unidade: string } | null;
}

export interface PerfilPublico {
  cpf: string;
  selo: string;
  responsavel: string;
  crianca: string;
}
