# Vaga Certa — inscrição em creche com um convite por criança

**Claude Impact Lab Rio · Eixos 2 e 3 · 30/08/2026**

- **Equipe:** Vaga Certa
- **Grupo nº:** 33
- **Membros:** Camila Nascimento, João Assumpção, Pedro Moradillo, Lucas Tosto
- **Aplicação:** **https://grupo33-hackathon.vercel.app/**
- **Vídeo demo (60s):** `PREENCHER`
- **Documento de design técnico:** [`docs/TDD.md`](docs/TDD.md)

---

## Resumo

Hoje uma inscrição em creche gera **até cinco filas paralelas para a mesma criança**. Ela é
classificada cinco vezes, recebe cinco ofertas, ocupa cinco assentos, aceita um — e os outros quatro
ficam congelados até serem repassados. O próximo da fila pode estar na mesma situação.

O Vaga Certa troca a **classificação por opção** pela **classificação por criança**. A ordem de
prioridade da Resolução é executada exatamente como está escrita: o que muda é a sequência das
ofertas. Cada criança recebe no máximo um convite, e as opções melhores continuam valendo como fila
de melhoria.

Rodando o motor sobre o processo real de 2025 (`prm_id 195`), com a **mesma fila e a mesma
capacidade** que a rede teve:

| Métrica | 2025 real | Motor |
|---|---:|---:|
| Crianças ocupando mais de um assento | 7.256 | **0** |
| Assentos travados por oferta múltipla | 11.926 | **0** |
| Reservas que não viraram matrícula | 17.998 | **0** |
| Atendidas na 1ª opção | 72,2% | **79,7%** |
| Vagas preenchidas | 48.688 | 47.847 |
| Violações de estabilidade | não verificável | **0** |

A rodada inteira — 62.899 crianças, 2.114 assentos, 94.387 propostas avaliadas — leva **~3,8 s**, e a
prova de que ninguém foi ultrapassado leva outros **~1,1 s**.

> O ganho não vem de acelerar o convite. Vem de nunca emitir os quatro convites que não podem ser
> aceitos.

## O achado que reordenou nossas prioridades

Cruzando a Query B com a régua da Query C, no processo de 2025:

- **68,2%** das inscrições declararam ao menos um critério de prioridade.
- **6,2%** chegaram à classificação com pontuação acima de zero.
- Logo, **93,8% da fila — 67.505 inscrições — entra empatada em zero ponto.**

O campo `confirmado` da base não marca critério a critério: marca se a família compareceu para
comprovar. Quem não vai perde tudo de uma vez.

Isso muda o que a solução precisa fazer. **A régua de pontuação da Resolução praticamente não
classifica.** Quem ordena a fila, na prática, é o critério de desempate — e é por isso que o motor
publica a semente do sorteio e torna o desempate reproduzível por terceiros, em vez de tratá-lo como
detalhe de implementação.

E é por isso que o formulário, depois de enviar, entrega a **lista exata de documentos** que a
família precisa levar para cada critério marcado. Fechar a distância entre declarar e comprovar vale
mais, em vagas, do que qualquer refinamento no algoritmo.

## Como funciona

### O assento é a unidade de alocação

Vaga de creche não é fungível dentro de uma escola:

```
assento = (unidade, grupamento, horario)
```

`horario` é `Integral` ou `Parcial` — foi o que a base mostrou, não turno manhã/tarde. São 2.114
assentos em 831 unidades. O grupamento é derivado do nascimento com o corte de 31 de março; a família
não escolhe.

### Prioridade: vetor lexicográfico versionado

```
p(criança) = ( pontuação_da_resolução ,
               critérios_de_desempate_na_ordem_do_catálogo ,
               posição_no_sorteio )
```

As 13 perguntas de 2025 e seus pesos (Cadúnico vale 51 dos 100 pontos) são **dado versionado**, não
código: [`lib/data/catalogo-2025.json`](lib/data/catalogo-2025.json), extraído da Query C. Quando a
Resolução do ano seguinte é publicada, ninguém faz deploy.

### Desempate auditável

```
posição_no_sorteio = HMAC(semente_do_processo, id_da_criança)
```

Semente única para todo o processo, publicada antes da rodada. Qualquer auditor com a semente e a
lista de inscrições reconstrói a ordem em uma linha de código. Com 94% da fila empatada, **o
desempate é o alocador real do sistema** — torná-lo explícito e verificável é, sozinho, um ganho de
transparência maior do que qualquer melhoria de interface.

### Aceitação diferida

Gale–Shapley com capacidades, criança propõe. Como nenhum critério da Resolução depende da unidade, o
resultado é idêntico a percorrer as crianças em ordem de prioridade, cada uma tomando a melhor opção
disponível — o que torna o motor **trivialmente explicável** (*"todos à sua frente já haviam sido
alocados"*) sem perder correção se a Resolução passar a incluir critérios territoriais.

Duas propriedades verificadas a cada rodada, não prometidas:

1. **Um convite por criança**, e nenhum assento acima da capacidade.
2. **Nenhum par bloqueador**: não existe caso em que a criança prefira um assento e ele esteja
   ocupado por alguém de prioridade menor. Na linguagem do edital: ninguém à sua frente na fila foi
   ultrapassado.

Como consequência, **declarar a preferência verdadeira nunca prejudica a família** — o que ataca de
frente o comportamento relatado pela equipe da SME, a mãe que escolhe unidade por cálculo de chance e
não por onde quer a vaga.

### Rodada contínua: a vaga liberada em março

Uma desistência no meio do ano não exige reprocessar a rede. Ela inicia uma **cadeia**: o assento
liberado vai para a criança de maior prioridade que o prefere ao que tem hoje; o assento que ela larga
vai para a próxima; e assim por diante, até chegar num assento que ninguém à espera prefere.

Exemplo real da rodada, disponível em `/painel` (botão *liberar uma vaga*):

```
desistência em Edi Escritora Clarice Lispector · Maternal II · Integral
  1  aluno_0081371   3ª → 1ª opção,  libera Edi Anna Maria Niemeyer
  2  aluno_0017989   5ª → 3ª opção,  libera Edi Professora Emilia Maria Vieira
  3  aluno_0091264   4ª → 3ª opção,  libera Edi Professora Matilde Rosa Lopes
  4  aluno_0087740   5ª → 1ª opção,  libera Edi Compositor Roberto Ribeiro
  5  aluno_0075458   2ª → 1ª opção,  libera Cp Aemmac - Anil
  a cadeia para: ninguém à espera prefere Cp Aemmac - Anil ao que já tem

5 crianças remanejadas · 1.612 candidatos avaliados de 62.898 · 188 ms
```

Uma desistência, cinco crianças em opção melhor, em 188 ms. Hoje esse mesmo cálculo é feito no mundo
físico, em série, a três dias úteis por convite. **É aqui que os dias mortos moram** — e a cadeia
preserva a estabilidade, o que é verificado em teste sobre instância aleatória.

### Inscrição nova também é incremental

Uma inscrição que chega em março não deve requalificar as 62.899 crianças já classificadas. A criança
propõe à 1ª opção; se está cheia, disputa com o ocupante de menor prioridade; se passa, entra, e o
deslocado retoma a proposta a partir da opção seguinte à que perdeu — exatamente o que a aceitação
diferida faria.

O resultado é **idêntico** a rodar a rodada inteira com a nova criança na entrada. Isso não é uma
suposição: há teste que compara as duas saídas candidato por candidato, para quatro perfis de
inscrição, sobre instância de 600 candidatos. O custo cai de segundos para milissegundos:

| | rodada completa | inserção incremental |
|---|---:|---:|
| propostas avaliadas | 94.387 | **1 a 4** |
| tempo de resposta | ~3.800 ms | **~190 ms** |

O formulário ainda chama um `GET /api/inscricao` quando a família chega no passo das creches, para
aquecer a instância — sem isso o primeiro envio paga a decodificação da fila mais a rodada base.

### A criança, não a inscrição

A chave de uma inscrição na base é `(polo, inscrição)`, e **a mesma criança pode estar inscrita em
mais de um polo do mesmo processo**. Alocar por inscrição dava dois assentos a 3.147 crianças —
reproduzindo o problema em outra escala. As 71.949 inscrições são agrupadas nas 62.899 crianças reais
antes da rodada ([`lib/fila.ts`](lib/fila.ts)).

## O que dá para fazer no site

| Página | O que faz |
|---|---|
| `/` | O problema, com os números do processo real de 2025 e a tabela do backtest |
| `/inscricao` | Inscrição em 5 passos: nascimento → bairro → até 5 creches ordenadas → 13 critérios → conferir |
| `/acompanhar` | Convite, posição na fila e fila de melhoria da inscrição feita |
| `/painel` | A rodada por dentro: identidade, garantias, **simulador de vaga liberada**, ociosidade por assento e pressão por bairro |

Escolhas de produto que valem menção:

- **As 831 creches são reais**, ordenadas pela distância até o centróide do bairro informado, com a
  concorrência de 2025 à mostra (`2,5 candidatos por vaga`). Informar não abre brecha para
  manipulação justamente porque o motor é à prova de estratégia.
- **O grupamento é derivado, não escolhido** — o corte de 31/03 aparece na hora, com a idade.
- **A lista de documentos por critério** é gerada no fim do formulário.
- Alvos grandes, foco sempre visível, `skip link`, `aria-pressed` nos botões de escolha e contraste
  alto: o formulário é o caminho de uma família em pé numa fila, muitas vezes no celular.

## Identidade visual

A interface segue o [Manual de Marca Prefeitura Rio 2025](https://educacao.prefeitura.rio/wp-content/uploads/sites/42/2025/01/MANUAL-DE-MARCA-PREFEITURA-RIO-2025.pdf),
publicado pela própria SME em [educacao.prefeitura.rio/identidade-visual](https://educacao.prefeitura.rio/identidade-visual/).
O manual define cinco cores, e são exatamente essas as usadas:

| Cor | Uso aqui |
|---|---|
| `#13335a` azul institucional | assinatura, cabeçalhos de tabela e de cartão, botão primário |
| `#eceded` cinza | fundo de seção alternada |
| `#2a688f` azul médio | rótulos de apoio |
| `#42b9eb` azul claro | filete de seção, borda superior de cartão, texto sobre azul escuro |
| `#f06949` coral | **não usado** — o manual restringe o degradê quente a filme publicitário |

A estrutura de página reproduz o padrão observável no [matricula.rio](https://matricula.rio) e no
[portal da SME](https://educacao.prefeitura.rio): barra utilitária ligando ao `prefeitura.rio`,
assinatura institucional em duas linhas (órgão superior + secretaria), navegação em versal, conteúdo
em cartões sobre fundo claro, e rodapé com endereço e serviços relacionados.

Três decisões que valem registro:

- **Tipografia.** A fonte oficial é **Cera Pro**, distribuída pela SME para uso próprio. É fonte
  comercial: embuti-la num app público seria redistribuição indevida. Usamos **DM Sans**, o
  substituto livre mais próximo em estrutura — geométrica, contraste baixo, `a` de dois andares,
  altura-x alta. A troca está declarada no rodapé do site.
- **Caixa alta.** O manual pede título preferencialmente em CAIXA ALTA. Aplicamos isso em rótulos,
  navegação, botões e cabeçalhos de tabela, mas **não** em títulos longos: texto extenso em versal
  prejudica leitura e leitores de tela. É o que o próprio portal da SME faz na prática.
- **Contraste.** Todas as combinações de texto passam WCAG AA. Duas correções foram necessárias:
  `#42b9eb` tem 2,24:1 sobre branco e por isso nunca é texto sobre fundo claro (só sobre o azul
  escuro, onde dá 5,68:1); e o cinza de rótulo foi escurecido de `#6b7a8c` para `#5a6877`, porque a
  1,5 pt de tamanho ele ficava em 4,39:1 sobre branco e 3,74:1 sobre `#eceded` — abaixo do mínimo.
  Com o novo valor: 5,70:1, 4,86:1 e 5,26:1 nos três fundos do site.

## Arquitetura

```
app/                     Next.js 16 · App Router
  page.tsx               landing (estática)
  inscricao/             formulário (client) + página servidora
  acompanhar/            consulta da inscrição
  painel/                painel da rede (force-static: a rodada roda no build)
  api/unidades/          creches por assento, ordenadas por distância
  api/inscricao/         valida, roda a classificação, devolve convite + comprovantes
  api/cascata/           simula uma vaga liberada e devolve a cadeia de remanejamento
                         (GET /api/inscricao aquece o motor antes do envio)

lib/
  engine/index.ts        MOTOR — arquivo único, zero dependências
  fila.ts                decodificação e agrupamento por criança
  dados.ts               camada de dados do servidor (server-only)
  data/                  sementes versionadas, extraídas das bases da SME

scripts/
  extract_seeds.py       bases da SME  → catálogo, unidades, fatos, semente da fila
  compacta_fila.py       semente de 44 MB → 4,4 MB carregável pela aplicação
  capacidade_real.py     capacidade = o que a rede de fato matriculou em 2025
  backtest.ts            motor × processo real → lib/data/backtest.json

test/engine.test.ts      31 testes, sem transpilador (type-stripping do Node 24)
```

Decisões que sustentam o resto:

- **O motor é um arquivo único sem dependências.** Roda no Next, nos testes e no script de backtest
  sem build intermediário — o código que produz o número do pitch é o mesmo que atende a família.
- **Regras como dado.** Catálogo versionado com `catalogo_versao` no `rodada_id`; reprocessar um ano
  antigo usa as regras daquele ano.
- **Rodada imutável e reprodutível.** `rodada_id`, `hashEntrada`, semente e versão do catálogo
  acompanham todo resultado. Mesmas entradas ⇒ mesmo resultado, sempre.
- **Motor desacoplado do matricula.rio.** É o que permitiu rodar em sombra sobre 2025 sem tocar em
  produção — e é o que viabiliza adoção gradual.
- **Sem banco de dados, de propósito.** A rodada é determinística, então a inscrição fica no
  navegador e é reenviada para recalcular. Isso mantém o protótipo publicável em qualquer lugar e
  deixa a superfície de dado pessoal em zero. Em produção, a consulta seria por protocolo + CPF
  contra o registro da inscrição.

## Como rodar

```bash
npm install
npm run dev              # http://localhost:3000
npm test                 # 31 testes do motor
npm run build
```

Para regenerar as sementes a partir das bases oficiais (opcional — elas estão versionadas):

```bash
git clone https://github.com/CIT-SME-RJ/dadoscreche.git ../dadoscreche
python scripts/extract_seeds.py ../dadoscreche
python scripts/compacta_fila.py
python scripts/capacidade_real.py
npm run backtest
```

## Como o Claude foi usado

Claude Opus 5 conduziu o trabalho de ponta a ponta dentro do Claude Code, em uma sessão:

1. **Leu as bases antes de propor qualquer coisa.** Foi o que corrigiu duas premissas do nosso
   documento de arquitetura: o eixo do assento é `Integral/Parcial`, não turno; e a capacidade da
   planilha de matrículas inclui renovações, então usá-la faria o motor alocar em vaga já
   comprometida.
2. **Escreveu os extratores em Python** sobre 837 mil linhas da Query A e 4,36 milhões da Query B,
   com leitura em blocos, e reproduziu de forma independente os números que tínhamos levantado à mão
   (93,8% empatados em zero, 6,2% de comprovação).
3. **Implementou o motor e os 31 testes**, incluindo a verificação adversarial de estabilidade — que
   é o que pegou dois bugs reais: alocação por inscrição em vez de por criança, e a criança que
   desistia retomando o próprio assento na cascata por não ter sido removida do processo.
4. **Construiu a aplicação inteira** e o backtest que gera a tabela deste README.

O achado da lacuna entre declarar (68,2%) e comprovar (6,2%) foi o que mudou o desenho do produto: em
vez de só otimizar o algoritmo, o formulário passou a entregar a lista de documentos por critério.

## Ressalvas honestas

Coisas que um número bonito não deve esconder:

- **A capacidade usada no backtest é quantas crianças a rede matriculou em cada assento em 2025**,
  não a capacidade autorizada. Para o número operacional real seria preciso subtrair renovações
  automáticas e transferências internas do sistema de gestão acadêmica.
- **O motor preenche 47.847 das 48.688 vagas** (98,3%). As 841 restantes sobraram porque toda criança
  que as escolheu foi atendida em opção melhor. Não alocamos mais gente que o histórico — se
  alocássemos, seria sinal de erro.
- **A taxa de comprovação despenca de 88,9% em 2021 para 8–11% de 2022 em diante.** Descontinuidade
  desse tamanho é mudança real de processo ou artefato de extração. Confirmar com a equipe de dados
  da SME antes de usar o número em público.
- **Distância é até o centróide do bairro**, não até a casa. A base é anonimizada e não traz
  logradouro — e o protótipo também não pede.
- **As planilhas de unidades parceiras vêm de consolidações das CREs.** É onde o ruído se concentra.
- **Os pesos das perguntas mudaram entre 2023 e 2024.** Todo número aqui é do processo 195 (2025)
  isolado; série temporal sem normalizar o catálogo produz número errado com aparência de certo.

## Fontes

- [`CIT-SME-RJ/dadoscreche`](https://github.com/CIT-SME-RJ/dadoscreche) — bases anonimizadas dos
  processos 2021–2025 (Query A, Query B, Query C, unidades, microáreas IPP, oferecimentos e vagas)
- [`taicor-ai/claude-impact-lab-rio-2`](https://github.com/taicor-ai/claude-impact-lab-rio-2) —
  apresentação do desafio

Este é um protótipo. Não é canal oficial de inscrição: a inscrição válida é feita no
[matricula.rio](https://matricula.rio).
