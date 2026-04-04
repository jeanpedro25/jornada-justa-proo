# Project Memory

## Core
Hora Justa - app registro ponto CLT brasileiro. Primary #1a1a2e, accent #4ECDC4. Inter font. Mobile-first 375px.
Supabase backend: profiles, registros_ponto, alertas. RLS on all tables.
Linguagem direta de trabalhador, não corporativa.
Soft delete only (deleted_at). Timestamps UTC, display local.
Semana começa na segunda (Seg→Dom). Nunca Dom→Sáb.
Trabalhado do mês = APENAS registros reais (excluir importacao_automatica).

## Memories
- [Color tokens](mem://design/colors) — Full palette: primary #1a1a2e, accent #4ECDC4, success #27AE60, danger #E74C3C, warning #F39C12
- [App structure](mem://features/structure) — Routes: /auth, /onboarding, /app, /historico, /relatorio, /configuracoes
- [Alert logic](mem://features/alertas) — gerarAlertas() after clock-out: sem_intervalo, intervalo_curto, jornada_excessiva, hora_extra
- [Week order](mem://preferences/week-order) — Brazilian standard Seg→Dom, never Dom→Sáb
