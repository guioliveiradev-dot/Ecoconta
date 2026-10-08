# 🌿 EcoConta

Assistente financeiro da casa: controle de **água**, **energia** e **orçamento**, feito para ajudar famílias a gastar menos, evitar desperdícios e guardar dinheiro.

App web instalável (PWA) em HTML, CSS e JavaScript puros. Sem build, sem servidor, sem cadastro. Os dados ficam só no celular (localStorage) e funciona offline.

## O que tem

Calculadora de energia (por aparelho) · Calculadora de água · Diagnóstico de economia · Controle de contas · Calendário de vencimentos com avisos · Orçamento mensal · Metas · Relatório mensal · Pontos e níveis · Alertas · Assistente (por regras, offline) · Impacto ambiental · Modo família · Modo "Mês difícil" · Backup/restauração.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `ecoconta`), público.
2. Envie **o conteúdo desta pasta** para a raiz do repositório (arraste os arquivos em *Add file → Upload files*, ou use `git`).
3. No repositório: **Settings → Pages → Build and deployment**. Em *Source* escolha **Deploy from a branch**, branch **main**, pasta **/ (root)** e salve.
4. Aguarde 1–2 minutos. O endereço será `https://SEU-USUARIO.github.io/ecoconta/`.

## Instalar no celular

- **Android (Chrome):** abra o endereço → menu ⋮ → **Instalar app** (ou *Adicionar à tela inicial*).
- **iPhone (Safari):** abra o endereço → botão Compartilhar → **Adicionar à Tela de Início**.

## Atualizar o app depois

Depois de mudar qualquer arquivo, aumente o número em `sw.js` (`const CACHE = 'ecoconta-v3'` → `v2`) para os celulares pegarem a versão nova.

## Testar no computador

```
python3 -m http.server 8000
```
e abra http://localhost:8000. (O service worker só funciona via http(s), não abrindo o arquivo direto.)

## Limitações conhecidas

- **Avisos de vencimento** aparecem quando o app é aberto. Avisos com o app fechado exigem um servidor de notificações push (não incluído).
- **Modo família** não sincroniza entre celulares: cada aparelho guarda seus dados. Sincronizar exige um backend.
- O **assistente** é baseado em regras sobre os dados cadastrados; não usa IA nem internet.
- Os cálculos são **estimativas** (potências, vazões e tarifas padrão ajustáveis em Ajustes).
- Limpar os dados do navegador apaga o app. Use **Ajustes → Exportar backup**.
