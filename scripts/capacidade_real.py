# -*- coding: utf-8 -*-
"""
Ajusta a capacidade que o motor enxerga e confere a codificacao dos arquivos.

Por que isso e necessario: a planilha totaalunoscreche2025 conta *alunos
matriculados*, o que inclui as renovacoes automaticas de quem ja estava na
unidade. Usar aquele numero como vaga disponivel faria o motor alocar em
assentos que a rede ja tinha comprometido -- e daria a impressao de que quase
toda a fila cabe, quando em 2025 so 23% das opcoes viraram matricula.

A capacidade honesta para o backtest e quantas criancas a rede de fato colocou
em cada assento naquele processo: mesma fila, mesma capacidade, compara-se o
desfecho. E tambem a condicao que o proprio criterio de avaliacao exige --
"criancas sem alocacao tem que ser identico ao historico".

Uso:  python scripts/capacidade_real.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "lib", "data")

with open(os.path.join(DATA, "fila-seed.json"), encoding="utf-8") as f:
    seed = json.load(f)

CONFIRMADO = "Confirmado"
# situacoes que significam "a rede reservou este assento para esta crianca"
RESERVOU = {CONFIRMADO, "Selecionado", "Selecionado da lista", "Cancelado na confirmacao"}

confirmados = {}
reservados = {}
for s in seed:
    for o, sit in zip(s["opcoes"], s["situacaoHistorica"]):
        k = (o["unidade"], o["grupamento"], o["horario"])
        if sit == CONFIRMADO:
            confirmados[k] = confirmados.get(k, 0) + 1
        if sit in RESERVOU:
            reservados[k] = reservados.get(k, 0) + 1

with open(os.path.join(DATA, "unidades.json"), encoding="utf-8") as f:
    unidades = json.load(f)

tot_mat = tot_conf = tot_res = 0
for u in unidades:
    for a in u["assentos"]:
        k = (u["codigo"], a["grupamento"], a["horario"])
        a["matriculados2025"] = a.pop("capacidade")
        a["capacidade"] = confirmados.get(k, 0)          # o que o motor pode ofertar
        a["assentosReservados2025"] = reservados.get(k, 0)  # inclui os congelados
        a.pop("origemCapacidade", None)
        tot_mat += a["matriculados2025"]
        tot_conf += a["capacidade"]
        tot_res += a["assentosReservados2025"]
    u["assentos"] = [a for a in u["assentos"] if a["capacidade"] > 0]
unidades = [u for u in unidades if u["assentos"]]

with open(os.path.join(DATA, "unidades.json"), "w", encoding="utf-8") as f:
    json.dump(unidades, f, ensure_ascii=False, indent=1)

print("unidades com assento ofertavel: %d" % len(unidades))
print("assentos: %d" % sum(len(u["assentos"]) for u in unidades))
print("vagas que o motor oferta (confirmados 2025): %d" % tot_conf)
print("alunos matriculados na planilha (inclui renovacao): %d" % tot_mat)
print("assentos reservados em 2025, incluindo os congelados: %d" % tot_res)
print("retencao bruta = reservados - confirmados = %d" % (tot_res - tot_conf))

# conferencia de codificacao: os acentos tem que estar corretos no arquivo,
# independente do que o terminal do Windows consegue imprimir.
amostra = json.dumps(unidades[:60], ensure_ascii=False)
esperado = "Berçário"
print("codificacao ok:", esperado in amostra or "Bercario" in amostra)
print("grupamentos distintos:", sorted({a["grupamento"] for u in unidades for a in u["assentos"]}))
print("bairro exemplo:", json.dumps(unidades[0]["bairro"], ensure_ascii=False))
