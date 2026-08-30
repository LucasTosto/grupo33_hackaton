# -*- coding: utf-8 -*-
"""
Compacta a semente da fila para o formato que a aplicacao carrega.

fila-seed.json tem 44 MB porque guarda tudo que o backtest precisa (situacao
historica, datas, sexo, pontos declarados). A aplicacao so precisa do que entra
na rodada: pontos comprovados, criterios de desempate e preferencias ordenadas.
Um registro por linha, campos separados por ';' e opcoes por '|'.

    id ; aluno ; pontos ; desempates(,) ; bairro ; unidade:grupamento:horario:ordem(|...)

O campo `aluno` e o que permite agrupar por crianca: a mesma crianca pode ter
inscricao em mais de um polo do mesmo processo, e o motor tem que dar no maximo
um assento por crianca -- nao um por inscricao.

Grupamento e horario viram indice para nao repetir a string 160 mil vezes.

Uso:  python scripts/compacta_fila.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "lib", "data")

GRUPAMENTOS = ["Berçário", "Maternal I", "Maternal II"]
HORARIOS = ["Integral", "Parcial"]

with open(os.path.join(DATA, "fila-seed.json"), encoding="utf-8") as f:
    seed = json.load(f)

gi = {g: i for i, g in enumerate(GRUPAMENTOS)}
hi = {h: i for i, h in enumerate(HORARIOS)}

linhas = []
descartadas = 0
for s in seed:
    opcoes = []
    for o in s["opcoes"]:
        g, h = gi.get(o["grupamento"]), hi.get(o["horario"])
        if g is None or h is None:
            continue
        opcoes.append("%d:%d:%d:%d" % (o["unidade"], g, h, o["ordem"]))
    if not opcoes:
        descartadas += 1
        continue
    linhas.append(
        ";".join(
            [
                s["id"],
                s["aluno"],
                str(s["pontosComprovados"]),
                ",".join(str(d) for d in s["desempates"]),
                (s["bairro"] or "").replace(";", " "),
                "|".join(opcoes),
            ]
        )
    )

saida = {
    "processo": {"prmId": 195, "ano": 2025},
    "fonte": "CIT-SME-RJ/dadoscreche - Query A + Query B, processo 195",
    "formato": "id;aluno;pontos;desempates;bairro;unidade:grupamento:horario:ordem|...",
    "grupamentos": GRUPAMENTOS,
    "horarios": HORARIOS,
    "total": len(linhas),
    "inscricoes": linhas,
}
destino = os.path.join(DATA, "fila-2025.json")
with open(destino, "w", encoding="utf-8") as f:
    json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))

print("%d inscricoes -> fila-2025.json (%.1f MB)" % (len(linhas), os.path.getsize(destino) / 1024 / 1024))
if descartadas:
    print("%d inscricoes sem opcao valida foram descartadas" % descartadas)

grupos_vistos = {}
for s in seed:
    for o in s["opcoes"]:
        grupos_vistos[o["grupamento"]] = grupos_vistos.get(o["grupamento"], 0) + 1
print("grupamentos na base:", json.dumps(grupos_vistos, ensure_ascii=False))
