# SatTrack Plus — Controle de Sinistros

Sistema interno do **Setor Plus** da SatTrack Proteção Veicular para registrar,
organizar, acompanhar e concluir sinistros — da entrada do caso até o
encerramento.

O elemento central é um **quadro Kanban** com quatro etapas, e cada sinistro é
um card que a equipe arrasta de uma coluna para outra:

```
Acabou de entrar  →  Caso urgente  →  Resolvendo  →  Caso concluído
```

Toda movimentação é salva na hora e registrada no histórico do caso.

> Não é um sistema de rastreamento de veículos. É controle de sinistros.

---

## Como abrir

Não precisa instalar nada nem compilar: é HTML, CSS e JavaScript puros.

**Opção 1 — arquivo único (mais simples)**
Dê dois cliques em **`sattrack-plus.html`**. É a aplicação inteira num só
arquivo — dá para copiar num pen drive, mandar por e-mail ou WhatsApp e abrir
em qualquer computador, sem pasta de apoio e sem internet.

**Opção 2 — abrir os fontes**
Dê dois cliques em `index.html` (usa as pastas `css/` e `js/`).

**Opção 3 — servidor local** (recomendado para uso em rede)

```bash
cd sattrack-plus
python3 -m http.server 8080
# acesse http://localhost:8080
```

**Opção 4 — publicar**
Suba a pasta `sattrack-plus/` (ou só o `sattrack-plus.html`) em qualquer
hospedagem de sites estáticos
(Vercel, Netlify, GitHub Pages, IIS, Apache, Nginx).

### Acessos de demonstração

| Usuário    | Senha      | Perfil        |
| ---------- | ---------- | ------------- |
| `admin`    | `admin123` | Administrador |
| `fernanda` | `1234`     | Atendente     |
| `carla`    | `1234`     | Atendente     |
| `rafael`   | `1234`     | Atendente     |

Troque as senhas em **Usuários** antes de usar de verdade.

---

## O que o sistema faz

### Quadro Kanban

- Quatro colunas: *Acabou de entrar*, *Caso urgente*, *Resolvendo*, *Caso concluído*.
- Arrastar e soltar entre quaisquer colunas, inclusive reabrindo um caso
  concluído (*Caso concluído → Resolvendo*).
- No celular e no tablet, cada card traz botões `→ Coluna` que fazem o mesmo
  papel do arrastar.
- Concluir e reabrir pedem confirmação; as demais movimentações são diretas.
- Cards urgentes ganham destaque vermelho sem prejudicar a leitura.

### Card do sinistro

Mostra associado, número do sinistro, tipo, placa, marca e modelo, data e
horário do incidente, atendente, responsável, vítimas, veículos envolvidos,
prioridade, alertas ativos e há quanto tempo o caso está aberto.

### Cadastro

Botão verde **+ Cadastrar sinistro** abre o formulário em painel lateral, com
os blocos: dados do registro, dados do associado, dados do incidente, dados do
veículo protegido, dados do sinistro e prazos.

Regras aplicadas no cadastro:

- obrigatórios: associado, WhatsApp, placa, número do sinistro, data e horário
  do incidente, atendente e responsável;
- placa convertida automaticamente para maiúsculas;
- telefone com máscara brasileira `(00) 00000-0000`;
- CPF com máscara `000.000.000-00`;
- vítimas e veículos aceitam apenas números;
- número do sinistro não pode se repetir (sugerido automaticamente).

### Página interna do caso

Ao clicar num card abre o painel com seis abas:

| Aba | O que tem |
| --- | --- |
| **Resumo** | Todos os dados, alertas do caso, troca rápida de status, prioridade, atendente e responsável, link direto para o WhatsApp do associado e campo de observações |
| **Acompanhamento do caso** | Registro de atualizações com tipo, data, horário, autor, descrição, próxima ação e prazo de retorno |
| **Contatos** | Contatos com o associado e com oficinas/prestadores, por canal |
| **Documentos** | Anexos de imagens e arquivos (até 2 MB por arquivo, configurável) |
| **Histórico do sinistro** | Registro automático de tudo que aconteceu |
| **Editar cadastro** | Formulário completo para correções |

### Histórico automático

Toda alteração vira uma linha com data, horário, usuário, o que mudou e o
"de → para":

> 04/08/2026 às 16h20 — Sinistro movido de "Caso urgente" para "Resolvendo" pela atendente Fernanda Alves.

São registrados: cadastro, edição, movimentação entre colunas, mudança de
status, prioridade, atendente e responsável, observações, atualizações do
acompanhamento, contatos, anexos e conclusão/reabertura.

### Alertas e prazos

Calculados automaticamente e exibidos no card, na página do caso e na tela
*Prazos e pendências*:

- caso urgente sem atualização;
- prazo de retorno vencido;
- documentos pendentes;
- sinistro parado há muito tempo;
- caso sem atualização recente;
- caso sem responsável;
- caso sem contato recente com o associado.

Os limites (horas e dias) ficam em **Configurações**.

### Busca, filtros e indicadores

- Busca por associado, número do sinistro, protocolo, CPF, WhatsApp, placa,
  modelo, marca, atendente, responsável, local e tipo.
- Filtros por status, prioridade, tipo, atendente, responsável, data do
  incidente, data de abertura, casos com vítimas, urgentes, com documentos
  pendentes, com prazo vencido, sem atualização, sem responsável e concluídos.
- Nove indicadores no topo, atualizados sozinhos: abertos, acabaram de entrar,
  urgentes, em resolução, concluídos hoje, com vítimas, prazo vencido, sem
  atualização e tempo médio até a conclusão.

### Relatórios

Sinistros por período, tipo, atendente, responsável, status e classificação;
casos urgentes, com vítimas, pendentes, concluídos e com prazo vencido; total
de veículos envolvidos e tempo médio de resolução.

Filtro por período (hoje, 7, 30 dias, este mês, mês passado, este ano, todo o
período ou intervalo personalizado) e exportação em **planilha (CSV)** ou
**PDF** (pela impressão do navegador, com layout próprio).

### Usuários e permissões

| Ação | Administrador | Atendente |
| --- | :---: | :---: |
| Cadastrar, visualizar e editar sinistros | ✓ | ✓ |
| Movimentar entre colunas | ✓ | ✓ |
| Registrar acompanhamento, contatos e anexos | ✓ | ✓ |
| Concluir e reabrir casos | ✓ | ✓ |
| Excluir sinistros | ✓ | — |
| Gerenciar usuários | ✓ | — |

Casos concluídos **não são apagados**: continuam no quadro, na busca e nos
relatórios.

---

## Onde os dados ficam

Tudo é gravado no `localStorage` do navegador, sob a chave
`sattrack.plus.sinistros.v1`. Os dados sobrevivem a atualizações da página e ao
fechamento do navegador, e **ficam no computador em que foram cadastrados** —
não há servidor central.

Consequências práticas:

- em **Configurações** há **Baixar backup (JSON)** e **Importar backup**, para
  levar a base a outra máquina ou guardar uma cópia;
- exportar em planilha também serve como cópia de segurança legível;
- limpar os dados do navegador apaga a base — faça backup antes;
- as senhas ficam no próprio navegador, sem criptografia: o controle de acesso
  organiza quem faz o quê na equipe, não protege contra quem já tem acesso ao
  computador.

Para uso com base compartilhada entre várias máquinas, o passo seguinte é trocar
a camada `js/dados.js` por chamadas a uma API — o restante da aplicação não
precisa mudar, porque só conversa com esse arquivo.

---

## Estrutura

```
sattrack-plus/
├── sattrack-plus.html    ARQUIVO ÚNICO pronto para usar (gerado)
├── build.mjs             gera o arquivo único a partir dos fontes
├── index.html            estrutura da página, login e painéis
├── favicon.svg
├── css/
│   └── estilos.css       identidade visual e responsividade
└── js/
    ├── util.js           datas, máscaras, formatação, exportação
    ├── dados.js          modelo, persistência, histórico, alertas, indicadores
    ├── ui.js             avisos, confirmações, gaveta lateral
    ├── formularios.js    cadastro e página interna do sinistro
    ├── kanban.js         quadro, cards e arrastar-e-soltar
    ├── paginas.js        visão geral, listas, prazos, histórico, usuários, configurações
    ├── relatorios.js     relatórios e exportação
    └── app.js            menu, rotas, indicadores e busca
```

Sem dependências externas e sem instalação.

Ao mexer em qualquer fonte, regenere o arquivo único:

```bash
node build.mjs
```

Ele junta o CSS e os oito scripts dentro do HTML, embute o ícone e confere que
nada ficou apontando para arquivo externo.

---

## Identidade visual

Fundo branco; azul-escuro e azul-claro em menu, títulos e detalhes; verde em
salvar, confirmar e concluir; vermelho em alertas e casos urgentes; cinza-claro
em divisórias e informações de apoio. Prioridade sinalizada por cor: verde
(normal), amarelo (atenção) e vermelho (urgente).

Testado em telas de 390 px (celular), tablet e desktop.

---

## Dados de demonstração

A base já vem com cinco casos de exemplo: um que acabou de entrar, um urgente
com vítimas, um em resolução, um aguardando documentos (com prazo vencido) e um
concluído. Em **Configurações**, o administrador pode recriar essa base a
qualquer momento.
