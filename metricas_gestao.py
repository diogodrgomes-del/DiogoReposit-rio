#!/usr/bin/env python3
"""Metricas de gestao das campanhas da Meta, com foco em conversas iniciadas.

Uso:
    export META_ACCESS_TOKEN="EAA..."
    python3 metricas_gestao.py --saida ./dados

Puxa o funil de mensagens (conversa iniciada -> 1a resposta -> profundidade 2, 3
e 5), alcance, frequencia e cliques no link, no nivel de campanha e no
consolidado mensal. Gera CSVs e um resumo no terminal.

O token e lido de META_ACCESS_TOKEN e nunca aparece na saida.
"""

import argparse
import csv
import os
import sys
from collections import defaultdict

import requests

API = "https://graph.facebook.com/v21.0"
TIMEOUT = 60

# Funil de mensagens, do topo para o fundo.
FUNIL = [
    ("conversas",  "onsite_conversion.messaging_conversation_started_7d"),
    ("conexoes",   "onsite_conversion.total_messaging_connection"),
    ("resposta_1", "onsite_conversion.messaging_first_reply"),
    ("prof_2",     "onsite_conversion.messaging_user_depth_2_message_send"),
    ("prof_3",     "onsite_conversion.messaging_user_depth_3_message_send"),
    ("prof_5",     "onsite_conversion.messaging_user_depth_5_message_send"),
]
OUTRAS = [
    ("link_clicks",     "link_click"),
    ("engaj_post",      "post_engagement"),
    ("reacoes",         "post_reaction"),
    ("salvamentos",     "onsite_conversion.post_save"),
    ("comentarios",     "comment"),
]

CAMPOS = ("campaign_id,campaign_name,objective,spend,impressions,reach,"
          "frequency,clicks,inline_link_clicks,ctr,cpc,cpm,actions")


class Falha(Exception):
    pass


def limpar(t, token):
    return str(t).replace(token, "<TOKEN>")


def paginar(caminho, token, **params):
    params["access_token"] = token
    url, itens = f"{API}/{caminho}", []
    while url:
        try:
            r = requests.get(url, params=params, timeout=TIMEOUT)
        except requests.exceptions.RequestException as e:
            raise Falha(limpar(e, token)) from None
        corpo = r.json() if r.content else {}
        if "error" in corpo:
            raise Falha(f"({corpo['error'].get('code')}) {corpo['error'].get('message')}")
        itens.extend(corpo.get("data", []))
        url = corpo.get("paging", {}).get("next")
        params = None
    return itens


def acoes(linha):
    """Achata a lista 'actions' num dicionario action_type -> valor."""
    return {a["action_type"]: float(a.get("value", 0))
            for a in linha.get("actions", [])}


def f(v, casas=2):
    return round(float(v or 0), casas)


def i(v):
    return int(float(v or 0))


def div(a, b, casas=2):
    return round(a / b, casas) if b else None


def extrair(linha, conta, mes=None):
    a = acoes(linha)
    d = {"conta": conta}
    if mes:
        d["mes"] = mes
    d.update({
        "campanha": linha.get("campaign_name", ""),
        "objetivo": linha.get("objective", ""),
        "gasto": f(linha.get("spend")),
        "impressoes": i(linha.get("impressions")),
        "alcance": i(linha.get("reach")),
        "frequencia": f(linha.get("frequency")),
        "cliques": i(linha.get("clicks")),
        "cliques_link": i(linha.get("inline_link_clicks")),
        "ctr": f(linha.get("ctr"), 4),
        "cpc": f(linha.get("cpc"), 4),
        "cpm": f(linha.get("cpm")),
    })
    for nome, chave in FUNIL + OUTRAS:
        d[nome] = i(a.get(chave, 0))

    # As metricas que decidem orcamento.
    d["custo_conversa"] = div(d["gasto"], d["conversas"])
    d["conv_por_1k_alcance"] = div(d["conversas"] * 1000, d["alcance"])
    d["taxa_conversa_clique"] = div(d["conversas"] * 100, d["cliques_link"])
    d["taxa_resposta"] = div(d["resposta_1"] * 100, d["conversas"])
    d["taxa_prof_3"] = div(d["prof_3"] * 100, d["conversas"])
    return d


def escrever(caminho, linhas):
    if not linhas:
        return
    with open(caminho, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(linhas[0]))
        w.writeheader()
        w.writerows(linhas)
    print(f"  {caminho}  ({len(linhas)} linhas)")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--saida", default=".")
    args = p.parse_args()

    token = os.environ.get("META_ACCESS_TOKEN")
    if not token:
        print("ERRO: defina META_ACCESS_TOKEN.", file=sys.stderr)
        return 2
    os.makedirs(args.saida, exist_ok=True)

    try:
        contas = paginar("me/adaccounts", token, fields="id,name", limit=100)
        camp, mensal = [], []

        for c in contas:
            nome, cid = c.get("name", c["id"]), c["id"]
            print(f"[{nome}]")

            for linha in paginar(f"{cid}/insights", token, level="campaign",
                                 fields=CAMPOS, date_preset="maximum", limit=500):
                camp.append(extrair(linha, nome))

            for linha in paginar(f"{cid}/insights", token, level="campaign",
                                 fields=CAMPOS, date_preset="maximum",
                                 time_increment="monthly", limit=500):
                mensal.append(extrair(linha, nome, linha.get("date_start", "")[:7]))

        print("\nArquivos gerados:")
        escrever(os.path.join(args.saida, "gestao_campanhas.csv"), camp)
        escrever(os.path.join(args.saida, "gestao_mensal.csv"), mensal)

        # ---- resumo -------------------------------------------------------
        tot = defaultdict(float)
        for d in camp:
            for k in ("gasto", "impressoes", "alcance", "cliques", "cliques_link",
                      "conversas", "resposta_1", "prof_2", "prof_3", "prof_5"):
                tot[k] += d[k]

        print("\n" + "=" * 66)
        print("CONSOLIDADO — TODAS AS CONTAS")
        print("=" * 66)
        print(f"  investimento ......... R$ {tot['gasto']:,.2f}")
        print(f"  alcance .............. {int(tot['alcance']):,} pessoas")
        print(f"  cliques no link ...... {int(tot['cliques_link']):,}")
        print(f"  CONVERSAS INICIADAS .. {int(tot['conversas']):,}")
        if tot["conversas"]:
            print(f"  custo por conversa ... R$ {tot['gasto'] / tot['conversas']:,.2f}")
        print()
        print("  FUNIL DE MENSAGENS")
        base = tot["conversas"] or 1
        for rot, chave in (("conversa iniciada", "conversas"),
                           ("1a resposta", "resposta_1"),
                           ("2a mensagem", "prof_2"),
                           ("3a mensagem", "prof_3"),
                           ("5a mensagem", "prof_5")):
            v = int(tot[chave])
            print(f"    {rot:20} {v:5}   {v / base * 100:5.1f}% da conversa")

        com = [d for d in camp if d["conversas"] > 0]
        sem = [d for d in camp if d["conversas"] == 0]
        print(f"\n  campanhas COM conversa: {len(com)}  "
              f"(R$ {sum(d['gasto'] for d in com):,.2f})")
        print(f"  campanhas SEM conversa: {len(sem)}  "
              f"(R$ {sum(d['gasto'] for d in sem):,.2f})")

        print("\n  RANKING POR CUSTO/CONVERSA")
        for d in sorted(com, key=lambda x: x["custo_conversa"]):
            print(f"    R$ {d['custo_conversa']:6.2f}  {d['conversas']:3} conv  "
                  f"R$ {d['gasto']:7.2f}  {d['campanha'][:44]}")

    except Falha as e:
        print(f"\nFALHOU: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
