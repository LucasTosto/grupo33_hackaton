# Inscrição Creche — alterações de front-end

**Alvo:** `https://grupo33-hackathon.vercel.app/inscricao`
**Base normativa:** `FORMULARIO_DOCUMENTOS_INTEGRACOES.md` (campos, trilhas, documentos), `MVP_DEMO_1H.md` (recorte executável), `ANALISE_INSCRICAO_CRECHE.md` (diagnóstico), `mapa-vagas-creche-rio.html` (mapa reaproveitável).

**Como o site foi analisado.** Li o HTML servido, o payload RSC e o *chunk* JS da rota `/inscricao` (`3gx493ew6sfxa.js`) — ou seja, a árvore de componentes, todos os textos de interface, o *dataset* enviado ao cliente e as classes de estilo. **Não vi a renderização em pixels nem testei em celular real.** Onde a crítica depende de layout renderizado, está marcada com *(verificar em tela)*.

---

## Sumário executivo

O fluxo atual tem 5 etapas: **A criança** (mês/ano de nascimento + turno) → **Endereço** (bairro) → **Creches** (escolhe até 5, ordenadas) → **Critérios** (13 caixas de seleção) → **Conferência** (revisão e envio), terminando em protocolo + classificação na hora.

A engenharia está bem à frente do que se costuma ver em protótipo de hackathon: grupamento derivado da data, classificação executada sobre a fila real, distância por bairro, remanejamento em cascata. **O problema é de camada de interface, e é de um tipo específico:**

> **A tela está escrita para a plateia da apresentação, não para a mãe que precisa da vaga.**

O usuário final não sabe — e não deve precisar saber — que 93,8% da fila empata em zero, que a rede perdeu 62 pontos percentuais em 2025, ou que 48% das opções ficavam em bairro diferente. Hoje esses números estão dentro do formulário, como texto de apoio dos campos. Isso é o argumento do diagnóstico ocupando o lugar da instrução.

E há uma contradição estrutural: **a Etapa 4 ainda pergunta as 13 perguntas em autodeclaração.** É exatamente o defeito que a solução propõe corrigir. O formulário reproduz o processo de 2025 com estética melhor.

As três diretrizes do pedido se resolvem em três movimentos:

| # | Movimento | O que muda |
|---|---|---|
| 1 | **Separar o discurso do serviço** | todo número de diagnóstico sai do formulário e vai para `/como-funciona` e `/painel`. No formulário fica só instrução e consequência. |
| 2 | **Trocar declaração por conferência** | a Etapa 4 vira uma tela de leitura (o que as bases já sabem) + 5 perguntas. De 13 para 5. |
| 3 | **Inverter a ordem: saber antes de escolher** | critérios e pontuação vêm **antes** da escolha das creches. Hoje a família escolhe no escuro e só depois descobre a chance que tem. |
| 4 | **Separar ponto confirmado de ponto declarado** | a régua nova dá 10 a 25 pontos a critérios que hoje valem 2 a 4. Só o que foi aferido ou atestado ordena a fila; o declarado fica visível, à parte, como "a confirmar". |

A régua nova (`REGUA_DE_PONTUACAO.md`) não muda a lógica exibida — ela não deve aparecer na tela — mas **exige 14 campos que hoje não existem** (mais 5 no modelo de dados) e reescreve duas telas. Está tratada em separado na **Parte 4**.

---

# Parte 1 — Diagnóstico de UX/UI do que está no ar

## 1.1 O formulário argumenta em vez de instruir

Textos de apoio hoje presentes **dentro dos campos**:

| Onde | Texto atual | Problema |
|---|---|---|
| Etapa 2 (bairro) | *"Serve para ordenar as creches por proximidade. Em 2025, 48% das opções escolhidas ficavam em bairro diferente do da família — e a taxa de matrícula caía junto."* | a primeira frase é instrução útil; a segunda é dado de política pública. Para quem preenche, é ruído. |
| Etapa 4 (critérios) | *"Em 2025, 68,2% das inscrições declararam ao menos um critério e apenas 6,2% chegaram à classificação com pontuação acima de zero. A diferença não é fraude: é família que não conseguiu comparecer para comprovar. Quem não comprova entra empatado em zero com 93,8% da fila."* | 4 linhas de estatística num momento em que a pessoa precisa saber apenas: *o que marco aqui, e o que isso me obriga a fazer depois.* Ainda usa a palavra "fraude" — que introduz suspeita onde não havia. |
| Etapa 4 (aviso) | *"Sem estes documentos, a pontuação declarada não entra na classificação. É aqui que a rede perdeu 62 pontos percentuais em 2025."* | "62 pontos percentuais" é métrica de gestão. Não diz à família o que fazer. |
| Resultado | *"Empatada com 93,8% da fila. O desempate é o sorteio de semente publicada."* | comunica ao usuário que ele é uma estatística, e usa "semente publicada" — jargão criptográfico. |

**Regra a adotar:** dentro do formulário, texto de apoio responde a **uma** de três perguntas — *por que precisamos disto de você*, *o que acontece se você marcar*, *o que acontece se você não marcar*. Nada mais. Todo número comparativo migra para `/como-funciona` (público) e `/painel` (gestão), com um *link* discreto **"Por que pedimos isso?"** onde fizer sentido.

## 1.2 A Etapa 4 contradiz a solução

O payload RSC entrega ao cliente as 13 perguntas de 2025 com o texto original e a pontuação, e a interface as apresenta como caixas de seleção. Sintomas:

- **Texto burocrático não editado:** *"Candidato tem pais ou responsáveis deficientes ?"* (espaço antes da interrogação), *"Existe algum membro do núcleo familiar que faz uso abusivo de drogas e/ou alcoól?"* (erro de grafia em produção), *"O candidato é refugiado?"*. O usuário é chamado de "candidato" — não é como uma família fala do próprio filho.
- **A pontuação aparece ao lado de cada pergunta.** Mostrar "51 pontos" ao lado de "sua família está no CadÚnico?" é ensinar a marcar. Convida à declaração estratégica e piora o dado.
- **Perguntas que uma base responde continuam sendo perguntas:** CadÚnico, monoparental, Bolsa Família, fila do ano anterior, irmão matriculado, responsável menor de 18, educação especial, responsável com deficiência. São 8 das 13 — e 87 dos 100 pontos.
- **Perda uniforme:** a tela avisa que "sem documentos a pontuação declarada não entra na classificação" — no plural, como bloco. A regra da solução é perda **por critério**: quem não comprova violência perde 4 pontos, não os 51 do CadÚnico.

## 1.3 O seletor de bairro expõe a base suja ao usuário

O RSC entrega uma lista de bairros com as variações cruas da base. Amostra do que o usuário vê hoje na lista:

```
ABOLIÇÃO · Acari · ACARI · Água Santa · Alto Boa Vista · ALTO DA BOA VISTA
Andaraí · ANDARAÍ · Andaraí - Jamelão · Andaraí - Morro do Andaraí
campo grande · Campo Grande · CAMPO GRANDE · Carobinha -Campo Grande
Cavalcante · CAVALCANTI · FREGUESIA (ILHA DO GOV.) · FREGUESIA / JACAREPAGUÁ
Jacarepaguá · JACAREPAGUÁ · Jacarepaguá - Taquara · MATO ALTO / JACAREPAGUÁ
```

Consequências para quem preenche: o mesmo bairro aparece 2–4 vezes com grafias diferentes, sem nenhuma pista de qual é "a certa"; há entradas que não são bairro (`Andaraí - Morro do Andaraí`, `Conj. Hab. Amarelinho - Irajá`); há mistura de bairro e RA (`Ilha do Governador` e `FREGUESIA (ILHA DO GOV.)`).

Isso é o achado nº 5 do diagnóstico — 1.607 valores para 164 bairros — vazando para a interface. E como a proximidade é desempate, escolher a variante "errada" pode mudar a classificação da criança. **É o defeito mais grave da tela atual**, porque é silencioso: a família não tem como saber que errou.

## 1.4 A ordem das etapas faz a família escolher no escuro

Hoje: **Creches (3) → Critérios (4) → Resultado (5)**.

A família ordena até 5 creches sem saber a própria pontuação. Depois descobre que tem 0 ponto confirmado e que sua 1ª opção tem 8 candidatos por vaga. A informação que orienta a escolha chega **depois** da escolha. É o inverso da hierarquia de decisão.

Trocar para **Critérios → Pontuação → Creches** permite anotar cada creche da lista com algo que só existe depois do score: *"com sua pontuação, a fila desta creche tem 12 crianças à frente"*. A mesma tela passa de aposta para decisão informada.

## 1.5 Vocabulário

Termos hoje visíveis para a família, e a tradução proposta:

| Atual | Proposto |
|---|---|
| Grupamento · Berçário / Maternal I / Maternal II | **Turma** — "Maternal I (2 anos)". Manter o nome oficial entre parênteses. |
| Horário pretendido · Integral / Parcial | **Você precisa de qual horário?** — "Dia inteiro (7h–17h, com refeições)" / "Meio período (4h)" |
| Critério de desempate | **O que decide quando duas crianças têm a mesma pontuação** |
| Pontuação declarada | **Sua pontuação**, dividida em `confirmados` e `a confirmar` (§4.7) |
| Bloco · grau · degrau · teto por bloco · aferição | nunca aparecem. Viram *grupo* apenas na Tela 9, e a regra do teto vira uma frase (§4.7) |
| Extrema pobreza · pobreza · baixa renda | nunca aparecem. O cartão diz **"Renda confirmada pelo CadÚnico"** e os pontos (§4.4) |
| Classificação incremental | **Sua posição é atualizada sempre que abre vaga** |
| Remanejamento em cascata | **Se abrir vaga numa opção melhor, a gente move sua criança automaticamente** |
| Sorteio de semente publicada | **Sorteio auditável** (+ *link* "como o sorteio funciona") |
| Ordem de preferência · "ª opção" | **1ª escolha / 2ª escolha / 3ª escolha** |
| "Candidato" | **a criança** / **seu filho, sua filha** |
| Trilha A / B / C | nunca aparece para a família. Vira status: *Confirmado pelo governo* / *Confirmado por um serviço* / *Precisa comprovar*. |

## 1.6 "Prefiro não informar" no bairro cobra um preço oculto

A opção existe e é legítima, mas não diz a consequência. Quem escolhe perde o desempate por proximidade e não sabe. Precisa de um efeito visível imediato: *"Sem o bairro, não conseguimos ordenar as creches por distância e a proximidade não conta como desempate na sua inscrição."*

## 1.7 O que falta em relação à especificação

Ausente no front atual, previsto no documento de solução:

- Identificação/autenticação (gov.br prata) e, portanto, o preenchimento automático que é a tese central
- Consentimento de cruzamento de bases (LGPD art. 7º III / art. 11 II "b") — hoje o formulário não pede permissão para nada
- CPF ou DNV da criança — sem chave, volta o agrupamento por nome+data que gerou 94 inscrições para uma mesma criança em 2022
- CEP e número — hoje só bairro, o que joga toda proximidade para centroide
- `aceita_outro_turno` — campo barato que multiplica assentos elegíveis
- Contato e verificação por SMS — o ciclo pode levar 13 meses e 44,1% das opções morrem como "cancelado pelo sistema"
- *Upload* / comprovação e a lista do que levar ao polo
- Salvamento contínuo e retomada ("Salvar e sair")
- Modo assistido (servidor no polo ou 1746 preenchendo pela família)
- Recibo por WhatsApp/SMS

## 1.8 Acessibilidade e mobile *(verificar em tela)*

- Caixa de seleção com `size-5` (20 px) e área clicável `px-4 py-3.5`: o rótulo inteiro parece ser clicável (bom), mas o alvo visual está abaixo dos 44 px pedidos.
- Botões com `!min-h-0 !px-4 !py-2 !text-[12px]` (as setas de reordenar e os botões compactos) provavelmente ficam **abaixo de 44 px** — e reordenar preferência é justamente uma ação de precisão.
- Reordenação só por setas ↑↓ de 40 px, sem alternativa por seleção numérica.
- Textos de apoio em `text-[13px]`/`text-[12.5px]` com `text-texto-3` — contraste e tamanho a verificar contra AA.
- Faltam `aria-live` no resultado da classificação e no contador de creches escolhidas, e `aria-current` na trilha de etapas.
- `max-w-4xl` com `p-5 md:p-7`: uma coluna, o que é bom para celular. Mas o padrão pedido é **uma pergunta por tela**, e hoje a Etapa 1 traz dois campos e a Etapa 4 traz treze.

## 1.9 Inconsistências menores

- **Até 5 creches** (`maxOpcoes: 5`) contra **3 preferências** na especificação. Escolher: 3 é mais honesto com a capacidade de alocação e mais simples de ordenar no celular.
- A frase *"Um convite, não cinco. As outras opções não ficam com assento reservado neste nome."* é correta e importante, mas está escrita como aviso legal. Vira: *"Você recebe **um** convite — da melhor opção que conseguirmos. As outras continuam valendo se abrir vaga."*
- *"Nova simulação"* como botão final revela que aquilo é demonstração no meio de um fluxo que se apresenta como serviço. Deve ficar fora do fluxo, numa faixa de protótipo.
- *"Volte à primeira etapa: falta o nascimento ou o horário."* — mensagem de erro que não leva o usuário de volta. Precisa ser um *link*.

---

# Parte 2 — As telas propostas

## 2.0 Padrões que valem para todas

**Estrutura fixa de cada tela**

```
┌──────────────────────────────────────────────┐
│ Prefeitura · SME · Vaga Certa      [ajuda]   │  cabeçalho existente, mantido
├──────────────────────────────────────────────┤
│ ●━━●━━○━━○━━○   Etapa 3 de 7                 │  barra + contagem real
│ Salvo automaticamente · [Salvar e sair]      │
├──────────────────────────────────────────────┤
│ H1  A pergunta, em linguagem de gente        │  clamp(24px,4vw,32px), font-black, azul
│ ─── uma linha de instrução, ≤ 2 linhas ───   │  15px, texto-2, max-w-[62ch]
│                                              │
│ [ o campo, grande, um por tela ]             │
│                                              │
│ › Por que pedimos isso?          (disclosure)│  fechado por padrão
├──────────────────────────────────────────────┤
│ [ Voltar ]                  [ Continuar → ]  │  ≥48px, primário à direita
└──────────────────────────────────────────────┘
```

**Reaproveitar o sistema visual que já existe.** O bundle já traz *tokens* e componentes utilizáveis sem redesenho: `--azul`, `--azul-escuro`, `--azul-claro`, `--azul-10`, `--linha`, `--linha-forte`, `--cinza`, `--texto-2`, `--texto-3`, `--ok`, `--ok-fundo`, `--atencao`, `--atencao-fundo`, `--erro`, `--erro-fundo`, e as classes `.cartao`, `.cartao-titulo`, `.botao`, `.botao-primario`, `.botao-secundario`, `.campo`, `.rotulo`, `.tarja`, `.num`, `.secao-titulo`. **Nenhuma proposta abaixo pede cor ou componente novo** — só um uso mais disciplinado:

| Token | Significado único, sem exceção |
|---|---|
| `ok` / `ok-fundo` | confirmado por base oficial ou por serviço público. Nada mais usa verde. |
| `atencao` / `atencao-fundo` | depende de uma ação da família (comprovar, verificar celular, escolher creche) |
| `erro` / `erro-fundo` | impedimento — não classifica, dado inválido |
| `azul-10` | cabeçalho de bloco e destaque neutro |
| `.num` (DM Mono) | apenas números: pontuação, distância, protocolo, posição na fila |

**Cinco regras de interação**

1. **Uma decisão por tela.** Dois campos só quando são inseparáveis (CEP + número).
2. **Salvamento contínuo, visível.** Micro-rótulo "Salvo" com *timestamp* após cada etapa, e `Salvar e sair` que devolve um código de retomada.
3. **Nunca perguntar o que a base responde.** Se a base não responder, o campo *aparece* — não vem oculto por padrão.
4. **Nenhuma consequência sem aviso prévio.** Marcar um critério da trilha C obriga a comparecer: isso é dito **antes** do toque, não depois.
5. **Toda ação irreversível pede confirmação nomeada** — o botão diz o que faz ("Enviar inscrição"), nunca "OK".

**Estados obrigatórios em cada tela:** vazio · carregando (*skeleton*, nunca *spinner* solto) · erro de rede com "Tentar de novo" · sucesso · offline ("sem conexão — seus dados estão salvos neste aparelho").

---

## Tela 1 — Porta de entrada `/`

**Objetivo:** em 5 segundos a pessoa sabe se está no lugar certo e o que vai fazer.

- **H1:** *Inscrição em creche da Prefeitura do Rio*
- **Uma linha:** *Para crianças de 6 meses a 3 anos. Leva cerca de 5 minutos.*
- **Bloco "Antes de começar"** — 3 itens com ícone, sem parágrafo:
  - CPF ou certidão de nascimento da criança
  - CEP e número de onde a criança mora
  - Um celular que receba SMS
- **Ação primária:** `Começar inscrição` (botão de largura total no celular)
- **Ações secundárias, em linha:** `Retomar inscrição` · `Acompanhar inscrição` · `Preciso de ajuda`
- **Tarja de protótipo** (`tarja border-l-atencao`), fixa no topo, fora do miolo: *Protótipo do Claude Impact Lab. Não é canal oficial — a inscrição válida é no matricula.rio.* Com `Reiniciar demonstração`.

**Por quê:** o "Sobre este protótipo" hoje está no rodapé, onde ninguém lê, e o botão "Nova simulação" aparece no fim do fluxo, onde quebra a ilusão de serviço. Invertido: o aviso vem antes, o serviço roda inteiro sem se interromper.

---

## Tela 2 — Identificação

**Objetivo:** obter o CPF verificado — a chave sem a qual nada é consultado.

- **H1:** *Vamos começar pelo seu login*
- **Instrução:** *Entre com a sua conta gov.br. É o que permite consultar seus dados nos sistemas do governo, para você não precisar digitar nem levar papel.*
- **Primário:** `Entrar com gov.br` (botão na identidade do gov.br)
- **Secundário:** `Não tenho conta gov.br` → painel com dois caminhos, sem beco sem saída:
  - `Criar conta agora` (abre gov.br em nova aba, com aviso de que a inscrição fica salva)
  - `Fazer no polo ou pelo 1746` → mostra polo mais próximo + telefone
- **Na demonstração:** cartão `Entrar como uma destas famílias` — 3 a 5 perfis reais anonimizados da base de 2025, cada um com um selo do que a demo vai provar (`CadÚnico ativo`, `Sem nenhum critério`, `Precisa comprovar`). Fica dentro da tarja de protótipo, visualmente separado.

**Estado de erro:** falha no gov.br não descarta nada — *"Não conseguimos falar com o gov.br agora. Seus dados estão salvos. Tente de novo em alguns minutos ou vá ao polo."*

---

## Tela 3 — Consentimento

**Objetivo:** permissão informada, em uma tela, sem parede de texto.

- **H1:** *Podemos consultar seus dados nos sistemas do governo?*
- **Instrução:** *Assim você não precisa digitar nem levar documento do que o governo já sabe.*
- **Lista nominal das bases consultadas** — cartão com uma linha por base, e **o que exatamente é lido**:

| Sistema | O que consultamos |
|---|---|
| Receita Federal | nome e data de nascimento seus e da criança |
| CadÚnico (CECAD) | se sua família está inscrita e quando foi atualizada |
| Bolsa Família / Cartão Carioca | se o benefício está ativo |
| INSS / BPC | benefício por deficiência seu ou da criança |
| Sistema de Gestão Acadêmica (SME) | se a criança tem irmão matriculado na rede |
| Histórico da própria inscrição | se você esperou na fila no ano passado |

- **Uma caixa de seleção, obrigatória:** *Autorizo a consulta destes dados para a minha inscrição na creche.*
- **Duas linhas em `text-texto-3`:** finalidade e prazo de guarda; *link* `Ler o termo completo` (abre painel lateral, não outra página).
- **Se recusar:** não é bloqueio cego. `Prefiro não autorizar` → *"Sem a consulta, você precisa declarar cada critério e comprovar todos no polo. É o processo antigo, e é o que fez 6 de cada 10 famílias perderem pontos em 2025."* — **este é o único lugar do formulário onde um número de diagnóstico se justifica**, porque aqui ele é consequência direta da escolha que a pessoa está fazendo agora.

---

## Tela 4 — A criança

**Objetivo:** obter a chave da criança e derivar tudo o que dela decorre.

- **H1:** *Qual é o CPF da criança?*
- **Instrução:** *O CPF sai junto com a certidão de nascimento. Com ele, o nome e a data vêm preenchidos.*
- **Campo:** `crianca.cpf` — `campo num`, teclado numérico, máscara `000.000.000-00`, validação de dígito verificador no *blur*, 1 campo só na tela.
- **Alternativa visível, não escondida:** `A criança não tem CPF` → troca para `crianca.dnv` (Declaração de Nascido Vivo, 11 dígitos) + faixa: *"Você pode tirar o CPF da criança agora, de graça, no site da Receita — a inscrição fica salva."*
- **Ao validar, o cartão de retorno** (`cartao border-ok`, entrada animada de baixo, ~400 ms):

```
┌─ ✓ Encontramos a criança ───────────────────────┐
│ MARIA ... DA SILVA                              │
│ Nascida em 14/07/2023                           │
│ Turma: Maternal I  (2 anos em 31/03/2026)       │
│ ─────────────────────────────────────────────── │
│ Receita Federal · consultado hoje às 14:32      │
│ Não é esta criança? [Corrigir CPF]              │
└─────────────────────────────────────────────────┘
```

- **A turma nunca é campo.** Aparece dentro do cartão, como resultado. O texto atual — *"A família não escolhe: o sistema deriva da data de nascimento"* — explica ao gestor por que a decisão foi tomada. Para a família basta: *"A turma é definida pela idade da criança em 31 de março."* O resto vai para `› Por que pedimos isso?`.
- **Fora de faixa:** mantém a mensagem atual, que está boa, com destino: *"Pela data informada, a criança não se enquadra em creche neste processo (até 3 anos incompletos em 31/03). Veja como se inscrever em pré-escola →"*. Hoje é um beco sem saída.
- **Vínculo:** se o CPF da criança não constar como dependente/filiação, **não bloquear** — marcar `vinculo_confirmado = false`, seguir, e pedir documento de vínculo no Período 2. Bloquear aqui exclui arranjos familiares reais (avó, tia, guarda de fato).

---

## Tela 5 — Onde a criança mora

**Objetivo:** endereço bom o suficiente para geocodificar, sem digitação livre de bairro.

- **H1:** *Onde a criança mora?*
- **Instrução:** *Usamos para mostrar as creches mais perto e para desempatar por proximidade.*
- **Dois campos, inseparáveis:** `CEP` (8 dígitos, teclado numérico, `campo num`) e `Número` (com alternância `s/n`).
- **Retorno da consulta** (`cartao`, leitura):

```
┌─ Endereço encontrado ───────────────────────────┐
│ Rua Silva Xavier, 120                           │
│ Bairro:  ENGENHO NOVO                           │
│ Complemento (opcional): [ ______________ ]      │
│ Não é aqui? [Corrigir CEP]                      │
└─────────────────────────────────────────────────┘
```

- **Bairro é sempre leitura, derivado do CEP.** Nunca lista, nunca texto livre. Quando o CEP não resolver, aí sim aparece um seletor — e com a **lista canônica de 164 bairros oficiais**, com busca por digitação e correspondência tolerante a acento e caixa, de modo que `jacarepagua` encontre `JACAREPAGUÁ`. As 1.607 variações da base ficam num dicionário de normalização **no servidor**; o usuário nunca vê duas grafias do mesmo bairro.
- **Precisão geográfica dita ao usuário, sem termo técnico.** Onde `precisao_geo != exata` (CEP único cobrindo milhares de endereços — Rocinha, Manguinhos, Anil, Gardênia Azul, Santa Cruz), faixa `tarja border-l-atencao`: *"Neste CEP a distância é calculada pelo centro da região, não pela sua casa. Se a creche mais perto não aparecer no topo, você ainda pode escolhê-la na lista."* Assumir a limitação na interface é mais forte que esconder — e é a mesma limitação que o mapa já documenta.
- **Endereço alternativo** (trabalho/cuidador), opcional, atrás de `+ Tem outro endereço onde a criança fica de dia?` — com o peso explicado em linguagem simples: *"conta um pouco menos que o endereço de casa"*.

---

## Tela 6 — O horário

**Objetivo:** turno + a pergunta nova que multiplica assentos.

- **H1:** *De qual horário você precisa?*
- **Duas opções grandes, em cartão selecionável** (não `radio` pequeno), com `grid gap-3 sm:grid-cols-2`:

```
┌──────────────────────────┐  ┌──────────────────────────┐
│ ● Dia inteiro            │  │ ○ Meio período           │
│   7h às 17h              │  │   4 horas                │
│   Com refeições          │  │   Manhã ou tarde         │
└──────────────────────────┘  └──────────────────────────┘
```

- **Segundo campo, na mesma tela** (é uma pergunta de sim/não que decorre da primeira):
  *Se não houver vaga de dia inteiro, você aceita meio período?* — `Sim` / `Não`
  **Apoio, com o incentivo dito de frente:** *"Quem aceita as duas opções concorre a mais vagas. Você pode mudar isso depois."*

---

## Tela 7 — O que já sabemos (a tela que substitui 8 perguntas)

**Esta é a tela central da proposta e a mais importante da apresentação.**

- **H1:** *Consultamos os sistemas do governo. Isto é o que encontramos.*
- **Instrução:** *Você não precisa confirmar nem provar nada disto. Se algo estiver errado, pode contestar.*
- **Chegada dos cartões um a um**, ~250 ms de intervalo, com contador ao vivo: `Consultando… 3 de 6 sistemas`. Cada cartão traz **fonte e data** — é o que substitui o comprovante de papel:

```
┌─ ✓ Renda ───────────────────────────── 35 pts ──┐
│ Confirmada pelo CadÚnico.                       │
│ Cadastro atualizado em 12/03/2024.              │
│ CECAD/Dataprev · consultado hoje às 14:33       │
│                 [Ver detalhe] [Isto está errado]│
├─ ✓ Cuidado no núcleo ──────────────── 10 pts ───┤
│ Você é a única adulta no domicílio.             │
│ Composição familiar do CadÚnico · hoje          │
├─ ✓ Irmão na rede ──────────── desempate ────────┤
│ João, EDI Ladeira dos Funcionários.             │
│ Sistema de Gestão Acadêmica · hoje              │
├─ ✓ Espera ───────────────────────────── 3 pts ──┤
│ Você aguardou vaga no processo anterior.         │
│ Histórico da inscrição · hoje                   │
├─ — Deficiência e saúde ─────────────────────────┤
│ Não encontramos registro.                       │
│ INSS/BPC + rede SME + SISVAN · consultado hoje  │
│           [A criança tem laudo — quero informar]│
└─────────────────────────────────────────────────┘
```

> **Os cartões acima já seguem a régua nova (`REGUA_DE_PONTUACAO.md`).** O valor em reais e o nome da faixa de renda **nunca aparecem no cartão** — ver Parte 4, §4.4. Os dois novos estados obrigatórios deste cartão (**cadastro vencido** e **sem cadastro**) estão especificados em §4.5.

- **Aqui a pontuação aparece — e deve aparecer.** A diferença é decisiva: **o número está do lado do que já foi confirmado, não do lado de uma pergunta.** Não há como induzir resposta em campo de leitura. É o oposto de mostrar "51 pontos" ao lado de uma caixa de seleção.
- **Base não respondeu ≠ base respondeu "não".** Estado próprio, cinza, nunca vermelho: *"O sistema do CadÚnico não respondeu agora. Vamos tentar de novo automaticamente e avisar você."* Nada de tratar indisponibilidade como ausência de direito.
- **Contestação, não declaração.** `Isto está errado` abre um painel: escolha do motivo em lista fechada, campo livre curto, e a consequência dita sem rodeio — *"A contestação vai para análise humana e não muda sua pontuação agora."* O caminho padrão é a base; a palavra da família é a exceção que precisa de prova.
- **Encerramento da tela, e é o argumento da apresentação dito ao usuário sem estatística:**
  *"Estas 6 informações não foram perguntadas a você. Sobraram 5 perguntas — as que nenhum sistema do governo responde."*

---

## Tela 8 — As 5 perguntas (uma por tela)

**Objetivo:** obter as únicas declarações que restam, com a consequência à frente da resposta.

- **Tela de abertura, antes da primeira pergunta:**
  **H1:** *Faltam 5 perguntas*
  *São situações que nenhum sistema do governo registra. Se você marcar "sim" em alguma, vai precisar comprovar depois — pela internet ou num ponto de atendimento. **Marcar "não" não prejudica nada do que já foi confirmado.***

- **Cada pergunta ocupa uma tela**, com dois botões grandes lado a lado (`Sim` / `Não`), avanço automático ao responder, contador `Pergunta 2 de 5`, e `Voltar` sempre disponível. Texto reescrito para pessoa, não para norma:

| # | Hoje (texto da base 2025) | Proposto |
|---|---|---|
| 1 | *A criança e/ou familiar do seu convívio diário é vitima de violência doméstica?* | **A criança ou alguém que convive com ela sofre violência em casa?** |
| 2 | *A criança e/ou alguém do núcleo familiar apresentam doenças crônicas graves?* | **A criança ou alguém da família tem uma doença grave e de longa duração?** |
| 3 | *Existe algum membro do núcleo familiar que faz uso abusivo de drogas e/ou alcoól?* | **Alguém da família faz uso abusivo de álcool ou outras drogas?** |
| 4 | *Existe algum membro do núcleo familiar que é presidiário ou ex-presidiário nos últimos 5 anos?* | **Alguém da família está preso ou foi preso nos últimos 5 anos?** |
| 5 | *O candidato é refugiado?* | **A criança ou você é refugiado ou pediu refúgio no Brasil?** |

> **Superado em parte pela régua nova.** A régua de `REGUA_DE_PONTUACAO.md` exige **grau**, não Sim/Não: as perguntas 1, 2 e 4 ganham um qualificador de *quem*, e há duas perguntas condicionais novas. A versão vigente desta tela é **§4.8**; a tabela acima continua valendo para a reescrita do texto.

- **A pontuação não aparece ao lado da pergunta.** Aparece na Tela 9, na decomposição. Isso remove o incentivo a marcar por marcar.
- **Ao responder "sim", uma linha só, imediata**, em `atencao-fundo`: *"Vamos pedir um documento. Dá para enviar pelo celular."* — sem lista, sem parágrafo. A lista completa é a Tela 10.
- **Perguntas 1, 3 e 4 tratam de dado sensível e a tela precisa dizer isso, curto:** *"Esta resposta é protegida e vista apenas por quem analisa a sua inscrição."* Sem esse aviso, a taxa de resposta honesta cai — e é justamente onde a trilha B (CREAS, CRAS, CAPS-AD lançando a atestação) deve ser oferecida como caminho preferencial: *"Se um serviço já acompanha sua família, ele pode informar isso direto no sistema e você não precisa levar documento."*

---

## Tela 9 — Sua pontuação

**Objetivo:** dizer, pela primeira vez neste processo, quanto a família tem, de onde veio cada ponto e o que ainda pode somar.

> **Substituída pela régua nova.** O objetivo e os princípios abaixo continuam válidos, mas a decomposição por critério cede lugar à decomposição **por bloco, com teto**, e a pontuação se divide em `confirmados` / `a confirmar`. A versão vigente desta tela é **§4.7**. O exemplo abaixo usa a régua de 2025 e está mantido apenas como contraste.

- **H1:** *Sua pontuação: 57 de 100*
- **Número grande** (`num text-[26px] font-black text-azul`, aumentar para `clamp(40px,9vw,64px)`), com **barra segmentada** — verde para confirmado, hachurado/amarelo para a confirmar:

```
Sua pontuação
  57  confirmados        ▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 57 / 100
+  4  se você comprovar

┌─ De onde vem cada ponto ────────────────────────┐
│ ✓ CadÚnico                          51   base   │
│ ✓ Família monoparental               4   base   │
│ ✓ Bolsa Família                      2   base   │
│ ⏳ Violência em casa                  4   falta  │
│ ✓ Irmão na rede               desempate  base   │
└─────────────────────────────────────────────────┘
```

- **Cada linha traz a origem em uma palavra:** `base` (consultado) · `serviço` (atestado por CREAS/CRAS/UBS/CAPS) · `falta` (aguarda comprovação sua). Sem "trilha A/B/C".
- **A regra da perda por critério dita explicitamente** — é a frase que hoje ninguém consegue dizer à família, e ela precisa estar na tela, não no roteiro do palco:
  *"Se você não comprovar a violência em casa, perde **só esses 4 pontos**. Os 51 do CadÚnico já estão confirmados e não se perdem."*
- **Sem nenhum critério (26% das inscrições):** não pode ser tela de fracasso. *"Sua inscrição está válida e vai concorrer às vagas. Você não se encaixa nos critérios de prioridade, então o desempate será por proximidade da creche e por sorteio auditável."* — e não *"empatada com 93,8% da fila"*.
- **Ação primária:** `Escolher as creches →` · **secundária:** `Ver como a pontuação é calculada` (abre painel com a régua da Resolução 542 item a item).

---

## Tela 10 — O que você precisa comprovar *(só para os ~13%)*

**Objetivo:** transformar uma pendência burocrática em uma tarefa de dois toques.

- **H1:** *Falta comprovar 1 coisa*
- **Instrução:** *Você tem até 20/10 (30 dias). Pode enviar pelo celular ou levar num ponto de atendimento.*
- **Um cartão por critério pendente:**

```
┌─ Violência em casa · 4 pontos ────── ⏳ falta ──┐
│ Serve qualquer um destes:                       │
│  • Declaração do CREAS, CRAS ou Conselho Tutelar│
│  • Medida protetiva de urgência                 │
│  • Registro de ocorrência (até 12 meses)        │
│  • Relatório de serviço socioassistencial       │
│                                                 │
│  [ 📷 Tirar foto ]  [ 📎 Enviar arquivo ]        │
│  ou  [ Ver pontos de atendimento perto de mim ] │
│                                                 │
│  ↳ Se o CREAS já acompanha sua família, ele     │
│    pode informar direto — você não leva nada.   │
│    [Quero essa opção]                           │
└─────────────────────────────────────────────────┘
```

- **Captura pela câmera com moldura e verificação de nitidez antes do envio**; JPG/PNG/PDF, até 10 MB, até 5 arquivos por item; miniatura com `Remover`; barra de progresso real.
- **Estados por item, com o mesmo vocabulário do começo ao fim:** `Falta enviar` → `Recebido` → `Em análise` → `Confirmado` / `Precisa corrigir` (com o motivo, sempre) / `Não aceito` (com o motivo e `Pedir revisão — 3 dias úteis`). Nunca "indeferido" sem motivo na tela.
- **O canal presencial nunca fica em segundo plano.** `Ver pontos de atendimento` tem o mesmo peso visual do envio digital — comprovação só por aplicativo reintroduz, no ponto mais sensível, a exclusão que o desenho quer eliminar.
- **`Fazer isso depois`** é uma saída legítima e visível, com o prazo repetido. Bloquear a inscrição por causa da comprovação é reproduzir a fila do polo dentro do aplicativo.

---

## Tela 11 — Escolher as creches

**Objetivo:** escolher 3, na ordem verdadeira, sabendo a chance real de cada uma. Reaproveita o mapa de `mapa-vagas-creche-rio.html`.

- **H1:** *Escolha até 3 creches, na ordem que você preferir*
- **Instrução, e é a mais importante da tela:** *Coloque na ordem que você realmente quer. Dizer a verdade nunca diminui sua chance de vaga.* (o texto atual já diz isso — manter, é uma garantia real de mecanismo e a família precisa acreditar nela)
- **Alternância `Lista` / `Mapa`**, com lista como padrão no celular. No mapa, marcadores dimensionados por vaga e a casa da família como referência.
- **Cartão de cada creche, com a anotação que só existe porque a pontuação veio antes:**

```
┌─────────────────────────────────────────────────┐
│ EDI LADEIRA DOS FUNCIONÁRIOS                    │
│ Engenho Novo · 1,2 km                           │
│ Maternal I · dia inteiro                        │
│ ─────────────────────────────────────────────── │
│ 8 vagas · 46 crianças na fila                   │
│ 🟡 Com sua pontuação, 12 crianças na sua frente │
│                              [ + Escolher ]     │
└─────────────────────────────────────────────────┘
```

- **Semáforo de chance, em três níveis e com palavra junto da cor** (nunca cor sozinha): 🟢 *chance alta* · 🟡 *chance média* · 🔴 *fila longa*. Substitui "candidatos por vaga" — que é métrica de gestor.
- **As escolhidas ficam em bloco fixo no topo**, numeradas `1ª` `2ª` `3ª`, com:
  - **arrastar para reordenar** no celular (alvo ≥48 px, `touch-action: none`),
  - **e** as setas ↑↓ como alternativa acessível, ampliadas de 40 → 48 px,
  - **e** um seletor numérico para leitor de tela (`Posição: 1 ▾`).
  As três vias juntas — hoje só existem as setas de 40 px, que é a pior das três isoladamente.
- **Busca** `Buscar por nome ou bairro` (o placeholder atual, `Ex.: Caju, CM Ladeira`, está bom) + filtros em `chips`: `Perto de casa` · `Dia inteiro` · `Meio período` · `Com vaga agora`.
- **Vazio:** *"Nenhuma creche encontrada com esse nome. [Limpar busca]"* — com ação, não só a frase de hoje.
- **Carregando:** *skeleton* de 3 cartões, não a mensagem `Carregando creches…`.
- **Aviso "um convite, não três", reescrito** e movido para o momento em que a terceira é escolhida — não como nota de pé de página: *"Você vai receber **um** convite: da melhor opção que conseguirmos. As outras continuam valendo — se abrir vaga numa opção melhor, a gente muda sua criança automaticamente."*

---

## Tela 12 — Contato

**Objetivo:** garantir que a convocação chegue — pode acontecer 13 meses depois.

- **H1:** *Para onde avisamos quando sair a vaga?*
- **Instrução:** *A vaga pode sair em alguns meses. Confirme um número que você vá continuar usando.*
- **Campos:** celular (máscara, teclado numérico) · `Este número tem WhatsApp` (sim/não) · e-mail (opcional) · **canal preferido** em cartões selecionáveis: `WhatsApp` `SMS` `E-mail` `Ligação` · telefone alternativo (opcional, atrás de `+ Adicionar outro telefone`).
- **Verificação na hora:** `Enviar código` → 6 dígitos em campo `num`, colagem automática, reenvio com contador de 60 s, `Não recebi o código` → SMS / ligação / trocar número.
- **Selo de confirmação:** `✓ Celular confirmado às 14:41`.
- Não exibir o cálculo dos 44,1% de "cancelado pelo sistema" — a razão de existir da tela é interna. Para a família, `A vaga pode sair em alguns meses` já produz o comportamento correto.

---

## Tela 13 — Revisão e envio

**Objetivo:** conferência em uma tela, com edição pontual sem perder o lugar.

- **H1:** *Confira antes de enviar*
- **Instrução:** *Pode alterar qualquer resposta. Nada é enviado até você tocar em "Enviar inscrição".* (o texto atual está correto; só mais curto)
- **Blocos em `cartao divide-y divide-linha`**, cada um com `Alterar` que abre a etapa **em painel modal** e volta para a revisão — não relança o passo a passo:
  Criança · Endereço · Horário · Pontuação (57 + 4 a comprovar) · Creches escolhidas (1ª/2ª/3ª) · Contato · Comprovação pendente
- **Distinção visual entre o que é seu e o que é do governo:** linhas com origem `base` recebem selo `✓ confirmado` e **não têm `Alterar`** — reforça, no último olhar, que aquilo não é declaração sua.
- **Botão:** `Enviar inscrição` — largura total, ≥52 px no celular, com estado `enviando…` bloqueando duplo toque.
- **Erro de envio:** mantém a lista de erros por campo, mas cada erro é um **link que leva ao campo**. Hoje, *"Volte à primeira etapa: falta o nascimento ou o horário"* pede que o usuário resolva a navegação sozinho.

---

## Tela 14 — Inscrição registrada

**Objetivo:** provar que acabou, e dizer o que vem depois.

- **H1:** *Inscrição registrada*
- **Protocolo em destaque** (`num font-mono`, ≥24 px) com `Copiar` e `Enviar por WhatsApp`.
- **Cartão de resumo:** criança · turma · pontuação (57 confirmados + 4 a comprovar) · as 3 creches na ordem · posição estimada na 1ª opção.
- **"O que acontece agora", em 3 passos numerados e datados** — a família precisa saber o desenho de 4 períodos sem ouvir a palavra "período":

```
1 ✓ Hoje          Inscrição registrada
2 ⏳ Até 20/10     Você envia o documento da violência em casa
                  [Enviar agora]
3 ○ A partir de   Se abrir vaga na sua ordem de preferência,
     novembro     avisamos no WhatsApp. Você tem 3 dias para responder.
```

- **Ações:** `Acompanhar inscrição` · `Baixar comprovante (PDF)` · `Inscrever outra criança`.
- **A frase que fecha, e substitui "empatada com 93,8% da fila":** *"Sua pontuação já está confirmada nos sistemas do governo. Você não precisa ir a nenhum lugar para provar o que já confirmamos."*
- **Fora do cartão, na tarja de protótipo:** `Rodar próxima rodada` e `Reiniciar demonstração` — os controles da demo existem, mas do lado de fora do serviço.

---

## Tela 15 — Acompanhar `/acompanhar`

**Objetivo:** responder "e a minha vaga?" sem ligar para ninguém.

- **Entrada:** protocolo **ou** CPF do responsável.
- **Linha do tempo vertical, com carimbo de hora em cada evento** — é a mesma tabela `evento` do painel, filtrada pela família, e é o que hoje não existe em 837 mil linhas de base:

```
● 30/08 14:41  Inscrição registrada · protocolo 2025-195-0184773
● 30/08 14:33  Pontuação confirmada: 57 pontos
○ ——           Documento da violência em casa: falta enviar  [Enviar]
○ ——           Aguardando vaga · 12 crianças na frente na 1ª opção
```

- **Faixa de revalidação de contato** quando passar de 90 dias sem confirmação: *"Seu celular ainda é (21) 9xxxx-xxxx? [Sim, é este] [Trocar]"* — um toque, porque é o que impede a família de virar "cancelado pelo sistema".
- **Convite ativo:** cartão em `ok-fundo`, contagem regressiva visível, `Aceitar a vaga` / `Recusar`, e a consequência de cada um escrita **antes** do toque.

---

# Parte 3 — Fora do formulário

## 3.1 `/como-funciona` — o destino de todo número que sai do fluxo

Página pública que recebe o que hoje polui os campos: as 13 → 5 perguntas, as três formas de comprovação, a régua da Resolução 542 item a item, o sorteio auditável e sua semente, a limitação da distância por bairro, e os 74% → 13% de redução da fila presencial. É também a página que a apresentação usa, e o *link* `› Por que pedimos isso?` de cada tela aponta para a âncora certa dela.

**Ganho duplo:** o formulário fica limpo para a família, e o argumento fica mais forte por estar reunido num lugar só, em vez de picado em sete textos de apoio.

## 3.2 `/painel` — a tela da rede

Já existe na navegação. Deve absorver o resto: fila de análise com SLA de 3 dias úteis, itens estourados no topo, análise às cegas (o analista não vê pontuação nem unidade pretendida), motivo obrigatório de lista fechada para indeferir, segunda análise quando a decisão muda faixa de classificação, e o log de eventos crescendo em tempo real.

## 3.3 Modo assistido

O mesmo formulário, operado por servidor no polo, na unidade ou pelo 1746. Front: faixa persistente `Atendimento assistido · servidor M. SANTOS · matrícula 00.000-0`, campo de `canal` e `operador_id` gravados, e um botão `Encerrar atendimento` que limpa o estado antes do próximo atendido. Sem isso, exigir gov.br prata desloca a exclusão digital do fim do processo para o começo.

---

# Parte 4 — O que a régua nova exige do front

Referências: `REGUA_DE_PONTUACAO.md` (5 blocos, 18 graus, teto por bloco) e `BACKTEST_REGUA.md` (11 testes, e a inversão da ordem de implantação).

## 4.1 O princípio, e os três pontos onde ele não se sustenta sozinho

**A lógica da régua não aparece.** A família nunca lê "bloco", "grau", "degrau", "teto por bloco", "extrema pobreza", "aferição", nem vê a régua de 18 graus. Vê pontos, origem de cada ponto e o que pode somar.

Mas a régua nova não é uma troca de pesos — muda **a natureza da informação de entrada** em três frentes, e cada uma bate no front:

| # | Mudança na régua | Por que vaza para a tela |
|---|---|---|
| **a** | Renda deixa de ser booleano e passa a ser escada aferida | novos dados consultados ⇒ o consentimento nominal (Tela 3) cresce, e cresce para dado sensível |
| **b** | Blocos 2 e 3 exigem **grau**, não Sim/Não | as 5 perguntas remanescentes deixam de ser binárias — precisam de um qualificador de *quem* |
| **c** | **Teto por bloco**: dentro do bloco vale o maior, não a soma | quebra a aritmética do usuário. Quem marca violência (20) e drogas (15) espera 35 e recebe 20. Sem explicação na tela, isso é lido como erro do sistema |

E há uma quarta, que vem do backtest e é a mais consequente para o desenho:

> **Teste 10 — publicar a régua nova sobre dado autodeclarado seria pior do que manter a régua atual.** Ao elevar os critérios de risco agudo de 2–4 para 10–25 pontos, ela amplifica um sinal que se contradiz em 80% a 92% dos casos entre processos.

Isso não é observação acadêmica: **define uma regra de interface.** Ponto declarado e não confirmado **não pode entrar no número grande da pontuação**. Ver §4.7.

## 4.2 Campos novos, por bloco

`S` = sistema (consulta) · `F` = família (declara) · `D` = derivado. "Existe hoje" = está no formulário atual do site **ou** já estava previsto na Parte 2 deste documento.

### Bloco 1 — Renda aferida (0–35)

| Campo | Classe | Fonte | Existe hoje | Tela |
|---|---|---|---|---|
| `cadunico.renda_per_capita` | S | CECAD/Dataprev | **não** | 7 |
| `cadunico.data_atualizacao` | S | CECAD/Dataprev | previsto (era só exibição) — **agora vale pontos**, o degrau de 6 | 7 |
| `cadunico.faixa_renda` | D | derivado dos dois acima | **não** | 7 |
| `cadunico.ativo` | S | CECAD/Dataprev | sim | 7 |

**A renda per capita é o único campo novo sem o qual a régua nova degrada para a régua de hoje.** O documento a chama de "integração de maior retorno de todo o projeto", e o backtest confirma: sem ela, o ganho no bloco de empate cai de 22,2%→11,7% para 22,2%→20,7%.

### Bloco 2 — Proteção e risco (0–25, maior item)

| Campo | Classe | Fonte | Existe hoje | Tela |
|---|---|---|---|---|
| `medida_protetiva_crianca` | S | Vara da Infância / Conselho Tutelar / SIPIA | **não — critério inteiramente novo** | 7 |
| `acolhimento_institucional` | S | SMAS / abrigo | **não — critério inteiramente novo** | 7 |
| `violencia.alvo` = `criança` \| `núcleo` | F declara, serviço atesta | CREAS/CRAS/Conselho Tutelar | **não** — hoje a pergunta é única e binária | 8 |
| `substancias` | F declara, serviço atesta | CAPS-AD/CRAS | sim (binário; grau único, 15) | 8 |
| `privacao_liberdade.vinculo` = `responsável direto` \| `outro membro` | F | — | **não** — hoje é "algum membro do núcleo" | 8 |

⚠️ **`privacao_liberdade.vinculo` é o único campo novo que pode *reduzir* a pontuação de quem hoje pontua.** A régua nova pontua apenas "responsável direto privado de liberdade" (10). Quem responder "outra pessoa da casa" recebe **0** — hoje receberia 2. Não é erro da régua (é o teto por bloco funcionando), mas é uma perda concreta para um subgrupo, e a SME precisa decidir se quer um grau menor para "outro membro" antes de o front perguntar. **Assumi que sim** e especifiquei a pergunta com as duas opções, para não travar o desenho: se a SME optar por manter 0, a opção continua sendo necessária — o sistema precisa saber por que atribuiu zero.

### Bloco 3 — Deficiência e saúde (0–25, maior item)

| Campo | Classe | Fonte | Existe hoje | Tela |
|---|---|---|---|---|
| `educacao_especial` | S | BPC/INSS + SGA | sim | 7 |
| `deficit_nutricional` | S | SISVAN / rede municipal de saúde | **não — critério inteiramente novo** | 7 |
| `doenca_cronica.alvo` = `criança` \| `outro membro` | F declara, laudo confirma | médico (CRM) | **não** — hoje é único e binário (18 vs 8) | 8 |
| `responsavel.deficiencia_ou_incapacitante` | S + F | BPC/INSS **ampliado** para doença incapacitante | parcial — hoje só deficiência via BPC | 7 / 8 |

O BPC não cobre "doença incapacitante" sem benefício concedido. Ou o critério ganha uma via de atestação por serviço de saúde, ou o front precisa de uma pergunta declarada residual. **Especifiquei a pergunta residual, condicional** — aparece só quando o BPC não responde.

### Bloco 4 — Capacidade de cuidado (0–10, maior item)

| Campo | Classe | Fonte | Existe hoje | Tela |
|---|---|---|---|---|
| `composicao_familiar.adultos_no_domicilio` | S | CadÚnico | **não** | 7 |
| `responsavel_unico` (sem outro adulto) | D | composição do CadÚnico | **não — grau máximo do bloco, 10 pts** | 7 |
| `monoparental` | S | composição do CadÚnico | previsto | 7 |
| `responsavel_unico_60mais` | D | Receita (nascimento do tutor) + composição | **não** | 7 |
| `responsavel_menor_18` | D | Receita | previsto (era desempate; **agora vale 4 pontos**) | 7 |
| `mora_com_outro_adulto` | F | — | **não** — pergunta condicional, só sem CadÚnico | 8 |

**O Bloco 4 inteiro depende da composição familiar do CadÚnico.** Para os ~51% da fila sem cadastro, o bloco zera por ausência de fonte, não por ausência de condição — o que reintroduz, num bloco novo, o mesmo defeito de acesso que a régua quer corrigir. Daí a pergunta condicional. **Assumi que a declaração dá acesso apenas ao grau de 6 (monoparental), nunca ao de 10** — o grau máximo exige aferição. É a regra que o backtest recomenda: não deixar declaração carregar peso alto.

### Bloco 5 — Espera e deslocamento (0–5, soma com teto)

| Campo | Classe | Fonte | Existe hoje | Tela |
|---|---|---|---|---|
| `processos_em_espera` (contagem) | D | histórico do módulo IC | **não** — hoje só existe "aguardou no ano anterior" | 7 |
| `fila_processo_anterior` | S | histórico IC | sim | 7 |
| `refugiado` | F | (SISCONARE/PF quando integrar) | sim | 8 |

`processos_em_espera` é derivável do histórico que a SME já tem, mas **exige chave estável de criança entre processos** — CPF ou DNV. É o segundo argumento para a Tela 4: sem chave, não há como contar dois processos de espera da mesma criança.

### Transversais, no modelo de dados

| Campo | Por que a régua nova exige |
|---|---|
| `inscricao_criterio.grau` | os blocos 2, 3 e 4 têm 3–4 graus. `valor` booleano não representa mais o critério |
| `inscricao_criterio.grau_origem` = `aferido` \| `atestado` \| `declarado` | separa o que entra no score do que fica "a confirmar" (§4.7) |
| `inscricao_criterio.bloco` | o teto por bloco precisa do agrupamento gravado, não inferido |
| `inscricao.regua_versao` | vigência de 3 processos + gatilho publicado. Precisa aparecer no comprovante |
| `inscricao.pontos_por_bloco[]` | é o que a Tela 9 renderiza; recalcular no cliente convida a divergência |

## 4.3 Consentimento (Tela 3) — a lista cresce, e cresce para dado sensível

A tabela da Tela 3 passa a ter três seções, porque a base legal não é a mesma para todas:

**Consulta comum** (LGPD art. 7º, III — execução de política pública):

| Sistema | O que consultamos |
|---|---|
| Receita Federal | nome e data de nascimento seus e da criança |
| CadÚnico (CECAD/Dataprev) | **renda por pessoa, quem mora com você e a data do cadastro** |
| Sistema de Gestão Acadêmica (SME) | se a criança tem irmão matriculado na rede |
| Histórico da própria inscrição | em quantos processos você já esperou vaga |

**Consulta de dado sensível** (art. 11, II, "b") — **caixa de seleção própria, separada**:

| Sistema | O que consultamos |
|---|---|
| INSS / BPC | benefício por deficiência seu ou da criança |
| Rede municipal de saúde / SISVAN | acompanhamento nutricional e de saúde da criança |

**Informação protegida de outro órgão** — *não* é caixa de seleção, é **aviso**:

| Sistema | O que consultamos |
|---|---|
| Vara da Infância · Conselho Tutelar · acolhimento (SMAS) | se existe medida de proteção em favor da criança |

Três consequências de desenho, e a terceira é de segurança:

1. **"Renda por pessoa" tem de estar escrito com essas palavras.** O termo precisa listar nominalmente cada base *e a finalidade*; "dados do CadÚnico" não cumpre isso quando o que se lê é renda.
2. **Caixa separada para o sensível**, com recusa possível: quem recusa perde os blocos 2 e 3, e a tela diz isso — *"sem essa autorização não conseguimos considerar deficiência, saúde nem situações de risco na sua pontuação."*
3. **A consulta de medida protetiva não pode ser condicionada ao consentimento do responsável, e não pode ser exibida como cartão no fluxo da família.** O responsável que preenche pode ser a pessoa contra quem a medida foi expedida. Ver §4.6.

## 4.4 A renda na tela: pontos sim, faixa e valor nunca

O cartão de renda mostra **"Renda confirmada pelo CadÚnico · 35 pontos · cadastro atualizado em 12/03/2024"**. Não mostra `R$ 94,00`, não mostra `Extrema pobreza`, não mostra `Grau 1 de 6`.

Três razões, e nenhuma é estética:

- **Estigma.** Carimbar "extrema pobreza" na tela de alguém não acrescenta nada à decisão que a pessoa está tomando ali.
- **O polo é um balcão.** No modo assistido, a tela é vista pelo servidor e por quem estiver na fila atrás. Valor de renda em tela é exposição.
- **Contestação sem alvo.** Se a faixa aparece e a família discorda, a contestação cai na SME — que não é dona do dado. O caminho correto é o CRAS, e é o que o botão deve oferecer.

`[Ver detalhe]` — um toque deliberado, nunca aberto por padrão — revela a faixa e a data, com a frase *"Este dado vem do seu cadastro no CRAS. Para corrigir, procure o CRAS — a Prefeitura não altera o CadÚnico. [Ver CRAS perto de mim]"*.

## 4.5 Dois estados novos do cartão de renda — e o de maior valor prático

**Cadastro vencido (>24 meses)** — `tarja border-l-atencao`, com ação:

```
┌─ ⚠ Renda ──────────────────────────── 6 pts ───┐
│ Seu cadastro no CadÚnico está vencido desde     │
│ março de 2024.                                  │
│ Por ele, você tem 6 pontos.                     │
│ Atualizando no CRAS, pode chegar a até 35.      │
│                                                 │
│ [ Ver CRAS perto de mim ]   [ Como atualizar ]  │
│                                                 │
│ Sua inscrição continua valendo. Se você          │
│ atualizar antes de sair a vaga, a pontuação      │
│ é recalculada automaticamente.                   │
└─────────────────────────────────────────────────┘
```

**Sem cadastro** — mesma estrutura, `0 pontos`, mesma ação, mesma garantia de que a inscrição não é bloqueada.

Este é **o elemento de UI de maior retorno de toda a proposta**, e é uma consequência direta da régua nova. Hoje o cadastro vencido faz a família perder tudo, e a régua atual não tem degrau nenhum entre "tem CadÚnico" e "não tem". Com o degrau de 6 pontos, existe pela primeira vez algo verdadeiro e acionável a dizer a ~metade da fila: *o que fazer, onde, e quanto muda*. O documento da régua chama o degrau de "convite à regularização" — o convite só existe se estiver na tela.

**Requisito de back que isso impõe:** reconsulta e recálculo entre a inscrição e a rodada (`valido_ate`, consulta refeita na véspera de cada rodada). Prometer recálculo na tela sem isso é promessa falsa.

## 4.6 Medida protetiva e acolhimento: consultados, nunca exibidos

O grau máximo do Bloco 2 (25 pontos) vem de medida protetiva, acolhimento ou violência contra a criança atestada. **Não pode virar cartão no fluxo da família.**

O motivo é operacional, não jurídico: em violência intrafamiliar, quem opera o formulário pode ser o agressor, e uma tela que exibe *"consta medida protetiva em favor de MARIA, expedida em 03/2026"* entrega a informação exatamente a quem não deve tê-la.

**Desenho:** o ponto entra no score, e a Tela 9 mostra uma linha neutra — **`Informação protegida de outro órgão · 25 pontos`** — sem nome de órgão, sem data, sem `[Ver detalhe]`, sem `[Isto está errado]`. A contestação, se houver, é presencial. E o acesso ao registro completo fica restrito ao analista da CRE, com log nominal, como já previsto na Parte 2 (§2.5).

Isto vale também para o `[Ver detalhe]` do resto da tela: **a regra de "toda origem é auditável pelo usuário" tem uma exceção, e é esta.** Vale declarar a exceção explicitamente no código e no termo, para que ninguém a "conserte" depois por consistência.

## 4.7 Tela 9 reescrita — a tela que a régua nova muda por completo

Três mudanças, e a segunda é a mais importante do documento inteiro.

**(1) Agrupar por bloco, com o teto visível.**

```
Sua pontuação
  54  confirmados            ▓▓▓▓▓▓▓▓▓▓▓░░░░░  54 / 100
+ 38  a confirmar

┌─ De onde vem cada ponto ────────────────────────┐
│ Renda                              35   ✓ base  │
│   ↳ cadastro atualizado em 03/2024              │
│                                                 │
│ Cuidado no núcleo                  10   ✓ base  │
│   ↳ você é a única adulta no domicílio          │
│                                                 │
│ Espera                              3   ✓ base  │
│   ↳ você esperou no processo anterior           │
│                                                 │
│ Proteção e risco                   20   ⏳ falta │
│   ↳ violência no núcleo             20   falta  │
│   ↳ álcool ou drogas                 —   não soma│
│                                                 │
│ Deficiência e saúde                18   ⏳ falta │
│   ↳ doença grave da criança         18   falta  │
│                                                 │
│ Em cada grupo conta o item de maior peso,       │
│ não a soma. Marcar mais itens no mesmo grupo    │
│ não aumenta a pontuação.                        │
└─────────────────────────────────────────────────┘
```

A frase do rodapé é obrigatória. Sem ela, `20 + 15 = 20` é lido como bug — e a família que ligar para o 1746 vai ter razão em achar estranho. **Efeito colateral desejável:** dizer que marcar mais no mesmo grupo não soma remove, na própria tela, o incentivo a super-declarar — que o backtest identifica como a causa raiz dos quatro testes que falharam.

**(2) Ponto declarado e não confirmado fica fora do número grande.**

Esta é a tradução em interface do veredito do backtest. Hoje o site fala em *"pontuação declarada"* e a soma inclui tudo. Na régua nova, com critérios de risco valendo 10 a 25, isso é insustentável: um "sim" que se contradiz em 88% dos casos passaria a mover 25 pontos.

Regra: **`confirmados`** = itens com `grau_origem ∈ {aferido, atestado}`. **`a confirmar`** = declarados, exibidos em cinza/hachura, somados **em separado**, e **é o valor `confirmados` que ordena a fila**. A família vê os dois números e entende a diferença sem ouvir a palavra "aferição":

> *"54 pontos já estão confirmados nos sistemas do governo e valem na fila agora. Os outros 38 passam a valer quando o documento for aceito."*

**(3) A regra da perda por critério se atualiza para perda por bloco.** A frase da Parte 2 muda de escala e precisa mudar de texto:

> *"Se você não comprovar a violência no núcleo, perde **os 20 pontos desse grupo**. Os 35 da renda e os 10 do cuidado no núcleo já estão confirmados e não se perdem."*

**(4) Versão da régua visível**, em `text-texto-3`, na base do cartão: `Régua do processo 2026 · versão 1 · vigente por 3 processos` + *link* para `/como-funciona`. A vigência de 3 processos com gatilho publicado só é uma garantia se a família puder ver qual régua a classificou.

## 4.8 Tela 8 reescrita — as perguntas ganham um qualificador

A régua nova não pode ser alimentada por 5 booleanos. Precisa de grau, e o grau depende de **quem** — a criança ou outra pessoa da casa. Estrutura: a pergunta Sim/Não continua sendo o primeiro toque; ao responder `Sim`, o qualificador aparece **na mesma tela**, logo abaixo, com dois ou três botões grandes.

| # | Pergunta | Qualificador novo | Graus que ele separa |
|---|---|---|---|
| 1 | A criança ou alguém que convive com ela sofre violência em casa? | **Quem?** `A criança` · `Outra pessoa da casa` | 25 · 20 |
| 2 | A criança ou alguém da família tem uma doença grave e de longa duração? | **Quem?** `A criança` · `Outra pessoa da casa` | 18 · 8 |
| 3 | Alguém da família faz uso abusivo de álcool ou outras drogas? | — | 15 |
| 4 | Alguém da família está preso ou foi preso nos últimos 5 anos? | **Quem?** `O responsável pela criança` · `Outra pessoa da casa` | 10 · ⚠ ver §4.2 |
| 5 | A criança ou você é refugiado ou pediu refúgio no Brasil? | — | 3 |
| 6 *(condicional)* | Você tem alguma deficiência ou doença que dificulte cuidar da criança? | — | 12 — **aparece só se o BPC não respondeu** |
| 7 *(condicional)* | Você mora com outro adulto que ajuda a cuidar da criança? | — | 6 — **aparece só se não há CadÚnico** |

**Honestidade sobre o contador.** A tese "13 → 5 perguntas" não sobrevive intacta: são 5 perguntas fixas + até 2 condicionais, e 3 delas têm uma segunda parte. O número honesto é **"5 perguntas, até 8 toques"** — e é o que o contador deve exibir: `Pergunta 2 de 5`, com o qualificador contando como parte da mesma pergunta, porque está na mesma tela e é um toque. As condicionais entram no total só quando disparam, e a barra de progresso precisa suportar total variável sem "voltar" — do contrário a pessoa vê o progresso regredir, que é o pior defeito possível numa barra.

**O qualificador não é uma escolha de quanto valer.** Nada de pontos ao lado dos botões. A microcópia deixa claro para que serve: *"Isso define qual serviço vamos procurar para confirmar."* Mostrar `25` ao lado de `A criança` e `20` ao lado de `Outra pessoa da casa` seria construir, com as próprias mãos, a superfície de manipulação que a régua nova acabou de eliminar (teste 5: 100 → 0 pontos declaráveis).

## 4.9 Tela 10 — comprovação por grau, sem tabela de preços

O catálogo de documentos passa a mapear documento → grau: medida protetiva ativa sustenta 25, relatório do CREAS sustenta 20. **Isso não vai para a tela.** A família vê a lista de documentos aceitos, e o grau é atribuído pelo analista.

Se a tela dissesse *"com medida protetiva: 25 pontos · com relatório do CREAS: 20"*, transformaria a comprovação em compra de pontuação e induziria a família a buscar o documento mais caro de obter — justamente na trilha em que a barreira documental já é o problema. O único texto necessário é: *"Serve qualquer um destes."*

O que **sim** aparece, por item: prazo, canal (foto, arquivo, ou ponto de atendimento), a via da trilha B quando existir, e o estado (`Falta enviar` → `Recebido` → `Em análise` → `Confirmado`). Ao ser confirmado, o item migra de `a confirmar` para `confirmados` na Tela 9 e a barra se move — é o retorno que fecha o ciclo, e a razão para o número grande estar dividido em dois.

## 4.10 Tela 11 — a posição estimada usa só o que está confirmado

O semáforo de chance (`🟢 chance alta` / `🟡 média` / `🔴 fila longa`) e o *"12 crianças na sua frente"* passam a ser calculados **sobre `confirmados`, nunca sobre `confirmados + a confirmar`**. Mostrar a posição otimista de quem ainda não comprovou é o mesmo erro do processo atual, com estética melhor: a família escolhe a creche disputada contando com pontos que talvez não se realizem.

Quando houver pontos a confirmar, o cartão da creche ganha uma segunda linha, condicional:
*"Com os 38 pontos que faltam comprovar, você subiria para 3ª na fila desta creche."* — em cinza, e sempre **abaixo** da posição real.

Ganho lateral da régua nova: com a escada de renda completa, o maior bloco de empate cai de 22,2% para 11,7% da fila, o que torna a posição estimada uma informação bem menos volátil do que é hoje. O bloco em **zero**, porém, permanece em 31,7% nas duas réguas — 26% das famílias não declaram critério nenhum. Para essas, a Tela 9 sem critério (já especificada na Parte 2) e o desempate por proximidade continuam sendo a resposta, e nenhuma mudança de régua altera isso.

## 4.11 `/como-funciona` — o que a régua nova acrescenta à página

Os 5 blocos, as escadas com todos os graus, a regra do teto por bloco, e — o que nenhuma versão anterior publicou — **os três indicadores de alerta com o valor corrente**: % da escala consumido por um item (alerta >50%), maior bloco de empate não-zero (>15%), prevalência de qualquer item (>40%). Mais a vigência de 3 processos e a regra de resposta ao alerta (acrescentar degrau ao item, nunca redistribuir a régua inteira).

Publicar os três indicadores é o que impede a repetição do que aconteceu em 2023, quando a prevalência do Bolsa Família foi de 27% para 44% e **ninguém estava olhando para esse número**. Um painel público é o mecanismo de detecção — e é conteúdo de front, não de back.

## 4.12 Ordem de implantação: o front precisa suportar as duas réguas

O backtest recomenda **aferição primeiro, régua nova depois ou junto** — e é explícito que a ordem inversa piora casos individuais antes de melhorar. O front tem de acomodar isso, e a acomodação é barata:

- `inscricao.regua_versao` renderizada na Tela 9 e no comprovante
- a separação `confirmados` / `a confirmar` (§4.7) é, ela mesma, o mitigador: com ela, adotar a régua nova antes da aferição completa não amplifica ruído — só deixa mais pontos parados em "a confirmar"
- os cartões da Tela 7 degradam por campo, não por bloco: sem `renda_per_capita`, o cartão de renda cai para os 3 graus que o binário permite e diz *"cadastro confirmado"* em vez da faixa. A tela não quebra, entrega menos.

**Nenhuma tela precisa ser refeita quando a renda per capita entrar.** É o teste de que a separação por bloco e por origem está no lugar certo.

## 4.13 Decisões da SME que o front não pode tomar sozinho

Especifiquei todas com a suposição indicada, para não travar o desenho. Cada uma muda o comportamento de uma tela concreta:

| # | Decisão | Suposição adotada |
|---|---|---|
| 1 | "Outra pessoa da casa" privada de liberdade vale algum grau? | **sim**, grau menor — a opção existe de todo modo (§4.2) |
| 2 | Sem CadÚnico, a declaração dá acesso a que grau do Bloco 4? | **só ao de 6**, nunca ao de 10 |
| 3 | Deficiência/doença incapacitante do responsável sem BPC: via de atestação ou pergunta declarada? | **pergunta condicional** quando o BPC não responde |
| 4 | Medida protetiva é consultada sem consentimento do responsável? | **sim**, com aviso e sem exibição (§4.6) |
| 5 | Faixa de renda é revelável em `[Ver detalhe]` ou nunca? | **revelável por toque deliberado** (§4.4) |
| 6 | Contestação de renda: SME encaminha ao CRAS ou abre análise própria? | **encaminha** — a SME não é dona do dado |

---

# Parte 5 — Prioridade

| # | Alteração | Impacto para o usuário | Esforço |
|---|---|---|---|
| 1 | **Bairro: lista canônica de 164 + busca tolerante, e CEP como via principal** | remove um erro silencioso que altera classificação | baixo |
| 2 | **Etapa 4 vira conferência (Tela 7) + 5 perguntas (Tela 8)** | 13 → 5 perguntas; é a tese da solução | alto |
| 3 | **Tirar todo número de diagnóstico do formulário → `/como-funciona`** | o formulário passa a instruir em vez de argumentar | baixo |
| 4 | **Reordenar: critérios e pontuação antes das creches** | a família escolhe sabendo a chance real | médio |
| 5 | **Reescrever 100% dos textos (tabela §1.5 e §Tela 8)** | linguagem de gente, não de norma | baixo |
| 6 | **Tela 9 com decomposição e a regra da perda por critério** | a frase que hoje ninguém consegue dizer à família | médio |
| 7 | **Uma pergunta por tela + barra com contagem real + "Salvo"** | reduz abandono no celular | médio |
| 8 | **Alvos ≥44 px, `aria-live`, reordenar por arraste + setas + número** | acessibilidade AA de verdade | baixo |
| 9 | **Tela 14 com "o que acontece agora" datado** | acaba a pergunta "e agora?" | baixo |
| 10 | **CPF/DNV da criança, CEP+número, consentimento, contato verificado** | fecha as lacunas da especificação | médio |
| 11 | **Comprovação (Tela 10) e acompanhamento (Tela 15)** | fecha o ciclo | alto |
| 12 | **Modo assistido e `/painel`** | inclusão e gestão | alto |

**Acrescentados pela régua nova** (Parte 4). Ordenados na mesma escala, e dois deles entram acima do item 6 acima:

| # | Alteração | Impacto para o usuário | Esforço |
|---|---|---|---|
| R1 | **Separar `confirmados` de `a confirmar`, e ordenar a fila só pelos confirmados** (§4.7) | é o mitigador que permite adotar a régua nova antes da aferição completa, sem amplificar ruído | médio |
| R2 | **Estados "cadastro vencido" e "sem cadastro" no cartão de renda, com CRAS acionável** (§4.5) | primeira coisa verdadeira e acionável a dizer a ~metade da fila | baixo |
| R3 | **Tela 9 por bloco, com a frase do teto** (§4.7) | sem ela, `20 + 15 = 20` é lido como bug | médio |
| R4 | **Qualificador de *quem* nas perguntas 1, 2 e 4 + 2 condicionais** (§4.8) | alimenta o grau; sem isso a régua nova não roda | médio |
| R5 | **Renda: pontos sim, valor e faixa não** (§4.4) | evita estigma e exposição no balcão do polo | baixo |
| R6 | **Medida protetiva consultada e nunca exibida** (§4.6) | segurança de quem sofre violência intrafamiliar | baixo |
| R7 | **Consentimento em 3 seções, com caixa separada para dado sensível** (§4.3) | base legal correta para saúde e deficiência | baixo |
| R8 | **Posição estimada calculada só sobre confirmados** (§4.10) | impede a família de escolher creche disputada contando com pontos que talvez não se realizem | baixo |
| R9 | **`regua_versao` na Tela 9 e no comprovante** (§4.12) | vigência de 3 processos só é garantia se for visível | baixo |
| R10 | **Indicadores de alerta publicados em `/como-funciona`** (§4.11) | é o mecanismo que faltava em 2023, quando ninguém olhava a prevalência | baixo |

**Se o tempo apertar,** os itens 1, 3, 5 e 8 são de baixo esforço e já mudam a percepção da tela por completo — e R2, R5, R6 e R7 têm o mesmo perfil. **Dois não podem ser cortados:** o item 2, sem o qual o protótipo demonstra uma interface melhor para o processo antigo; e **R1**, sem o qual a régua nova entra em produção dando 10 a 25 pontos a um sinal que se contradiz em 80% a 92% dos casos — o que o backtest classifica como pior do que não mudar nada.
