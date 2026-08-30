# -*- coding: utf-8 -*-
"""
Extrai as sementes que a aplicacao usa, direto das bases oficiais da SME/RJ
(repositorio CIT-SME-RJ/dadoscreche). Nenhum numero da aplicacao e inventado:
cada um tem origem rastreavel neste script.

Saidas em lib/data/:
  catalogo-2025.json  a regua de pontuacao real do processo 195 (2025)
  unidades.json       creches com geo, CRE, microarea e assentos com capacidade
  fatos.json          agregados usados na landing e no backtest
  fila-seed.json      inscricoes reais de 2025 com preferencias e pontos

Uso:  python scripts/extract_seeds.py [caminho-do-repo-dadoscreche]
"""
import json
import os
import sys
import unicodedata

import pandas as pd

REF = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\lucas.rodrigues\Desktop\hack-ref\dadoscreche"
BASE = os.path.join(REF, "Bases IC_ ClassificadoseFila")
OFER = os.path.join(REF, "OferecimentosEvagas")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "lib", "data")
os.makedirs(OUT, exist_ok=True)

ANO, PRM = 2025, 195
CONFIRMADO = {"Confirmado"}
# situacoes que implicam que um assento foi reservado para a crianca em algum momento
OFERTADO = CONFIRMADO | {"Selecionado", "Selecionado da lista", "Cancelado na confirmacao"}


def log(*a):
    print(*a, flush=True)


def dump(name, obj):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    log("  -> %s (%.0f KB)" % (name, os.path.getsize(path) / 1024))


def sem_acento(s):
    if not isinstance(s, str):
        return ""
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


SIGLAS = {"cm", "em", "ei", "cd", "cdei", "ciep", "cieps", "eds"}
MINUSCULAS = {"de", "da", "do", "das", "dos", "e", "em", "a", "o", "no", "na"}


def nome_bonito(s):
    """CM LADEIRA DOS FUNCIONARIOS -> CM Ladeira dos Funcionarios"""
    if not isinstance(s, str):
        return ""
    palavras = []
    for i, w in enumerate(s.strip().lower().split()):
        if w in SIGLAS:
            palavras.append(w.upper())
        elif i and w in MINUSCULAS:
            palavras.append(w)
        else:
            palavras.append(w.capitalize())
    return " ".join(palavras)


# --------------------------------------------------------------- 1. catalogo
log("[1/5] regua de pontuacao (Query C)")
qc = pd.read_csv(os.path.join(BASE, "03_QueryC_PerguntasComDescricao.csv"), sep=";", encoding="utf-8-sig")
c25 = qc[qc.prm_id == PRM].sort_values("perg_ordemVisualizacao")

criterios = []
for _, r in c25.iterrows():
    criterios.append(
        {
            "pergId": int(r.perg_id),
            "ichPergId": int(r.ich_perg_id),
            "ordem": int(r.perg_ordemVisualizacao),
            "texto": str(r.pergunta_texto).strip(),
            "pontos": int(r.perg_pontuacao),
            "desempate": str(r.perg_criterio).strip().lower().startswith("s"),
        }
    )

catalogo = {
    "processoId": PRM,
    "ano": ANO,
    "versao": "195.1",
    "fonte": "03_QueryC_PerguntasComDescricao.csv - SME/RJ",
    "pontuacaoMaxima": int(c25.perg_pontuacao.sum()),
    "criterios": criterios,
}
dump("catalogo-2025.json", catalogo)
log(
    "  %d criterios | maximo %d pontos | %d de desempate"
    % (len(criterios), catalogo["pontuacaoMaxima"], sum(1 for c in criterios if c["desempate"]))
)

# --------------------------------------------------------------- 2. geo / CRE
log("[2/5] geo, CRE e microarea (Unidades_Unificadas_com_Localizacao.xlsx)")
geo = pd.read_excel(os.path.join(OFER, "Unidades_Unificadas_com_Localizacao.xlsx"), sheet_name="Unidades_Unificadas")
geo.columns = [sem_acento(str(c)).strip().lower() for c in geo.columns]
geo["designacao"] = pd.to_numeric(geo["designacao"], errors="coerce")
geo = geo.dropna(subset=["designacao"])


def opt(v, conv=str):
    return None if pd.isna(v) else conv(v)


GEO = {}
for _, r in geo.iterrows():
    GEO[int(r["designacao"])] = {
        "cre": opt(r.get("cre"), int),
        "microarea": opt(r.get("microarea")),
        "bairro": opt(r.get("bairro"), lambda v: str(v).strip()),
        "rua": opt(r.get("rua"), lambda v: str(v).strip()),
        "lat": opt(r.get("latitude"), lambda v: round(float(v), 6)),
        "lng": opt(r.get("longitude"), lambda v: round(float(v), 6)),
        "tipo": opt(r.get("tipo"), lambda v: str(v).strip()),
    }
log("  %d unidades no cadastro de localizacao" % len(GEO))

# --------------------------------------------------------------- 3. capacidade
log("[3/5] capacidade por assento (totaalunoscreche2025.xlsx)")
# A planilha tem 3 linhas de cabecalho: grupamento / Integral-Parcial / Aluno-Turma,
# com celulas mescladas que o pandas devolve como 'Unnamed'.
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
CAP = {}
for chave, grup_real in GRUPAMENTOS.items():
    for horario in ("Integral", "Parcial"):
        alvo = [
            c
            for c in cap.columns
            if c[0].lower() == chave.lower() and c[1].lower() == horario.lower() and c[2].lower() == "aluno"
        ]
        if not alvo:
            log("  aviso: sem coluna para %s / %s" % (chave, horario))
            continue
        vals = pd.to_numeric(cap[alvo[0]], errors="coerce")
        for cod, v in zip(cap[col_desig], vals):
            if pd.notna(v) and v > 0:
                CAP[(int(cod), grup_real, horario)] = int(v)
log("  %d assentos com matricula registrada em 2025" % len(CAP))

# --------------------------------------------------------------- 4. Query A
log("[4/5] inscricoes de 2025 (Query A) - leitura em blocos")
COLS = [
    "ano", "prm_id", "plm_id", "ipl_id", "opcao", "unidade", "nome_unidade", "grupamento",
    "horario", "data_criacao", "aluno_anon", "sexo_crianca", "nascimento_aluno_anomes",
    "responsavel_anon", "CEP", "bairro", "situacao",
]
blocos, total = [], 0
for blk in pd.read_csv(
    os.path.join(BASE, "01_QueryA_InscricoesPorAno.csv.gz"),
    sep=";", encoding="utf-8-sig", usecols=COLS, dtype={"CEP": "string"}, chunksize=200_000,
):
    total += len(blk)
    blocos.append(blk[blk.prm_id == PRM])
qa = pd.concat(blocos, ignore_index=True)
del blocos
log("  %s linhas lidas | %s linhas do processo %d" % (f"{total:,}", f"{len(qa):,}", PRM))

for c in ("grupamento", "nome_unidade", "bairro", "horario", "situacao"):
    qa[c] = qa[c].astype(str).str.strip()

# taxa de confirmacao por posicao na preferencia
taxa_por_opcao = []
for op in sorted(qa.opcao.unique()):
    sub = qa[qa.opcao == op]
    if len(sub) < 200:
        continue
    taxa_por_opcao.append(
        {"opcao": int(op), "linhas": int(len(sub)), "taxaConfirmado": round(100 * sub.situacao.isin(CONFIRMADO).mean(), 1)}
    )

# ofertas simultaneas ao mesmo CPF -> assentos retidos
ofertas = qa[qa.situacao.isin(OFERTADO)]
por_crianca = ofertas.groupby("aluno_anon").size()
multi = int((por_crianca > 1).sum())
retidos = int((por_crianca - 1).clip(lower=0).sum())

# opcoes fora do bairro do responsavel
bairro_unidade = qa.unidade.map(lambda u: sem_acento((GEO.get(int(u)) or {}).get("bairro") or "").upper())
qa["_mesmo_bairro"] = qa.bairro.map(lambda b: sem_acento(b).upper()) == bairro_unidade
fora_por_opcao = []
for op in sorted(qa.opcao.unique()):
    sub = qa[qa.opcao == op]
    if len(sub) < 200:
        continue
    fora_por_opcao.append({"opcao": int(op), "foraDoBairro": round(100 * (~sub._mesmo_bairro).mean(), 1)})

# --------------------------------------------------------------- unidades.json
demanda = qa.groupby(["unidade", "grupamento", "horario"]).size()
confirmados = qa[qa.situacao.isin(CONFIRMADO)].groupby(["unidade", "grupamento", "horario"]).size()
procura_unidade = qa.groupby(["unidade", "nome_unidade"]).size().reset_index(name="procura")

por_unidade = {}
for (cod, grup, hor), dem in demanda.items():
    por_unidade.setdefault(int(cod), []).append((grup, hor, int(dem)))

unidades = []
for _, r in procura_unidade.sort_values("procura", ascending=False).iterrows():
    cod = int(r.unidade)
    g = GEO.get(cod, {})
    assentos = []
    for grup, hor, dem in sorted(por_unidade.get(cod, [])):
        capacidade = CAP.get((cod, grup, hor))
        origem = "matricula_2025"
        if capacidade is None:
            # sem registro na planilha: usa quantas criancas a unidade de fato confirmou
            capacidade = int(confirmados.get((cod, grup, hor), 0))
            origem = "confirmados_2025"
        if capacidade <= 0:
            continue
        assentos.append(
            {
                "grupamento": grup,
                "horario": hor,
                "capacidade": int(capacidade),
                "procura": dem,
                "origemCapacidade": origem,
            }
        )
    if not assentos:
        continue
    unidades.append(
        {
            "codigo": cod,
            "nome": nome_bonito(str(r.nome_unidade)),
            "nomeOriginal": str(r.nome_unidade),
            "bairro": g.get("bairro"),
            "rua": g.get("rua"),
            "cre": g.get("cre"),
            "microarea": g.get("microarea"),
            "lat": g.get("lat"),
            "lng": g.get("lng"),
            "tipo": g.get("tipo"),
            "assentos": assentos,
        }
    )
dump("unidades.json", unidades)
log(
    "  %d unidades | %d assentos | %d vagas | %d com geo"
    % (
        len(unidades),
        sum(len(u["assentos"]) for u in unidades),
        sum(a["capacidade"] for u in unidades for a in u["assentos"]),
        sum(1 for u in unidades if u["lat"]),
    )
)

# --------------------------------------------------------------- 5. Query B
log("[5/5] respostas socioeconomicas de 2025 (Query B) - leitura em blocos")
pontos_de = {c["ichPergId"]: c["pontos"] for c in criterios}
desempate_de = {c["ichPergId"]: c["desempate"] for c in criterios}

declarado, comprovado, desempates = {}, {}, {}
totalB = 0
for blk in pd.read_csv(
    os.path.join(BASE, "02_QueryB_RespostasSocioEconomicas.csv.gz"),
    sep=";", encoding="utf-8-sig",
    usecols=["ano", "prm_id", "plm_id", "ipl_id", "ich_perg_id", "resposta", "confirmado"],
    chunksize=500_000,
):
    totalB += len(blk)
    b = blk[(blk.prm_id == PRM) & (blk.resposta == "Sim")]
    if b.empty:
        continue
    for plm, ipl, perg, conf in zip(b.plm_id, b.ipl_id, b.ich_perg_id, b.confirmado):
        k = "%d-%d" % (int(plm), int(ipl))
        p = pontos_de.get(int(perg), 0)
        declarado[k] = declarado.get(k, 0) + p
        if conf == "Sim":
            comprovado[k] = comprovado.get(k, 0) + p
            if desempate_de.get(int(perg)):
                desempates.setdefault(k, []).append(int(perg))
log("  %s linhas lidas | %s inscricoes com ao menos um 'Sim'" % (f"{totalB:,}", f"{len(declarado):,}"))

chaves = {"%d-%d" % (int(p), int(i)) for p, i in zip(qa.plm_id, qa.ipl_id)}
n_insc = len(chaves)
n_declarou = sum(1 for k in chaves if declarado.get(k, 0) > 0)
n_comprovou = sum(1 for k in chaves if comprovado.get(k, 0) > 0)

fatos = {
    "processo": {"prmId": PRM, "ano": ANO},
    "inscricoes": n_insc,
    "linhasOpcao": int(len(qa)),
    "criancas": int(qa.aluno_anon.nunique()),
    "unidadesProcuradas": int(qa.unidade.nunique()),
    "declararamCriterio": n_declarou,
    "declararamCriterioPct": round(100 * n_declarou / n_insc, 1),
    "comprovaramCriterio": n_comprovou,
    "comprovaramCriterioPct": round(100 * n_comprovou / n_insc, 1),
    "empatadosEmZero": n_insc - n_comprovou,
    "empatadosEmZeroPct": round(100 * (n_insc - n_comprovou) / n_insc, 1),
    "ofertasSimultaneas": {
        "criancasOfertadas": int(len(por_crianca)),
        "criancasComMaisDeUmaOferta": multi,
        "assentosRetidos": retidos,
    },
    "taxaPorOpcao": taxa_por_opcao,
    "foraDoBairroPorOpcao": fora_por_opcao,
    "fonte": "CIT-SME-RJ/dadoscreche - processo 195 (2025)",
}
dump("fatos.json", fatos)
resumo = {k: v for k, v in fatos.items() if k not in ("taxaPorOpcao", "foraDoBairroPorOpcao")}
log(json.dumps(resumo, ensure_ascii=False, indent=1))

# ---------------------------------------------------------- fila-seed.json
log("[extra] semente da fila com inscricoes reais de 2025")
seed = []
for (plm, ipl), grp in qa.sort_values(["plm_id", "ipl_id", "opcao"]).groupby(["plm_id", "ipl_id"]):
    g0 = grp.iloc[0]
    k = "%d-%d" % (int(plm), int(ipl))
    seed.append(
        {
            "id": k,
            "aluno": str(g0.aluno_anon),
            "nascimento": str(g0.nascimento_aluno_anomes),
            "sexo": str(g0.sexo_crianca),
            "bairro": None if str(g0.bairro) in ("nan", "") else str(g0.bairro),
            "cep": None if pd.isna(g0.CEP) else str(g0.CEP),
            "criadaEm": str(g0.data_criacao),
            "pontosDeclarados": int(declarado.get(k, 0)),
            "pontosComprovados": int(comprovado.get(k, 0)),
            "desempates": sorted(desempates.get(k, [])),
            "opcoes": [
                {
                    "ordem": int(r.opcao),
                    "unidade": int(r.unidade),
                    "grupamento": str(r.grupamento),
                    "horario": str(r.horario),
                }
                for _, r in grp.iterrows()
            ],
            "situacaoHistorica": [str(s) for s in grp.situacao.tolist()],
        }
    )
seed.sort(key=lambda s: s["criadaEm"])
dump("fila-seed.json", seed)
log("  %d inscricoes na semente" % len(seed))
log("OK")
