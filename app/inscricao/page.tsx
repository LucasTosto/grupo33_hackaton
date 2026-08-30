import type { Metadata } from "next";

import { catalogo, listaDeBairros } from "@/lib/dados";

import FormularioInscricao from "./FormularioInscricao";

export const metadata: Metadata = {
  title: "Inscrição em creche · Vaga Certa",
  description:
    "Inscrição com preferência ordenada, critérios de prioridade da Resolução e resultado da classificação na hora.",
};

export default function Pagina() {
  return (
    <FormularioInscricao
      bairros={listaDeBairros()}
      criterios={[...catalogo.criterios].sort((a, b) => a.ordem - b.ordem)}
      pontuacaoMaxima={catalogo.pontuacaoMaxima}
      anoProcesso={catalogo.ano}
      maxOpcoes={5}
    />
  );
}
