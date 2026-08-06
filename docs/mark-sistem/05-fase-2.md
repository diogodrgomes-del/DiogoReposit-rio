# Fase 2 — CRM de Vendas

- [`00-arquitetura.md`](00-arquitetura.md) · [`01-modelagem.md`](01-modelagem.md) · [`02-roadmap.md`](02-roadmap.md) · [`03-fase-0.md`](03-fase-0.md) · [`04-fase-1.md`](04-fase-1.md)

## O que ficou pronto

| Peça | Estado |
|---|---|
| Migração 0007 — pipelines, etapas, leads, atividades, propostas | pronta |
| Ordenação fracionária do Kanban | pronta, 18 testes |
| `core/leads` — quadro, criar, mover, perda, resumo | pronto |
| Quadro Kanban com arrastar e soltar | pronto |
| Cadastro rápido de lead | pronto |
| Ficha do lead com motivo de perda | pronta |
| Atividades — ligações, reuniões, follow-ups | prontas |
| Onboarding — lead vira cliente | pronto |

**147 testes**, 25 deles contra Postgres real no CI.

## Falta na fase 2

Propostas têm tabela e índice, mas ainda não têm tela.

---

## O algoritmo que faz o Kanban ser rápido

Ordenar cards com uma coluna inteira — 1, 2, 3… — parece óbvio e é a escolha
errada. Arrastar um card para o meio obriga a renumerar todos os seguintes:
dezenas de `UPDATE`s numa transação, com lock na coluna inteira. Com 200 cards a
diferença é entre 4ms e 400ms, e dois vendedores arrastando ao mesmo tempo
disputam as mesmas linhas.

A coluna é `numeric` e o card entra **entre** os vizinhos: um card entre 3 e 4
recebe 3.5. Arrastar vira um `UPDATE` de uma linha.

O preço é a precisão finita: dividir ao meio no mesmo ponto esgota os dígitos
depois de umas 50 vezes. `precisaReequilibrar` detecta, e a coluna é
redistribuída na mesma transação — raro, e invisível para quem arrasta. Os 18
testes de `ordem.ts` existem para provar as duas coisas: que a ordem se mantém, e
que o esgotamento demora o suficiente para reequilibrar ser exceção, não rotina.

## O que a tela mostra e o que ela esconde

O card traz nome, empresa, telefone, valor, temperatura e responsável. Nada
mais. Um card com quinze campos vira parede de texto e ninguém lê nenhum — o
resto está na ficha, a um clique.

O cadastro pede **nome e telefone**, e só. É o requisito 7.3 do briefing, e a
razão dele é prática: quem está ao telefone com um interessado não pode parar
para descobrir o segmento da empresa antes de salvar. Todo campo opcional leva
"opcional" no rótulo, para ninguém travar achando que precisa buscar o dado.

O motivo de perda só aparece quando o card já está na coluna de perda, e pode
ser pulado. Perguntar antes seria perguntar sobre algo que não aconteceu.

## Uma fronteira nova: navegador e servidor

O quadro é um componente de cliente e importava `formatarTelefone` de
`@mark/core`. Esse barril reexporta as regras de negócio, que falam com Drizzle
— e um único import de **valor** a partir dele arrastou o driver do Postgres
para o pacote do navegador. O build quebrou com um rastro apontando para
`node_modules/pg`.

`@mark/core/navegador` passou a existir: telefone, ordenação, permissões e
tipos, sem nada que toque em banco. Componentes `"use client"` importam de lá.

`testes/cliente-servidor.test.ts` varre os arquivos `"use client"` e reprova
quem importar valor do servidor. O build do Next também pega, mas leva minutos e
a mensagem não diz o que fazer; o teste leva milissegundos e diz.
