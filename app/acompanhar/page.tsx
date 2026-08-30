import type { Metadata } from "next";

import Acompanhamento from "./Acompanhamento";

export const metadata: Metadata = {
  title: "Acompanhar inscrição · Vaga Certa",
  description: "Posição na fila, convite e fila de melhoria da sua inscrição em creche.",
};

export default function Pagina() {
  return <Acompanhamento />;
}
