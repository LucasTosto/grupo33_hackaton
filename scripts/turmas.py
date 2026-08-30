# -*- coding: utf-8 -*-
"""
Extrai o numero de turmas por assento e anexa a unidades.json.

O mapa de vacancia responde uma pergunta diferente da classificacao: nao e "quem
ficou com as vagas que a rede deu", e "onde ainda cabe alguem hoje". Para isso
precisa de turmas, que a extracao anterior nao trouxe -- ela pegou so a coluna
Aluno da planilha, e a planilha tem Aluno e Turma para cada grupamento x horario.

vaga = turmas x lotacao_de_referencia - alunos

A lotacao de referencia (25, p90 observado da rede) NAO e capacidade real. E
parametro editavel, definido em lib/data/parametros-195.json.

Uso:  python scripts/turmas.py [caminho-do-repo-dadoscreche]
"""
import json
import os
import sys
import unicodedata

import pandas as pd

REF = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\lucas.rodrigues\Desktop\hack-ref\dadoscreche"
OFER = os.path.join(REF, "OferecimentosEvagas")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "lib", "data")


def sem_acento(s):
    if not isinstance(s, str):
        return ""
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


cap = pd.read_excel(os.path.join(OFER, "totaalunoscreche2025.xlsx"), sheet_name="Consolidado", header=[0, 1, 2])


def preenche(nivel):
    saida, ultimo = [], ""
    for v in nivel:
        v = sem_acento(str(v)).strip()
        if not v.lower().startswith("unnamed") and v.lower() != "nan":
            ultimo = v
        saida.append(ultimo)
    return saida


n0 = preenche([c[0] for c in cap.columns])
n1 = preenche([c[1] for c in cap.columns])
n2 = [sem_acento(str(c[2])).strip() for c in cap.columns]
cap.columns = pd.MultiIndex.from_arrays([n0, n1, n2])

col_desig = [c for c in cap.columns if "designa" in c[0].lower()][0]
cap[col_desig] = pd.to_numeric(cap[col_desig], errors="coerce")
cap = cap.dropna(subset=[col_desig])

GRUPAMENTOS = {"Bercario": "Berçário", "Maternal I": "Maternal I", "Maternal II": "Maternal II"}

TURMAS = {}
ALUNOS = {}
for chave, grup_real in GRUPAMENTOS.items():
    for horario in ("Integral", "Parcial"):
        for campo, destino in (("turma", TURMAS), ("aluno", ALUNOS)):
            alvo = [
                c
                for c in cap.columns
                if c[0].lower() == chave.lower() and c[1].lower() == horario.lower() and c[2].lower() == campo
            ]
            if not alvo:
                continue
            vals = pd.to_numeric(cap[alvo[0]], errors="coerce")
            for cod, v in zip(cap[col_desig], vals):
                if pd.notna(v) and v > 0:
                    destino[(int(cod), grup_real, horario)] = int(v)

print("assentos com turma registrada: %d" % len(TURMAS))
print("total de turmas: %d" % sum(TURMAS.values()))

with open(os.path.join(DATA, "unidades.json"), encoding="utf-8") as f:
    unidades = json.load(f)

with open(os.path.join(DATA, "parametros-195.json"), encoding="utf-8") as f:
    lotacao = json.load(f)["vacancia"]["lotacaoDeReferencia"]

casados = 0
tot_vaga = 0
for u in unidades:
    for a in u["assentos"]:
        k = (u["codigo"], a["grupamento"], a["horario"])
        t = TURMAS.get(k, 0)
        alunos = ALUNOS.get(k, a.get("matriculados2025", 0))
        a["turmas2025"] = t
        a["alunos2025"] = alunos
        # Referencia observada, nao capacidade real. Nunca negativa.
        a["vagaEstimada"] = max(0, t * lotacao - alunos) if t > 0 else 0
        if t > 0:
            casados += 1
            tot_vaga += a["vagaEstimada"]

with open(os.path.join(DATA, "unidades.json"), "w", encoding="utf-8") as f:
    json.dump(unidades, f, ensure_ascii=False, indent=1)

print("assentos com turmas casadas: %d de %d" % (casados, sum(len(u["assentos"]) for u in unidades)))
print("vaga estimada total (turmas x %d - alunos): %d" % (lotacao, tot_vaga))
print("-> unidades.json atualizado")
