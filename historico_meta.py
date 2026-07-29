#!/usr/bin/env python3
"""Exporta o historico completo (lifetime) das contas de anuncios da Meta.

Uso:
    export META_ACCESS_TOKEN="EAA..."
    python3 historico_meta.py                  # lifetime + serie mensal
    python3 historico_meta.py --saida ./dados  # diretorio de saida

Gera tres CSVs:
    campanhas_lifetime.csv  - total acumulado por campanha
    mensal_por_campanha.csv - serie mensal por campanha
    mensal_por_conta.csv    - serie mensal agregada por conta

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

METRICAS = ("impressions", "clicks", "spend", "reach", "ctr", "cpc", "cpm")


class FalhaExport(Exception):
    pass


def limpar(texto, token):
    return str(texto).replace(token, "<TOKEN>")


def paginar(caminho, token, **params):
    """Percorre todas as paginas de um edge da Graph API."""
    params["access_token"] = token
    url = f"{API}/{caminho}"
    itens = []

    while url:
        try:
            r = requests.get(url, params=params, timeout=TIMEOUT)
        except requests.exceptions.RequestException as e:
            raise FalhaExport(limpar(e, token)) from None

        corpo = r.json() if r.content else {}
        if "error" in corpo:
            err = corpo["error"]
            raise FalhaExport(f"({err.get('code')}) {err.get('message')}")

        itens.extend(corpo.get("data", []))
        # O cursor 'next' ja carrega todos os parametros, inclusive o token.
        url = corpo.get("paging", {}).get("next")
        params = None

    return itens


def num(valor, inteiro=True):
    if valor in (None, ""):
        return 0
    return int(float(valor)) if inteiro else round(float(valor), 2)


def contas(token):
    return paginar("me/adaccounts", token,
                   fields="id,name,account_status,currency", limit=100)


def insights(conta_id, token, incremento=None):
    p = {
        "level": "campaign",
        "fields": "campaign_id,campaign_name,objective," + ",".join(METRICAS),
        "date_preset": "maximum",
        "limit": 500,
    }
    if incremento:
        p["time_increment"] = incremento
    return paginar(f"{conta_id}/insights", token, **p)


def escrever(caminho, colunas, linhas):
    with open(caminho, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=colunas)
        w.writeheader()
        w.writerows(linhas)
    print(f"  {caminho}  ({len(linhas)} linhas)")


def main():
    p = argparse.ArgumentParser(description="Exporta historico lifetime da Meta")
    p.add_argument("--saida", default=".", help="diretorio de saida (padrao: .)")
    args = p.parse_args()

    token = os.environ.get("META_ACCESS_TOKEN")
    if not token:
        print("ERRO: defina META_ACCESS_TOKEN antes de rodar.", file=sys.stderr)
        return 2

    os.makedirs(args.saida, exist_ok=True)

    try:
        lista = contas(token)
        if not lista:
            print("Nenhuma conta acessivel por este token.", file=sys.stderr)
            return 3
        print(f"{len(lista)} conta(s) encontrada(s)\n")

        lifetime, mensal = [], []

        for c in lista:
            nome, cid = c.get("name", c["id"]), c["id"]
            print(f"[{nome}]")

            for linha in insights(cid, token):
                lifetime.append({
                    "conta": nome, "conta_id": cid,
                    "campanha": linha.get("campaign_name", ""),
                    "campanha_id": linha.get("campaign_id", ""),
                    "objetivo": linha.get("objective", ""),
                    "inicio": linha.get("date_start", ""),
                    "fim": linha.get("date_stop", ""),
                    "gasto": num(linha.get("spend"), False),
                    "impressoes": num(linha.get("impressions")),
                    "alcance": num(linha.get("reach")),
                    "cliques": num(linha.get("clicks")),
                    "ctr": num(linha.get("ctr"), False),
                    "cpc": num(linha.get("cpc"), False),
                    "cpm": num(linha.get("cpm"), False),
                })
            print(f"  lifetime: {len(lifetime)} campanha(s) acumulada(s)")

            for linha in insights(cid, token, incremento="monthly"):
                mensal.append({
                    "conta": nome, "conta_id": cid,
                    "mes": linha.get("date_start", "")[:7],
                    "campanha": linha.get("campaign_name", ""),
                    "campanha_id": linha.get("campaign_id", ""),
                    "gasto": num(linha.get("spend"), False),
                    "impressoes": num(linha.get("impressions")),
                    "alcance": num(linha.get("reach")),
                    "cliques": num(linha.get("clicks")),
                    "ctr": num(linha.get("ctr"), False),
                    "cpc": num(linha.get("cpc"), False),
                })
            print(f"  mensal:   {len(mensal)} registro(s) acumulado(s)")

        # Agrega o mensal por conta: CTR/CPC recalculados, nunca somados.
        agg = defaultdict(lambda: defaultdict(float))
        for m in mensal:
            k = (m["conta"], m["mes"])
            for campo in ("gasto", "impressoes", "cliques"):
                agg[k][campo] += m[campo]

        por_conta = []
        for (conta, mes), v in sorted(agg.items()):
            imp, cli = v["impressoes"], v["cliques"]
            por_conta.append({
                "conta": conta, "mes": mes,
                "gasto": round(v["gasto"], 2),
                "impressoes": int(imp), "cliques": int(cli),
                "ctr": round(cli / imp * 100, 4) if imp else 0,
                "cpc": round(v["gasto"] / cli, 4) if cli else 0,
            })

        print("\nArquivos gerados:")
        escrever(os.path.join(args.saida, "campanhas_lifetime.csv"),
                 list(lifetime[0]), lifetime)
        escrever(os.path.join(args.saida, "mensal_por_campanha.csv"),
                 list(mensal[0]), mensal)
        escrever(os.path.join(args.saida, "mensal_por_conta.csv"),
                 list(por_conta[0]), por_conta)

        total = sum(x["gasto"] for x in lifetime)
        cliques = sum(x["cliques"] for x in lifetime)
        imps = sum(x["impressoes"] for x in lifetime)
        meses = sorted({m["mes"] for m in mensal if m["mes"]})
        print(f"\nTOTAL LIFETIME: R$ {total:,.2f} | {imps:,} impressoes | "
              f"{cliques:,} cliques")
        if meses:
            print(f"PERIODO: {meses[0]} a {meses[-1]} ({len(meses)} meses)")

    except FalhaExport as e:
        print(f"\nFALHOU: {e}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
