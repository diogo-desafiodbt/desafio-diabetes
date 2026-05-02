# E-mails com Resend (Supabase Edge Functions)

A chave **Resend não deve** ir em variáveis `REACT_APP_*` (expõe no browser). Usa **secrets das Edge Functions** no projeto Supabase.

## Secrets (Dashboard → Project Settings → Edge Functions → Secrets)

| Secret | Descrição |
|--------|-----------|
| `RESEND_API_KEY` | API key Resend (`re_...`) |
| `RESEND_FROM` | Remetente verificado, ex.: `Desafio Diabetes <noreply@seudominio.com>` |
| `WEBHOOK_SECRET` | String aleatória longa; mesmo valor no header do Database Webhook |
| `CRON_SECRET` | String aleatória longa; mesmo valor no `Authorization: Bearer ...` do pg_cron |

As funções já recebem `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` automaticamente no ambiente hosted.

## Funções

| Função | Ficheiro | Função |
|--------|----------|--------|
| `notify-task-assigned` | `supabase/functions/notify-task-assigned/` | INSERT em `acoes` → e-mail ao responsável |
| `daily-task-digest` | `supabase/functions/daily-task-digest/` | Lista tarefas pendentes com prazo **hoje** (America/Sao_Paulo) |

Deploy (CLI):

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy notify-task-assigned
supabase functions deploy daily-task-digest
```

## 1. Webhook em `INSERT` em `public.acoes`

1. Dashboard → **Database** → **Webhooks** → New webhook.
2. **Table**: `acoes`, **Events**: Insert, **Type**: Supabase Edge Functions **ou** HTTP Request para a URL:
   `https://SEU_PROJECT_REF.supabase.co/functions/v1/notify-task-assigned`
3. **HTTP Headers** (obrigatório):
   - `x-webhook-secret`: o mesmo valor que definiste em `WEBHOOK_SECRET`.
4. Em **Edge Functions**, garante `verify_jwt = false` para esta função (já está em `supabase/config.toml`).

A função ignora linhas sem mapeamento de e-mail para `responsavel` (Diogo, Turí, Pedro).

## 2. Cron diário (7h Brasília = 10:00 UTC)

Brasil (fuso padrão) está em **UTC−3** sem horário de verão; **07:00** em `America/Sao_Paulo` corresponde a **10:00 UTC**.

1. Ativa as extensões **pg_cron** e **pg_net** (Database → Extensions), se ainda não estiverem ativas.
2. Copia o SQL de `supabase/snippets/pg_cron_daily_task_digest.sql`, substitui `YOUR_PROJECT_REF` e `YOUR_CRON_SECRET` (igual ao secret `CRON_SECRET`), e executa no **SQL Editor**.

Para testar a digest manualmente:

```bash
curl -i -X POST "https://SEU_PROJECT_REF.supabase.co/functions/v1/daily-task-digest" \
  -H "Authorization: Bearer SEU_CRON_SECRET" \
  -H "Content-Type: application/json"
```

## Responsáveis → e-mails

Definidos em `supabase/functions/_shared/responsaveis.ts`:

- Diogo → `diogo@desafiodiabetes.com`
- Turí / Turi → `turionline@gmail.com`
- Pedro → `suporte@desafiodiabetes.com`

## Digest: critério de “hoje”

- `prazo` é comparado como **data** `YYYY-MM-DD` extraída do valor guardado.
- “Hoje” é calculado em **America/Sao_Paulo** na Edge Function.

## Resend

- Verifica domínio/remetente na consola Resend.
- Em caso de erro, a resposta da função inclui mensagem da API Resend (ver **Edge Functions → Logs**).
