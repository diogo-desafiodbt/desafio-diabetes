# Desafio Diabetes — Dashboard

App React com Supabase. Funis, metas, KPIs mensais e tarefas (`acoes`).

## E-mails (Resend + Edge Functions)

Notificação ao criar tarefa e digest diário (7h Brasília) via Supabase Edge Functions. Configuração passo a passo: **[docs/resend-email-setup.md](docs/resend-email-setup.md)**.

Código das funções: `supabase/functions/`.

## Variáveis de ambiente (frontend)

Copia `.env.example` para `.env` e preenche `REACT_APP_SUPABASE_URL` e `REACT_APP_SUPABASE_ANON_KEY`.

## Supabase CLI

```bash
supabase functions deploy notify-task-assigned
supabase functions deploy daily-task-digest
```
