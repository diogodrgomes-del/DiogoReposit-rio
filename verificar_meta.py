#!/usr/bin/env python3
"""Verifica o acesso a Graph API da Meta e lista metricas das campanhas.

Uso:
    export META_ACCESS_TOKEN="EAA..."
    python3 verificar_meta.py                 # validacao + contas + campanhas
    python3 verificar_meta.py --dias 7         # janela de insights (padrao: 30)
    python3 verificar_meta.py --somente-token  # so valida o token

O token e lido da variavel de ambiente META_ACCESS_TOKEN e nunca e impresso.
"""

import argparse
import os
import sys
from datetime import datetime

import requests

API = "https://graph.facebook.com/v21.0"
TIMEOUT = 30


class FalhaVerificacao(Exception):
    pass


def limpar(texto, token):
    """As excecoes do requests carregam a URL inteira, token incluso."""
    return str(texto).replace(token, "<TOKEN>")


def get(caminho, token, **params):
    params["access_token"] = token
    try:
        r = requests.get(f"{API}/{caminho}", params=params, timeout=TIMEOUT)
    except requests.exceptions.ProxyError as e:
        raise FalhaVerificacao(
            f"proxy recusou a conexao com graph.facebook.com: {limpar(e, token)}\n"
            "  O dominio provavelmente nao esta liberado na politica de rede "
            "deste ambiente."
        ) from None
    except requests.exceptions.RequestException as e:
        raise FalhaVerificacao(f"falha de rede: {limpar(e, token)}") from None

    corpo = r.json() if r.content else {}
    if "error" in corpo:
        err = corpo["error"]
        raise FalhaVerificacao(
            f"a Meta devolveu erro {err.get('code')}/{err.get('error_subcode', '-')}: "
            f"{err.get('message')}"
        )
    try:
        r.raise_for_status()
    except requests.exceptions.HTTPError as e:
        raise FalhaVerificacao(limpar(e, token)) from None
    return corpo


def validar_token(token):
    """debug_token: expiracao, escopos e app dono do token."""
    dados = get("debug_token", token, input_token=token).get("data", {})

    valido = dados.get("is_valid", False)
    print(f"  valido .......... {'sim' if valido else 'NAO'}")
    print(f"  tipo ............ {dados.get('type', 'desconhecido')}")
    print(f"  app id .......... {dados.get('app_id', '-')}")

    expira = dados.get("expires_at", 0)
    if expira == 0:
        print("  expiracao ....... nunca (token de longa duracao)")
    else:
        quando = datetime.fromtimestamp(expira)
        restante = quando - datetime.now()
        print(f"  expiracao ....... {quando:%d/%m/%Y %H:%M} "
              f"({restante.days} dias restantes)")

    escopos = dados.get("scopes", [])
    print(f"  permissoes ...... {', '.join(escopos) if escopos else 'nenhuma'}")

    if not valido:
        raise FalhaVerificacao("token invalido ou revogado")

    faltando = {"ads_read", "ads_management"} - set(escopos)
    if faltando == {"ads_read", "ads_management"}:
        print(f"  AVISO: sem ads_read nem ads_management; "
              f"a leitura de metricas vai falhar.")

    return dados


def listar_contas(token):
    contas = get("me/adaccounts", token,
                 fields="id,name,account_status,currency",
                 limit=50).get("data", [])
    if not contas:
        print("  nenhuma conta de anuncios acessivel por este token")
        return []

    ativa = {1: "ativa", 2: "desativada", 3: "invalida", 101: "encerrada"}
    for c in contas:
        status = ativa.get(c.get("account_status"), str(c.get("account_status")))
        print(f"  {c['id']}  {c.get('name', '-')}  [{status}, {c.get('currency', '-')}]")
    return contas


def listar_campanhas(token, conta_id, dias):
    campanhas = get(f"{conta_id}/campaigns", token,
                    fields="name,status,objective",
                    limit=100).get("data", [])
    if not campanhas:
        print("    sem campanhas nesta conta")
        return

    insights = get(f"{conta_id}/insights", token,
                   level="campaign",
                   fields="campaign_id,impressions,clicks,spend,ctr,cpc",
                   date_preset=f"last_{dias}d",
                   limit=100).get("data", [])
    por_id = {i["campaign_id"]: i for i in insights}

    for c in campanhas:
        m = por_id.get(c["id"], {})
        print(f"    {c['name']}  [{c.get('status', '-')}]")
        if m:
            print(f"      gasto {m.get('spend', '0')} | "
                  f"impressoes {m.get('impressions', '0')} | "
                  f"cliques {m.get('clicks', '0')} | "
                  f"ctr {m.get('ctr', '0')}% | "
                  f"cpc {m.get('cpc', '0')}")
        else:
            print(f"      sem dados nos ultimos {dias} dias")


def main():
    p = argparse.ArgumentParser(description="Verifica acesso a Graph API da Meta")
    p.add_argument("--dias", type=int, default=30,
                   help="janela de insights em dias (padrao: 30)")
    p.add_argument("--somente-token", action="store_true",
                   help="valida o token e para por ai")
    args = p.parse_args()

    token = os.environ.get("META_ACCESS_TOKEN")
    if not token:
        print("ERRO: defina META_ACCESS_TOKEN antes de rodar.", file=sys.stderr)
        print('  export META_ACCESS_TOKEN="EAA..."', file=sys.stderr)
        return 2

    try:
        print("[1/3] validando o token")
        validar_token(token)
        if args.somente_token:
            print("\nOK: token valido.")
            return 0

        print("\n[2/3] contas de anuncios acessiveis")
        contas = listar_contas(token)

        print(f"\n[3/3] campanhas e metricas (ultimos {args.dias} dias)")
        for c in contas:
            print(f"  {c.get('name', c['id'])}")
            listar_campanhas(token, c["id"], args.dias)

    except FalhaVerificacao as e:
        print(f"\nFALHOU: {e}", file=sys.stderr)
        return 1

    print("\nOK: conexao com a Meta verificada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
