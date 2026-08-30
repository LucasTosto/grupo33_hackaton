# Vaga Certa

**Inscrição em creche da rede municipal do Rio com um convite por criança: alocação determinística,
desempate auditável e uma segunda porta para a vaga que hoje fica ociosa.**

Claude Impact Lab Rio · Eixos 2 e 3 · Grupo nº 33 · 30/08/2026

| | |
|---|---|
| **Aplicação** | **https://grupo33-hackathon.vercel.app/** |
| **Vídeo demo (60s)** | `É o arquivo mim-fdra-umb (2026-08-30 16_24 GMT-3), na raiz do repo` |
| **Design técnico** | [`docs/TDD.md`](docs/TDD.md) |
| **Premissas e ressalvas** | [`PREMISSAS.md`](PREMISSAS.md) |
| **Identidade visual** | [`docs/IDENTIDADE-VISUAL.md`](docs/IDENTIDADE-VISUAL.md) |
| **Equipe** | Camila Nascimento, João Assumpção, Pedro Moradillo, Lucas Tosto |

**Índice** · [O problema](#o-problema-e-o-achado) · [O que muda no fluxo](#o-que-muda-no-fluxo) ·
[Resultado](#resultado) · [Como rodar](#como-rodar) · [Como funciona](#como-funciona) ·
[Decisões de produto](#decisões-de-produto) · [O site](#o-site) · [Arquitetura](#arquitetura) ·
[Testes](#testes) · [Premissas](#premissas-e-ressalvas) · [Como o Claude foi usado](#como-o-claude-foi-usado)

---

Hoje uma inscrição em creche gera **até cinco filas paralelas para a mesma criança**. Ela é
classificada cinco vezes, recebe cinco ofertas, ocupa cinco assentos, aceita um — e os outros quatro
ficam congelados até serem repassados. O próximo da fila pode estar na mesma situação.

O Vaga Certa troca a **classificação por opção** pela **classificação por criança**. A ordem de
prioridade da Resolução é executada exatamente como está escrita: o que muda é a sequência das
ofertas.

> O ganho não vem de acelerar o convite. Vem de nunca emitir os quatro convites que não podem ser
> aceitos.

## O problema e o achado

Cruzando a Query B com a régua da Query C, no processo de 2025:

- **68,2%** das inscrições declararam ao menos um critério de prioridade.
- **6,2%** chegaram à classificação com pontuação acima de zero.
- Logo, **93,8% da fila — 67.505 inscrições — entra empatada em zero ponto.**

**A régua de pontuação da Resolução praticamente não classifica.** Quem ordena a fila, na prática, é
o critério de desempate — e é por isso que o motor publica a semente do sorteio e torna o desempate
reproduzível por terceiros, em vez de tratá-lo como detalhe de implementação.

**O que não sabemos, e que precisa ser dito assim.** No campo que a extração expõe como comprovação,
**62% de todas as inscrições declararam critério e aparecem com zero ponto**. Ou é perda real de
pontuação, ou a validação automática não está sendo registrada de forma auditável. Não sabemos qual —
é a primeira pergunta para a equipe de dados da SME, e a solução resolve os dois casos: se é perda
real, o funil de comprovação automática recupera; se é registro, a rodada versionada passa a deixar
rastro auditável de cada critério validado. O campo `confirmado` também é uniforme dentro da inscrição
em 96,7% dos casos, o que é compatível com as duas leituras.

Fechar a distância entre declarar e comprovar vale mais, em vagas, do que qualquer refinamento no
algoritmo. É o que reordenou nossas prioridades.

## O que muda no fluxo

Hoje a família escolhe cinco creches sem saber quanto sua inscrição vale, e comprova depois. A
inversão dessa ordem é a mudança estrutural — não o algoritmo.

```
1 · INSCRIÇÃO            2 · COMPROVAÇÃO          3 · ESCOLHA             4 · CHAMADAS
─────────────            ───────────────          ───────────             ────────────
nascimento, bairro       automática por           3 creches na ordem      rodada toda sexta
e critérios              base oficial             real de preferência     manifestação até quinta
                     →                        →                       →
o score fecha aqui       62 dos 100 pontos        faixa de posição        quem não responde volta
                         presencial só no         visível                 na rodada seguinte
                         resíduo                                          o ano inteiro

Uma criança, uma alocação por rodada. Nenhum assento fica retido esperando
quem já se matriculou em outro lugar.
```

| | Hoje | Vaga Certa |
|---|---|---|
| Unidade de classificação | a opção escolhida | **a criança** |
| Filas por criança | até 5 simultâneas | **1** |
| Quando a família escolhe | sem saber quanto vale | **com o score fechado** |
| Comprovação | presencial por padrão | **automática; presencial é exceção** |
| Perda por não comprovar | a inscrição inteira | **só o critério não comprovado** |
| Ordem dentro do empate | indefinida | **sorteio publicado e reproduzível** |
| Convocação | 3 tentativas e descarte | **rodada semanal recorrente** |
| Aceitar uma vaga | tira de todas as filas | **mantém a opção que a família escolher** |
| Vaga ociosa | invisível | **mapa público, dois regimes de ocupação** |
| Auditoria | conferência manual | **rodada reproduzível por terceiros** |

Duas ressalvas para não vender o que não entregamos: **os quatro períodos não estão separados no
protótipo** — o formulário reúne os quatro em cinco passos — e **a comprovação automática por base
oficial é desenho de processo, não código entregue**. O protótipo trata o critério declarado como
comprovado. O que está implementado é a régua, a alocação, o desempate auditável e as duas portas de
entrada. Detalhes em [`PREMISSAS.md`](PREMISSAS.md).

### Comprovação sem papel: 62 dos 100 pontos

A família não sobe documento nenhum. Cada critério tem uma base oficial que a SME já consulta, e OCR
não valida elegibilidade — só a consulta à base valida.

| Critério | Base oficial | Peso 2025 |
|---|---|---:|
| CadÚnico | SMAS via Data Lake | 51 pts |
| Família monoparental | composição familiar do CadÚnico | 4 pts |
| Responsável com deficiência | BPC / INSS | 3 pts |
| Bolsa Família ou Cartão Carioca | folha do PBF e base municipal | 2 pts |
| Fila no ano anterior | base do próprio Inscrição Creche | 2 pts |
| Irmão matriculado na rede | gestão acadêmica da própria SME | desempate |
| Responsável menor de 18 | registro civil / Receita | desempate |

São **62 dos 100 pontos e os dois desempates**, sem presencial. Os pesos saem de
[`catalogo-2025.json`](lib/data/catalogo-2025.json), extraído da Query C. Enquanto isso não existe, o
formulário entrega no fim a **lista exata de documentos** que a família precisa levar para cada
critério marcado.

## Resultado

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

O que o backtest chama de capacidade é uma **referência observada**, não capacidade autorizada. Por
que essa escolha, e o que ela não permite concluir: [`PREMISSAS.md`](PREMISSAS.md).

## Como rodar

**Pré-requisitos:** Node **24 ou superior** (o motor e os testes rodam sob o type-stripping nativo,
sem transpilador) e npm. Python 3 só é necessário para regenerar as sementes.

```bash
npm install
npm run dev              # http://localhost:3000
npm test                 # 40 testes, sem transpilador
npm run build
```

| Script | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção; a rodada de 2025 é calculada aqui, para `/painel` e `/vagas` |
| `npm start` | serve o build |
| `npm test` | 31 testes do motor + 9 do vetor de desempate |
| `npm run lint` | ESLint via Next |
| `npm run seeds` | roda os três extratores Python em sequência |
| `npm run backtest` | motor × processo real → `lib/data/backtest.json` |

Para regenerar as sementes a partir das bases oficiais — **opcional, elas estão versionadas**:

```bash
git clone https://github.com/CIT-SME-RJ/dadoscreche.git ../dadoscreche
python scripts/extract_seeds.py ../dadoscreche
python scripts/compacta_fila.py
python scripts/capacidade_real.py
npm run backtest
```

## Como funciona

### O assento é a unidade de alocação

Vaga de creche não é fungível dentro de uma escola:

```
assento = (unidade, grupamento, horario)
```

`horario` é `Integral` ou `Parcial` — foi o que a base mostrou, não turno manhã/tarde. São 2.114
assentos em 831 unidades. O grupamento é derivado do nascimento com o corte de 31 de março; a família
não escolhe.

### A criança, não a inscrição

A chave de uma inscrição na base é `(polo, inscrição)`, e **a mesma criança pode estar inscrita em
mais de um polo do mesmo processo**. Alocar por inscrição dava dois assentos a 3.147 crianças —
reproduzindo o problema em outra escala. As 71.949 inscrições são agrupadas nas 62.899 crianças reais
antes da rodada ([`lib/fila.ts`](lib/fila.ts)).

### Prioridade: vetor lexicográfico versionado

```
p(criança) = ( pontuação_da_resolução ,
               critérios_de_desempate_na_ordem_do_catálogo ,
               posição_no_sorteio )
```

As 13 perguntas de 2025 e seus pesos (CadÚnico vale 51 dos 100 pontos) são **dado versionado**, não
código: [`lib/data/catalogo-2025.json`](lib/data/catalogo-2025.json). Quando a Resolução do ano
seguinte é publicada, ninguém faz deploy.

**A própria sequência de desempate também é dado**, em
[`lib/data/desempate.json`](lib/data/desempate.json):

```
1  pontuação da Resolução          em vigor
2  critérios da Resolução          em vigor   (29 irmão matriculado → 30 responsável < 18)
—  proximidade                     declarada e fora de vigor
3  posição no sorteio              em vigor
```

O instrumento normativo que institui a proximidade como desempate está a confirmar. Por isso o vetor
é parâmetro versionado, e não código: quando a confirmação vier, muda-se o arquivo e a vigência, sem
deploy. E nada fica travado esperando resposta — o nível existe, declarado, inativo e com o motivo do
bloqueio registrado no próprio dado.

O carregador é deliberadamente ruidoso: **marcar como ativo um nível que o motor não implementa
falha**, em vez de produzir uma rodada silenciosamente errada. Há teste para isso.

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

O formulário chama um `GET /api/inscricao` quando a família chega no passo das creches, para aquecer a
instância — sem isso o primeiro envio paga a decodificação da fila mais a rodada base.

## Decisões de produto

Cada uma é um campo de [`lib/data/parametros-195.json`](lib/data/parametros-195.json), com a
justificativa no próprio dado. Trocar o parâmetro não exige tocar em código.

### Três opções, não cinco

**94,2%** das crianças que conseguiram vaga entre 2021 e 2025 conseguiram numa das três primeiras
opções. A 4ª e a 5ª responderam por 5,8% — cerca de 2.240 crianças por ano. A cauda longa foi
substituída pelo mapa de vacância, que atende esse grupo melhor do que uma quarta opção escolhida no
escuro. Nos dados, a 5ª opção também é a mais distante de casa: 61,1% fora do bairro, contra 48,3% na
1ª.

### Lista de espera: uma opção, escolhida pela família

Guardar todas as opções melhores é mais generoso, mas gera cascatas longas e uma regra que não cabe em
frase de edital. Guardar sempre a 1ª cria incentivo perverso: quem vê que é 200º na creche que quer
move algo alcançável para o topo e perde a desejada em definitivo. **Deixar a família escolher qual
manter** preserva a simplicidade sem criar o incentivo. A matrícula é piso, não teto.

### Posição em faixa, não número cravado

A posição na fila aparece como faixa de ±25%, em todas as opções. Número exato cria falsa precisão e é
o que gera sensação de traição quando a posição se move; a faixa comunica a incerteza real. Junto vem
a frase da mecânica: *colocar uma creche disputada em 1º lugar não reduz suas chances nas demais* — o
que é verdade porque o motor é à prova de estratégia.

### Rodada semanal, em vez de três telefonemas

Hoje a escola tenta contato uma vez por dia durante três dias; não localizou, a criança sai da lista.
Na proposta há **rodada toda sexta, com manifestação até a quinta seguinte**, e quem não responde
volta na rodada seguinte em vez de ser descartado. O modelo deixa de ser *push* e passa a ser *pull*.
A manifestação também é presencial — no polo, na unidade e por ligação receptiva: um processo só por
aplicativo transferiria a exclusão digital para dentro da parte mais eficiente da solução.

A porta contínua já existe na prática: **20,5%** das inscrições dos últimos cinco processos foram
criadas fora da janela oficial — e conseguem vaga em 60,3% dos casos, contra 55,0%. Formalizar é
reconhecer o que a rede já faz. *(Análise sobre a extração 2021–2025; ao contrário dos demais números
deste README, não sai das sementes versionadas em `lib/data/`.)*

### Mapa de vacância: dois regimes, nunca um só

A regra que impede o furo de fila está nos próprios dados: **84% do estoque de vaga disponível não tem
ninguém na lista de espera**.

| Regime | Estoque | Como é ocupada |
|---|---|---|
| **Vaga sem fila** | 6.963 vagas em 761 assentos | **autoatendimento pelo mapa.** Não há fila para furar, e a pontuação é irrelevante |
| **Vaga com fila** | 1.327 vagas em 264 assentos, 6.915 crianças aguardando | **nunca autoatendimento.** A rodada semanal aloca por prioridade; no mapa aparece como "entrar na lista" |

O celular mais rápido não pode passar à frente da maior vulnerabilidade. A criança que ocupa uma vaga
ociosa começa a frequentar **sem sair da lista de espera da opção que escolheu manter**.

A vaga é calculada como `turmas × lotação de referência − alunos`, com lotação de referência **25 (p90
observado), ajustável** como campo de parametrização. Não é capacidade real nem autorizada.

## O site

| Página | O que faz |
|---|---|
| `/` | O problema, com os números do processo real de 2025 e a tabela do backtest |
| `/inscricao` | Cinco passos: nascimento → bairro → **até 3 creches** ordenadas → 13 critérios → conferir, onde a família **escolhe qual opção fica na lista de espera** |
| `/acompanhar` | Convite, faixa de posição e lista de espera da inscrição feita |
| `/vagas` | **Mapa de vacância:** os dois regimes, próxima rodada e prazo, assentos com vaga sem fila e com fila, e onde a vaga ociosa se concentra |
| `/painel` | A rodada por dentro: identidade, garantias verificadas, **simulador de vaga liberada**, ocupação da rede e pressão por bairro |

Escolhas de interface que valem menção:

- **As 831 creches são reais**, ordenadas pela distância até o centróide do bairro informado, com a
  concorrência de 2025 à mostra (`2,5 candidatos por vaga`). Informar não abre brecha para
  manipulação justamente porque o motor é à prova de estratégia.
- **O grupamento é derivado, não escolhido** — o corte de 31/03 aparece na hora, com a idade.
- **A lista de documentos por critério** é gerada no fim do formulário.
- **A inscrição mostra quantas crianças ela remanejou.** Fica visível de propósito: é o custo real de
  uma inscrição a mais, e esconder isso seria esconder o funcionamento da fila.
- Acessibilidade e paleta institucional: [`docs/IDENTIDADE-VISUAL.md`](docs/IDENTIDADE-VISUAL.md).

## Arquitetura

```
app/                     Next.js 16 · App Router
  page.tsx               landing (estática)
  inscricao/             formulário (client) + página servidora
  acompanhar/            consulta da inscrição
  vagas/                 mapa de vacância (force-static)
  painel/                painel da rede (force-static: a rodada roda no build)
  api/unidades/          creches por assento, ordenadas por distância
  api/inscricao/         valida, roda a classificação, devolve convite + comprovantes
  api/cascata/           simula uma vaga liberada e devolve a cadeia de remanejamento
                         (GET /api/inscricao aquece o motor antes do envio)

lib/
  engine/index.ts        MOTOR — arquivo único, zero dependências
  fila.ts                decodificação e agrupamento por criança
  dados.ts               camada de dados do servidor (server-only)
  data/
    catalogo-2025.json   as 13 perguntas e pesos do processo 195
    desempate.json       o vetor de desempate, com vigência por nível
    parametros-195.json  decisões de produto parametrizadas
    unidades.json        831 unidades, assentos, turmas e alunos de 2025
    fila-2025.json       a fila do processo real, compactada
    fatos.json           números do diagnóstico
    backtest.json        saída do motor × processo real

scripts/
  extract_seeds.py       bases da SME  → catálogo, unidades, fatos, semente da fila
  compacta_fila.py       semente de 44 MB → 4,4 MB carregável pela aplicação
  capacidade_real.py     capacidade = o que a rede de fato matriculou em 2025
  turmas.py              turmas e alunos por assento, base do mapa de vacância
  backtest.ts            motor × processo real → lib/data/backtest.json

test/
  engine.test.ts         31 testes do motor
  desempate.test.ts      9 testes do vetor de desempate como dado
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

## Testes

```bash
npm test                 # 40 testes, sem transpilador
```

O que está sendo testado não é "o código roda", e sim as promessas que a solução faz a um órgão de
controle.

| Suíte | Prova |
|---|---|
| `prioridade` | a régua ordena como a Resolução manda, e o sorteio é determinístico por semente |
| `garantias da rodada` | um convite por criança, nenhum assento acima da capacidade |
| `estabilidade` | nenhum par bloqueador, em instância aleatória — ninguém à sua frente foi ultrapassado |
| `reprodutibilidade` | mesmas entradas ⇒ mesmo `hashEntrada` e mesma alocação |
| `assento e grupamento` | o corte de 31 de março e a codificação do assento |
| `rodada contínua (cascata)` | a cadeia termina, e a estabilidade sobrevive a ela |
| `inscrição nova (rodada incremental)` | a inserção dá saída **idêntica** à rodada completa, candidato por candidato |
| `vetor de desempate como dado versionado` | ativar um nível que o motor não implementa **falha** em vez de produzir rodada silenciosamente errada |

A verificação de estabilidade não fica só nos testes: ela acompanha cada rodada, porque é a evidência
que o órgão de controle recebe junto com o resultado publicado. Foi ela que pegou os dois bugs reais
do projeto.

## Premissas e ressalvas

Cinco premissas declaradas, cada uma com o caminho de substituição quando a SME confirmar o parâmetro
real, e nove ressalvas sobre o que os números **não** permitem concluir:
**[`PREMISSAS.md`](PREMISSAS.md)**.

As quatro mais importantes, em uma linha cada:

- A capacidade do backtest é **referência observada**, não capacidade autorizada.
- A lotação de 25 por turma no mapa de vacância é **p90 observado e ajustável**.
- A distância é até o **centróide do bairro**, não até a casa — o que medimos é o piso do desempate
  territorial, nunca o teto.
- A **proximidade está declarada e fora de vigor**: o instrumento normativo que a institui está a
  confirmar.

## Como o Claude foi usado

Claude Opus 5 conduziu o trabalho de ponta a ponta dentro do Claude Code, em uma sessão:

1. **Leu as bases antes de propor qualquer coisa.** Foi o que corrigiu duas premissas do nosso
   documento de arquitetura: o eixo do assento é `Integral/Parcial`, não turno; e a capacidade da
   planilha de matrículas inclui renovações, então usá-la faria o motor alocar em vaga já
   comprometida.
2. **Escreveu os extratores em Python** sobre 837 mil linhas da Query A e 4,36 milhões da Query B,
   com leitura em blocos, e reproduziu de forma independente os números que tínhamos levantado à mão
   (93,8% empatados em zero, 6,2% de comprovação).
3. **Implementou o motor e os 40 testes**, incluindo a verificação adversarial de estabilidade — que
   é o que pegou dois bugs reais: alocação por inscrição em vez de por criança, e a criança que
   desistia retomando o próprio assento na cascata por não ter sido removida do processo.
4. **Construiu a aplicação inteira** e o backtest que gera a tabela deste README.

O achado da lacuna entre declarar (68,2%) e comprovar (6,2%) foi o que mudou o desenho do produto: em
vez de só otimizar o algoritmo, o formulário passou a entregar a lista de documentos por critério, e
as decisões de produto passaram a ser dado parametrizado com justificativa.

## Fontes

- [`CIT-SME-RJ/dadoscreche`](https://github.com/CIT-SME-RJ/dadoscreche) — bases anonimizadas dos
  processos 2021–2025 (Query A, Query B, Query C, unidades, microáreas IPP, oferecimentos e vagas)
- [`taicor-ai/claude-impact-lab-rio-2`](https://github.com/taicor-ai/claude-impact-lab-rio-2) —
  apresentação do desafio
- [Manual de Marca Prefeitura Rio 2025](https://educacao.prefeitura.rio/identidade-visual/) — SME/RJ

---

Este é um protótipo construído em hackathon. **Não é canal oficial de inscrição:** a inscrição válida
é feita no [matricula.rio](https://matricula.rio).
