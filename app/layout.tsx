import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vaga Certa · Inscrição em creche · SME Rio",
  description:
    "Inscrição em creche da rede municipal do Rio de Janeiro com um convite por criança, posição na fila visível e classificação auditável.",
};

const NAV = [
  { href: "/inscricao", rotulo: "Inscrição" },
  { href: "/acompanhar", rotulo: "Acompanhar" },
  { href: "/painel", rotulo: "Painel da rede" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-surface"
        >
          Pular para o conteúdo
        </a>

        <header className="border-b border-rule bg-surface">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
            <Link href="/" className="font-display text-[17px] font-extrabold tracking-tight">
              Vaga Certa
              <span className="ml-2 rotulo font-normal">SME Rio</span>
            </Link>
            <nav className="ml-auto flex gap-5 font-mono text-[12px] tracking-wide">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-ink-2 underline-offset-4 hover:underline">
                  {n.rotulo}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main id="conteudo">{children}</main>

        <footer className="mt-24 border-t border-rule bg-surface">
          <div className="mx-auto max-w-5xl px-5 py-10 text-[13.5px] text-ink-2">
            <p className="mb-3 max-w-[62ch]">
              Protótipo construído no Claude Impact Lab Rio a partir das bases públicas anonimizadas da
              Secretaria Municipal de Educação. Não é um canal oficial de inscrição: a inscrição válida é
              feita no{" "}
              <a
                className="underline decoration-rule underline-offset-2"
                href="https://matricula.rio"
                rel="noreferrer noopener"
                target="_blank"
              >
                matricula.rio
              </a>
              .
            </p>
            <p className="rotulo">
              Dados: CIT-SME-RJ/dadoscreche · processo 195 (2025) · 71.949 inscrições
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
