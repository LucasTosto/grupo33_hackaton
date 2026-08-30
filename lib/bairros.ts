/**
 * Lista canônica de bairros e dicionário de normalização.
 *
 * A base do processo traz 1.607 valores distintos de bairro para 164 bairros
 * oficiais: mesma grafia em caixa alta e baixa, sub-localidade no lugar do
 * bairro (`Andaraí - Morro do Andaraí`), conjunto habitacional
 * (`Conj. Hab. Amarelinho - Irajá`) e mistura de bairro com Região
 * Administrativa (`FREGUESIA (ILHA DO GOV.)`).
 *
 * Esse ruído estava vazando para a interface: o seletor de bairro do formulário
 * listava as variações cruas, o mesmo bairro aparecia 2 a 4 vezes e a família
 * não tinha como saber qual era "a certa" — num campo que decide o desempate
 * por proximidade. Errar a variante mudava a classificação da criança, em
 * silêncio. Este arquivo é o dicionário que fica no servidor para que isso não
 * aconteça: o usuário vê cada bairro uma vez, no nome oficial.
 *
 * Sem import interno de propósito: roda sob o type-stripping do Node nos testes
 * e é o mesmo código que o Next executa.
 */

// ─────────────────────────────────────────────────────────── normalização

/** Caixa alta, sem acento, sem pontuação, espaço único. Chave de comparação. */
export function chaveBairro(bruto: string): string {
  return bruto
    .normalize("NFD")
    .replace(RegExp("[\u0300-\u036f]", "g"), "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Bairros oficiais do município, na grafia de exibição.
 *
 * Fonte: divisão de bairros do Instituto Pereira Passos. As duas Freguesias
 * ficam qualificadas porque são bairros distintos de mesmo nome — é justamente
 * a ambiguidade que a base resolvia mal, misturando bairro e RA.
 */
export const BAIRROS_OFICIAIS: string[] = [
  // ── Centro e adjacências
  "Benfica", "Caju", "Catete", "Catumbi", "Centro", "Cidade Nova", "Estácio", "Gamboa",
  "Glória", "Lapa", "Mangueira", "Paquetá", "Praça da Bandeira", "Rio Comprido",
  "Santa Teresa", "Santo Cristo", "São Cristóvão", "Saúde", "Vasco da Gama",
  // ── Zona Sul
  "Botafogo", "Copacabana", "Cosme Velho", "Flamengo", "Gávea", "Humaitá",
  "Ipanema", "Jardim Botânico", "Lagoa", "Laranjeiras", "Leblon", "Leme",
  "Rocinha", "São Conrado", "Urca", "Vidigal",
  // ── Zona Norte
  "Abolição", "Acari", "Água Santa", "Alto da Boa Vista", "Anchieta", "Andaraí",
  "Barros Filho", "Bento Ribeiro", "Bonsucesso", "Brás de Pina", "Cachambi",
  "Campinho", "Cascadura", "Cavalcanti", "Coelho Neto", "Colégio",
  "Complexo do Alemão", "Cordovil", "Costa Barros", "Del Castilho", "Encantado",
  "Engenheiro Leal", "Engenho da Rainha", "Engenho de Dentro", "Engenho Novo",
  "Grajaú", "Guadalupe", "Higienópolis", "Honório Gurgel", "Inhaúma", "Irajá",
  "Jacaré", "Jacarezinho", "Jardim América", "Lins de Vasconcelos", "Madureira",
  "Manguinhos", "Maracanã", "Maré", "Marechal Hermes", "Maria da Graça",
  "Méier", "Olaria", "Osvaldo Cruz", "Parada de Lucas", "Parque Anchieta",
  "Parque Colúmbia", "Pavuna", "Penha", "Penha Circular", "Piedade", "Pilares",
  "Quintino Bocaiúva", "Ramos", "Riachuelo", "Ricardo de Albuquerque", "Rocha",
  "Rocha Miranda", "Sampaio", "São Francisco Xavier", "Tijuca",
  "Todos os Santos", "Tomás Coelho", "Triagem", "Turiaçu", "Vaz Lobo",
  "Vicente de Carvalho", "Vigário Geral", "Vila da Penha", "Vila Isabel",
  "Vila Kosmos", "Vista Alegre",
  // ── Ilha do Governador e Paquetá
  "Bancários", "Cacuia", "Cidade Universitária", "Cocotá",
  "Freguesia (Ilha do Governador)", "Galeão", "Jardim Carioca",
  "Jardim Guanabara", "Moneró", "Pitangueiras", "Portuguesa",
  "Praia da Bandeira", "Ribeira", "Tauá", "Zumbi", "Ilha do Governador",
  // ── Zona Oeste
  "Anil", "Bangu", "Barra da Tijuca", "Barra de Guaratiba", "Camorim",
  "Campo dos Afonsos", "Campo Grande", "Cidade de Deus", "Cosmos", "Curicica",
  "Deodoro", "Freguesia (Jacarepaguá)", "Gardênia Azul", "Gericinó", "Grumari",
  "Guaratiba", "Inhoaíba", "Itanhangá", "Jabour", "Jacarepaguá",
  "Jardim Sulacap", "Joá", "Magalhães Bastos", "Mato Alto", "Paciência",
  "Padre Miguel", "Pechincha", "Pedra de Guaratiba", "Praça Seca", "Realengo",
  "Recreio dos Bandeirantes", "Rio das Pedras", "Santa Cruz", "Santíssimo",
  "Senador Camará", "Senador Vasconcelos", "Sepetiba", "Tanque", "Taquara",
  "Vargem Grande", "Vargem Pequena", "Vila Kennedy", "Vila Militar",
  "Vila Valqueire",
];

/**
 * Variações da base que a correspondência por contenção não resolve: erro de
 * grafia, abreviação e nome que ficou pelo caminho. Mapeadas à mão porque não
 * há regra — e ficam à mão, visíveis, em vez de virarem heurística frágil.
 */
const ALIASES: Record<string, string> = {
  "ALTO BOA VISTA": "Alto da Boa Vista",
  "BRAZ DE PINA": "Brás de Pina",
  "OSWALDO CRUZ": "Osvaldo Cruz",
  "SANTA TEREZA": "Santa Teresa",
  "QUINTINO": "Quintino Bocaiúva",
  "PARQUE UNIAO": "Maré",
  "NOVA HOLANDA": "Maré",
  "TIMBAU": "Maré",
  DENDE: "Ilha do Governador",
  GUARABU: "Ilha do Governador",
  TUBIACANGA: "Ilha do Governador",
  "PARQUE ROYAL": "Ilha do Governador",
  CAVALCANTE: "Cavalcanti",
  RECREIO: "Recreio dos Bandeirantes",
  SULACAP: "Jardim Sulacap",
  "VILA COSMOS": "Vila Kosmos",
  "PRACA ONZE": "Centro",
  "FREGUESIA ILHA DO GOV": "Freguesia (Ilha do Governador)",
  "FREGUESIA ILHA DO GOVERNADOR": "Freguesia (Ilha do Governador)",
  "FREGUESIA JACAREPAGUA": "Freguesia (Jacarepaguá)",
  FREGUESIA: "Freguesia (Jacarepaguá)",
};

/**
 * Bairros em que a distância sai do centro da região, e não da casa.
 *
 * São territórios de CEP único cobrindo milhares de endereços. A limitação
 * existe e a interface a diz, em vez de esconder — é a mesma ressalva que o
 * mapa de vacância já publica.
 */
export const PRECISAO_GEO_APROXIMADA = new Set(
  [
    "Rocinha",
    "Manguinhos",
    "Anil",
    "Gardênia Azul",
    "Santa Cruz",
    "Complexo do Alemão",
    "Maré",
    "Jacarezinho",
    "Cidade de Deus",
    "Rio das Pedras",
  ].map(chaveBairro),
);

// ─────────────────────────────────────────────────────── correspondência

interface Oficial {
  chave: string;
  nome: string;
}

const OFICIAIS: Oficial[] = BAIRROS_OFICIAIS.map((nome) => ({
  // A qualificação entre parênteses não participa da comparação por contenção:
  // `Freguesia (Ilha do Governador)` compara como `FREGUESIA`, e a
  // desambiguação fica no alias, onde a decisão é explícita.
  chave: chaveBairro(nome.replace(/\s*\(.*\)\s*/, "")),
  nome,
})).sort((a, b) => b.chave.length - a.chave.length);

/** Contenção em fronteira de palavra: evita `ANIL` casar dentro de `MANGUINHOS`. */
function posicaoDe(chaveTexto: string, chaveAlvo: string): number {
  return ` ${chaveTexto} `.indexOf(` ${chaveAlvo} `);
}

const _cache = new Map<string, string | null>();

/**
 * Bairro oficial correspondente a um valor cru da base, ou `null`.
 *
 * A regra, na ordem: alias explícito → bairro oficial que aparece **primeiro**
 * no texto, e o nome mais longo em caso de empate de posição. É o que resolve
 * `Camorim- Jacarepaguá` → Camorim, `Carobinha -Campo Grande` → Campo Grande e
 * `Penha Circular` → Penha Circular, e não Penha: a base escreve a
 * sub-localidade antes do bairro em alguns registros e depois em outros, mas o
 * bairro oficial mencionado primeiro é o mais específico dos dois em toda a
 * amostra verificada.
 */
export function bairroCanonico(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  const chave = chaveBairro(bruto);
  if (!chave) return null;

  const cacheado = _cache.get(chave);
  if (cacheado !== undefined) return cacheado;

  let achado: string | null = null;

  if (ALIASES[chave]) {
    achado = ALIASES[chave];
  } else {
    let melhorPos = Number.POSITIVE_INFINITY;
    let melhorTam = -1;
    for (const o of OFICIAIS) {
      const pos = posicaoDe(chave, o.chave);
      if (pos < 0) continue;
      if (pos < melhorPos || (pos === melhorPos && o.chave.length > melhorTam)) {
        melhorPos = pos;
        melhorTam = o.chave.length;
        achado = o.nome;
      }
    }
  }

  _cache.set(chave, achado);
  return achado;
}

/**
 * Busca tolerante para o seletor: `jacarepagua` encontra `Jacarepaguá`.
 *
 * Sem acento, sem caixa, e por prefixo de qualquer palavra do nome — digitar
 * `bandeirantes` encontra `Recreio dos Bandeirantes`.
 */
export function buscaBairros(termo: string, limite = 12): string[] {
  const cmp = (a: string, b: string) => a.localeCompare(b, "pt-BR");
  const t = chaveBairro(termo ?? "");
  if (!t) return [...BAIRROS_OFICIAIS].sort(cmp).slice(0, limite);

  const inicio: string[] = [];
  const meio: string[] = [];
  for (const nome of BAIRROS_OFICIAIS) {
    const c = chaveBairro(nome);
    if (c.startsWith(t)) inicio.push(nome);
    else if (c.split(" ").some((p) => p.startsWith(t))) meio.push(nome);
  }
  return [...inicio.sort(cmp), ...meio.sort(cmp)].slice(0, limite);
}

/** A distância neste bairro sai do centro da região, não da casa. */
export function geoAproximada(bairro: string | null | undefined): boolean {
  return Boolean(bairro) && PRECISAO_GEO_APROXIMADA.has(chaveBairro(bairro as string));
}
