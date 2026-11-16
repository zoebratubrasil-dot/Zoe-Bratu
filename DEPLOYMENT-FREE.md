# Maison Privé — implantação gratuita

Esta configuração mantém o frontend no Cloudflare Pages e executa o servidor Express/Node.js no Render. O Supabase continua responsável pelo banco de dados e pelos arquivos.

## 0. Supabase — atualizar o projeto existente

O projeto `modelo1` já tem as cinco tabelas centrais e buckets de mídia. A versão atual do código usa colunas extras e a tabela `welcome_email_logs` que ainda não estão no banco. Antes do deploy, abra o SQL Editor do Supabase, revise e execute o arquivo `supabase/upgrade-existing-project.sql` desta branch. Ele faz somente alterações aditivas e atualiza a restrição de tipos de venda; não apaga tabelas nem registros existentes.

Não execute o schema completo de criação sobre o banco existente.

## 1. Render — API Node.js

1. Abra https://dashboard.render.com/ e crie uma conta/conecte o GitHub.
2. Selecione **New → Blueprint** e escolha este repositório.
3. O Render lerá o arquivo `render.yaml`. Escolha o plano **Free**.
4. No formulário de criação, informe:
   - `SUPABASE_URL`: Project URL do projeto Supabase.
   - `SUPABASE_ANON_KEY`: chave pública/anon do projeto.
   - `SUPABASE_SERVICE_ROLE_KEY`: chave secreta de servidor (service_role/secret). **Nunca** a coloque no GitHub, no frontend ou em mensagens.
5. `CREATOR_AUTH_SECRET` será gerada automaticamente pelo Render.
6. Aguarde o serviço `maison-prive-api` concluir o primeiro deploy e copie o endereço HTTPS `https://...`. Esse será o valor de `API_ORIGIN` no Cloudflare.

> O plano gratuito do Render pode suspender o serviço após 15 minutos sem tráfego; a primeira requisição depois disso pode levar cerca de um minuto. O disco do serviço é temporário. As mídias e dados devem ficar no Supabase Storage/Database.

## 2. Cloudflare Pages — frontend

1. Abra https://dash.cloudflare.com/ e entre em **Workers & Pages**.
2. Selecione **Create application → Pages → Connect to Git**.
3. Autorize a integração GitHub, se solicitado, e escolha `zoebratubrasil-dot/Zoe-Bratu`.
4. Configure:
   - Production branch: `main`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
5. Conclua o primeiro deploy.

## 3. Conectar Pages ao backend

No projeto Pages, abra **Settings → Variables and Secrets → Production** e adicione:

- Nome: `API_ORIGIN`
- Valor: a URL HTTPS do serviço Render, sem barra final, por exemplo `https://maison-prive-api.onrender.com`.

Salve e faça um novo deploy. A Function em `functions/api/[[catchall]].ts` encaminha chamadas `/api/*` ao servidor Render. O arquivo `public/_routes.json` limita a execução da Function às rotas da API.

## 4. Verificação

Depois dos dois deploys, abra:

- `https://SEU-PROJETO.pages.dev` — interface.
- `https://SEU-PROJETO.pages.dev/api/supabase/status` — estado de conexão do Supabase via API.

Confira no painel se o projeto Supabase já contém as tabelas e os buckets esperados. Não execute novamente um SQL de criação sem antes verificar as tabelas existentes.

## Segurança

- Mantenha a chave secreta `SUPABASE_SERVICE_ROLE_KEY` apenas nas variáveis privadas do Render.
- O repositório deve ser privado, pois contém o código-fonte do painel e a lógica da aplicação.
- Não faça commit de `.env`, `.env.local`, tokens ou chaves.
- O serviço gratuito é indicado para avaliação/protótipo; avalie um plano pago antes de depender dele para operação comercial contínua.
