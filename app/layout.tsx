import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vaga Certa · Inscrição em creche · SME Rio",
  description:
    "Inscrição em creche da rede municipal do Rio de Janeiro com um convite por criança, posição na fila visível e classificação auditável.",
};

/** Rótulos em versal, como na navegação do matricula.rio. */
const NAV = [
  { href: "/", rotulo: "Início" },
  { href: "/inscricao", rotulo: "Inscrição" },
  { href: "/acompanhar", rotulo: "Consulta inscrição" },
  { href: "/painel", rotulo: "Painel da rede" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,900&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-azul focus:px-4 focus:py-2 focus:text-white"
        >
          Ir para o conteúdo
        </a>

        {/* ── barra utilitária: liga o serviço ao portal da Prefeitura ── */}
        <div className="bg-azul-escuro text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-1.5">
            <a
              href="https://prefeitura.rio"
              rel="noreferrer noopener"
              target="_blank"
              className="text-[11.5px] font-bold tracking-[0.08em] uppercase underline-offset-2 hover:underline"
            >
              Prefeitura.rio
            </a>
            <p className="text-[11.5px] text-white/70">Compatível com leitores de tela</p>
          </div>
        </div>

        {/* ── assinatura institucional ── */}
        <header className="border-b-4 border-azul-claro bg-azul text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
            {/* Marca reduzida a tipografia: o brasão oficial não é nosso para usar. */}
            <div className="border-r border-white/25 pr-5">
              <p className="text-[10.5px] font-medium tracking-[0.14em] uppercase text-white/75">
                Prefeitura do Rio de Janeiro
              </p>
              <p className="text-[15px] font-bold tracking-[-0.01em]">Secretaria Municipal de Educação</p>
            </div>
            <div>
              <Link href="/" className="block">
                <span className="block text-[22px] font-black tracking-[-0.03em] uppercase leading-none">
                  Vaga Certa
                </span>
                <span className="mt-0.5 block text-[12px] text-azul-claro">
                  Inscrição em creche · Processo 195/2025
                </span>
              </Link>
            </div>
          </div>
        </header>

        {/* ── navegação ── */}
        <nav aria-label="Navegação principal" className="border-b border-linha bg-white">
          <div className="mx-auto max-w-6xl px-5">
            <ul className="flex flex-wrap">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className="block border-b-[3px] border-transparent px-4 py-3.5 text-[12.5px] font-bold tracking-[0.06em] uppercase text-azul transition hover:border-azul-claro hover:bg-azul-10"
                  >
                    {n.rotulo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <main id="conteudo">{children}</main>

        {/* ── rodapé institucional ── */}
        <footer className="mt-16 border-t-4 border-azul-claro bg-azul text-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-3">
            <div>
              <p className="text-[10.5px] font-medium tracking-[0.14em] uppercase text-white/70">
                Prefeitura do Rio de Janeiro
              </p>
              <p className="mt-1 text-[15px] font-bold">Secretaria Municipal de Educação</p>
              <p className="mt-3 text-[13.5px] leading-relaxed text-white/80">
                Rua Afonso Cavalcanti, 455 — Cidade Nova
                <br />
                Rio de Janeiro · RJ
              </p>
            </div>

            <div>
              <p className="text-[11.5px] font-bold tracking-[0.08em] uppercase text-azul-claro">
                Serviços relacionados
              </p>
              <ul className="mt-3 space-y-1.5 text-[13.5px]">
                <li>
                  <a
                    className="underline-offset-2 hover:underline"
                    href="https://matricula.rio"
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    matricula.rio
                  </a>
                </li>
                <li>
                  <a
                    className="underline-offset-2 hover:underline"
                    href="https://educacao.prefeitura.rio"
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    educacao.prefeitura.rio
                  </a>
                </li>
                <li>
                  <a
                    className="underline-offset-2 hover:underline"
                    href="https://prefeitura.rio"
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    prefeitura.rio
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[11.5px] font-bold tracking-[0.08em] uppercase text-azul-claro">
                Sobre este protótipo
              </p>
              <p className="mt-3 text-[13.5px] leading-relaxed text-white/80">
                Construído no Claude Impact Lab Rio a partir das bases públicas anonimizadas da SME.{" "}
                <strong className="font-bold text-white">Não é um canal oficial de inscrição</strong> — a
                inscrição válida é feita no matricula.rio.
              </p>
              <p className="mt-3 text-[12px] text-white/60">
                Dados: CIT-SME-RJ/dadoscreche · processo 195 · 71.949 inscrições
              </p>
            </div>
          </div>

          <div className="border-t border-white/15">
            <div className="mx-auto max-w-6xl px-5 py-3.5">
              <p className="text-[11.5px] text-white/60">
                Identidade visual conforme o Manual de Marca Prefeitura Rio 2025. Tipografia oficial Cera Pro
                substituída por DM Sans, por ser fonte comercial não redistribuível.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
