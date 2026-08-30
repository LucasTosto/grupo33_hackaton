import type { Metadata } from "next";

import { listaDeBairros, MAX_OPCOES, parametros, USA_PROXIMIDADE } from "@/lib/dados";

import FormularioInscricao from "./FormularioInscricao";

export const metadata: Metadata = {
  title: "Inscrição em creche · Vaga Certa",
  description:
    "Inscrição em creche da rede municipal do Rio: os dados que o governo já tem vêm preenchidos, a pontuação aparece antes da escolha das creches, e a posição na fila é visível.",
};

export default function Pagina() {
  return (
    <FormularioInscricao
      bairros={listaDeBairros()}
      anoProcesso={2025}
      maxOpcoes={MAX_OPCOES}
      listaDeEspera={parametros.listaDeEspera}
      posicaoAoVivo={parametros.posicaoAoVivo}
      usaProximidade={USA_PROXIMIDADE}
    />
  );
}
