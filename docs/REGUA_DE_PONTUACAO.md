# A régua de pontuação — diagnóstico e proposta

**Escopo:** apenas como compor os 100 pontos que ordenam a fila. Desempate, formulário, documentos e integrações estão nos outros documentos.

A pergunta que este documento responde: *por que a régua foi reescrita duas vezes em cinco anos, e como escrever uma que não precise ser reescrita na próxima.*

---

## 1. Por que a régua mudou

A resposta não está nas atas — está na prevalência dos critérios. Reconstituí a distribuição de pontos das 335.163 inscrições de 2021 a 2025.

### 1.1 A régua nunca foi uma escala. Sempre foi um interruptor.

| Ano | Teto | Inscrições em **zero** | Segundo maior bloco | Os 3 maiores blocos somam |
|---|---:|---:|---|---:|
| 2021 | 465 | 39.155 (**60,1%**) | 12.626 em 100 pts (19,4%) | **85,4%** |
| 2022 | 465 | 40.721 (**63,6%**) | 11.417 em 100 pts (17,8%) | **86,7%** |
| 2023 | 465 | 23.834 (**46,4%**) | 16.558 em 100 pts (**32,3%**) | **83,2%** |
| 2024 | 100 | 26.076 (31,5%) | 18.175 em 40 pts (22,0%) | 61,8% |
| 2025 | 100 | 22.836 (31,7%) | 15.956 em 53 pts (22,2%) | 63,8% |

Em 2023, **78,7% da fila inteira ocupava dois valores**: zero ou exatamente 100. Uma régua de 465 pontos com 13 perguntas estava operando como uma pergunta única de sim ou não. Todo o resto era decoração.

### 1.2 Um único critério sempre consumiu a escala inteira

"Pontos esperados" = prevalência × peso. Mede quanto de toda a pontuação distribuída na cidade vem de cada critério.

| Ano | Critério dominante | Prevalência | Peso | **% de toda a escala** |
|---|---|---:|---:|---:|
| 2021 | Bolsa Família | 27,2% | 100 | **75,3%** |
| 2022 | Bolsa Família | 24,1% | 100 | **73,6%** |
| 2023 | Bolsa Família | 44,3% | 100 | **79,7%** |
| 2024 | CadÚnico + BF/Cartão Carioca | 46,2% / 52,0% | 25 / 15 | **91,3%** (somados) |
| 2025 | CadÚnico | 48,9% | 51 | **89,9%** |

Cinco anos, três reformas, e o número não se move: **um proxy de renda de alta prevalência consome 74% a 91% da régua**. As reformas trocaram qual proxy, nunca a estrutura.

### 1.3 O gatilho de 2024 está visível nos dados

A prevalência do Bolsa Família na fila:

```
2021  27,2%  ─────────────
2022  24,1%  ────────────
2023  44,3%  ══════════════════════   ← +20,2 p.p. em um ano
```

É a expansão do programa (retomada do Bolsa Família sobre o Auxílio Brasil) chegando à fila da creche. Um critério que valia **100 dos 465 pontos** passou de um quarto para quase metade das famílias em um único ciclo. O bloco de empate em 100 pontos saltou de 17,8% para 32,3% da fila.

A régua não foi reformada por decisão conceitual. **Ela foi reformada porque quebrou** — e quebrou por um choque de prevalência externo, sobre o qual a SME não tem governo nenhum.

### 1.4 A reforma de 2024 acertou o diagnóstico e errou o remédio

2024 fez a coisa certa em duas frentes: derrubou o teto de 465 para 100 e aumentou a granularidade de 50 para 92 valores distintos de score. Mas manteve a estrutura: introduziu o CadÚnico com 25 pontos e prevalência de 46,2%, ao lado de BF/Cartão Carioca com 15 pontos e prevalência de 52,0%. Dois critérios de altíssima prevalência, **sobrepostos em 39,2% das inscrições**, respondendo juntos por 91,3% da escala.

2025 percebeu a duplicação e resolveu por concentração: CadÚnico a 51, Bolsa Família esmagado para 2. Trocou dois problemas por um maior — agora **89,9% da régua depende de um critério que metade da fila possui**. Um critério com 48,9% de prevalência não ordena nada: ele parte a fila em duas metades e deixa 15.956 famílias empatadas em exatamente 53 pontos.

---

## 2. Os quatro defeitos estruturais

### D1 — Peso alto em critério de alta prevalência

Um critério binário com prevalência *p* e peso *w* separa a fila em dois blocos de tamanho *p* e *1−p*, e não faz mais nada. Quanto maior o *w*, mais ele domina; quanto mais *p* se aproxima de 50%, maiores os dois blocos. **CadÚnico em 2025 é o pior caso possível dessa combinação**: peso máximo e prevalência de quase exatamente metade.

### D2 — Dupla contagem do mesmo construto

Bolsa Família, Cartão Família Carioca, Territórios Sociais e CadÚnico medem a mesma coisa: registro no sistema de proteção social por baixa renda. Foram pontuados em separado e somados.

- 2021–2023: os três critérios de 100 pontos coexistiam. **3,4% a 5,4% das famílias marcavam dois ou mais** e recebiam 200 ou 300 pontos pela mesma condição.
- 2024–2025: CadÚnico e BF/Cartão Carioca se sobrepõem em **37,4%** das inscrições.

E há a prova de que a autodeclaração não sustenta isso: **6.656 inscrições (9,3%) declaram Bolsa Família ou Cartão Carioca sem declarar CadÚnico** — impossível para o Bolsa Família, que exige inscrição no CadÚnico. São critérios redundantes preenchidos de forma inconsistente.

### D3 — Binário onde existe informação graduada

Todos os 13 critérios são Sim/Não. Mas o CadÚnico não devolve um booleano: devolve **renda per capita declarada e data de atualização**. Perguntar "está no CadÚnico?" descarta a única variável contínua disponível em toda a política — e é justamente ela que distingue uma família em extrema pobreza de uma em baixa renda. A régua joga fora a informação de que mais precisa.

### D4 — Inversão de severidade

O defeito mais grave, e o que nenhuma das três reformas tocou.

| Perfil | Famílias | Pontuação média 2025 |
|---|---:|---:|
| CadÚnico/BF e **nenhum** critério severo | 34.024 (47,3%) | **45,1** |
| ≥2 critérios severos e **sem** CadÚnico/BF | 626 (0,9%) | **11,0** |
| ≥3 critérios severos e sem CadÚnico/BF | 196 (0,3%) | **11,8** |

*Critérios severos: deficiência da criança, violência doméstica, uso abusivo de substâncias, privação de liberdade no núcleo, doença crônica grave, responsável com deficiência.*

Uma família com violência doméstica, doença crônica grave e um responsável privado de liberdade pontua **11,8**. Uma família cadastrada e sem nenhuma dessas condições pontua **45,1**. **39,5% da fila ultrapassa uma família com três critérios severos apenas por ter CadÚnico.**

Isso não é efeito colateral de calibragem. É consequência aritmética de dar 51 pontos a um critério e 2 a 4 pontos aos demais: **a soma de todos os critérios de risco agudo (4+3+2+2+3 = 14) não chega a um terço do critério de renda.** Nenhuma combinação de vulnerabilidade aguda vence um cadastro.

---

## 3. Cinco princípios

1. **Um construto, um critério.** Renda e proteção social viram um item só, com escada. Nada de somar proxies correlacionados.
2. **Escada onde há dado graduado.** Critério binário só quando a realidade é binária.
3. **Teto por bloco.** Dentro de um bloco temático vale o item de maior grau, não a soma. Impede empilhamento.
4. **Soma entre blocos, com hierarquia declarada.** Dois blocos de risco agudo devem poder superar o máximo de renda — caso contrário, D4 permanece.
5. **Peso limitado pela prevalência.** Nenhum item pode consumir mais da metade da escala; quando consome, a resposta é **acrescentar degraus**, não redistribuir pesos.

---

## 4. A régua proposta

**100 pontos, cinco blocos.** Dentro do bloco vale o maior item aplicável; entre blocos, soma.

### Bloco 1 — Renda aferida · 0 a 35

Um item só, com escada, alimentado pela renda per capita do CadÚnico. Substitui CadÚnico + Bolsa Família + Cartão Carioca.

| Grau | Pontos |
|---|---:|
| Extrema pobreza — renda per capita até R$ 109 | **35** |
| Pobreza — de R$ 109,01 a R$ 218 | 28 |
| Baixa renda — até ½ salário mínimo per capita | 20 |
| CadÚnico ativo e atualizado, acima de ½ SM | 12 |
| CadÚnico com atualização vencida (>24 meses) | 6 |
| Sem CadÚnico | 0 |

> O degrau de 6 pontos para cadastro vencido é deliberado: hoje uma família que deixou de atualizar perde tudo, e atualização vencida é falha de acesso ao CRAS, não de vulnerabilidade. Também funciona como convite à regularização.

### Bloco 2 — Proteção e risco · 0 a 25 *(maior item do bloco)*

| Grau | Pontos |
|---|---:|
| Criança sob medida protetiva, em acolhimento, ou violência contra a criança atestada | **25** |
| Violência doméstica no núcleo familiar, atestada por serviço público | 20 |
| Uso abusivo de álcool ou outras drogas no núcleo | 15 |
| Responsável direto privado de liberdade | 10 |

### Bloco 3 — Deficiência e saúde · 0 a 25 *(maior item do bloco)*

| Grau | Pontos |
|---|---:|
| Criança público-alvo da educação especial | **25** |
| Criança com doença crônica grave ou déficit nutricional | 18 |
| Responsável com deficiência ou doença incapacitante | 12 |
| Doença crônica grave em outro membro do núcleo | 8 |

### Bloco 4 — Capacidade de cuidado do núcleo · 0 a 10 *(maior item do bloco)*

| Grau | Pontos |
|---|---:|
| Responsável único, sem outro adulto no domicílio *(composição do CadÚnico)* | **10** |
| Família monoparental | 6 |
| Responsável único com 60 anos ou mais, ou menor de 18 | 4 |

### Bloco 5 — Espera e deslocamento forçado · 0 a 5 *(soma, com teto)*

| Item | Pontos |
|---|---:|
| Aguarda vaga há dois processos ou mais | 5 |
| Aguardou no processo anterior | 3 |
| Refugiado ou solicitante de refúgio | 3 |

### A regra que corrige a inversão

**B2 e B3 somam entre si.** Uma criança com deficiência em família com violência doméstica atestada faz 25 + 25 = **50 pontos**, contra os 35 do máximo de renda. Risco agudo acumulado passa a superar pobreza máxima — que é o que a inversão do §D4 impedia.

### Fora dos 100 pontos

Desempate, na ordem: **irmão matriculado** → **responsável menor de 18** → **proximidade** (`d_min/d`) → **sorteio com semente publicada**. Conforme já decidido no documento de solução. A régua ordena por mérito social; a proximidade desempata. São funções distintas e não devem se misturar.

---

## 5. Validação nas 71.930 inscrições de 2025

> **Limite da simulação.** A base anonimizada não traz renda per capita — só o binário do CadÚnico. Simulei o Bloco 1 com três graus aproximados (CadÚnico+BF = 35, só CadÚnico = 20, só BF/CC = 28). É o **piso** do que a régua faria em produção com a escada completa, nunca o teto.

### 5.1 A inversão de severidade é corrigida

| | Régua atual | Proposta |
|---|---:|---:|
| ≥2 critérios severos, sem cadastro | 11,0 pts | **27,1 pts** |
| Cadastro, nenhum critério severo | 45,1 pts | 32,3 pts |
| **Razão entre os dois** | **0,24** | **0,84** |
| Percentil médio de quem tem ≥3 severos sem cadastro | 50º | **66º** |

De uma desvantagem de 4× para paridade. As 196 famílias com três ou mais condições severas e sem cadastro saem da mediana da fila para o mesmo patamar de quem tem cadastro — o que é o resultado correto, não um privilégio.

### 5.2 A escada de renda é o que quebra o empate

Variando só o número de degraus do Bloco 1, mantendo todo o resto:

| Degraus no Bloco 1 | Maior bloco de empate não-zero |
|---|---:|
| 2 — estrutura de hoje | 24.072 (**33,5%**) |
| 3 | 9.672 (13,4%) |
| **5 — proposta** | **8.409 (11,7%)** |

*Para referência, a régua de 2025 produz um bloco de 15.956 (22,2%) em 53 pontos.*

**É a granularidade que faz o trabalho, não o peso.** Este é o resultado mais importante do documento: rebalancear pesos — o que a SME fez em 2024 e de novo em 2025 — não resolve. Acrescentar degraus resolve.

### 5.3 O que a régua não consegue fazer, e não deve tentar

O bloco em **zero** permanece em 31,7% nas duas réguas. Nenhuma composição de critérios sociais o dissolve, porque 26% das famílias não declaram critério nenhum — não há o que pontuar. **Quebrar esse bloco é função da proximidade e do sorteio**, não da régua. Uma régua que tentasse resolvê-lo acabaria inventando pontos para diferenças que não existem.

### 5.4 Robustez ao choque que quebrou a régua em 2023

Simulando +20 p.p. de cobertura do CadÚnico, o mesmo salto que o Bolsa Família teve entre 2022 e 2023:

| | Crescimento do maior bloco |
|---|---:|
| Régua atual | **+17,5%** |
| Proposta (3 graus simulados) | +13,7% |

A melhora é modesta na simulação — e o backtest completo mostrou que **ela não se sustenta**.

> ⚠️ **Correção.** Esta seção afirmava que a escada distribuiria o choque de prevalência em vez de concentrá-lo. O [`BACKTEST_REGUA.md`](BACKTEST_REGUA.md), teste 9, testou isso com a escada de 5 degraus e **não confirmou**: em choques de +10 e +20 p.p. a proposta é *pior* que a régua vigente, porque a escada concentra os entrantes em degraus e um degrau muito povoado é um novo bloco de empate. Só em choque de +30 p.p. a proposta supera a vigente, por margem estreita.
>
> O que se sustenta é mais estreito: a escada reduz o **dano colateral** sobre quem não mudou de situação — de 7,14 para 5,31 p.p. de deslocamento médio, com a proporção de famílias que caem mais de 10 p.p. indo de 26,9% para 21,8% (teste 6). **Robustez a choque de cobertura continua sendo problema aberto das duas réguas.**

A diferença estrutural que permanece válida é outra: hoje entrar no cadastro vale +51 pontos e joga a família direto no bloco máximo; na proposta vale entre 6 e 35, conforme a renda aferida. Isso reduz o dano a terceiros, mas não elimina o risco de formação de novo bloco.

### 5.5 A fila não vira de cabeça para baixo

Correlação de Spearman entre as duas réguas: **0,944**. Sobem mais de 10 pontos percentuais 9,3% das famílias; descem mais de 10 p.p., 4,1%. A proposta é uma correção cirúrgica da cauda, não uma reescrita da política — o que importa para a viabilidade jurídica e para a comunicação com as famílias.

---

## 6. A regra que impede a régua de quebrar de novo

O problema não foi cada régua em particular. Foi não haver mecanismo para detectar a degradação antes do colapso. A régua de 2021 funcionava razoavelmente com Bolsa Família a 27%; virou moeda ao ar a 44%. **Ninguém estava olhando para esse número.**

**Vigência fixa de três processos**, com um relatório público anual de três indicadores:

| Indicador | Alerta | Como está em 2025 |
|---|---|---|
| Maior % da escala consumido por um único item | **> 50%** | 🔴 **89,9%** (CadÚnico) |
| Maior bloco de empate não-zero | **> 15%** da fila | 🔴 **22,2%** (15.956 em 53 pts) |
| Prevalência de qualquer item na fila | **> 40%** | 🔴 **48,9%** (CadÚnico), 46,6% (BF/CC) |

**A resposta ao alerta é padronizada, e é aqui que mora a diferença:** quando um item dispara, acrescenta-se **degrau à escada daquele item** — não se redistribuem os pesos da régua inteira. Foi a redistribuição geral que produziu as rupturas de 2024 e 2025 e tornou impossível explicar a uma família por que sua posição mudou. Mexer em um item preserva a comparabilidade de todo o resto.

---

## 7. O que a proposta exige para funcionar

| Requisito | Situação |
|---|---|
| **Renda per capita do CadÚnico**, não o booleano | é a peça sem a qual a proposta vira a régua de hoje — depende do convênio com MDS/Dataprev |
| Composição familiar do CadÚnico | mesma fonte; alimenta o Bloco 4 |
| Data de atualização do cadastro | mesma fonte; alimenta o degrau de 6 pontos |
| Atestação por serviço público para o Bloco 2 | CREAS, CRAS, CAPS-AD e unidades de saúde lançando no sistema |
| Escadas do Bloco 2 e 3 exigem **grau**, não Sim/Não | muda o que o analista registra: "violência atestada com medida protetiva ativa", não "violência: sim" |
| Histórico de fila por criança | já existe no próprio módulo IC |

Sem a renda per capita, o Bloco 1 degrada para três graus e a régua entrega a melhora parcial medida em §5.2 — melhor que hoje, longe do que pode ser. **É a integração de maior retorno de todo o projeto.**

---

## 8. Comparação lado a lado

| | Régua 2025 | Proposta |
|---|---|---|
| Itens pontuados | 11 + 2 desempates | 5 blocos, 18 graus |
| Teto | 100 | 100 |
| Maior peso individual | 51 (CadÚnico) | 35 (extrema pobreza aferida) |
| % da escala em um item | 89,9% | ~40% com escada completa |
| Critérios de renda | 2, sobrepostos em 37,4% | 1, com escada |
| Empilhamento | soma livre | teto por bloco |
| Risco agudo vence pobreza máxima? | **não** (14 pts contra 51) | **sim** (50 pts contra 35) |
| Fonte | autodeclaração | aferição |
| Vigência | reescrita a cada ano | 3 processos, com gatilho publicado |
