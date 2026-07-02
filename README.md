# MOOUI Collab Hub

Plataforma interna de gestao operacional da MOOUI — moda com operacao no Brasil e Barcelona.

17 modulos integrados: Dashboard, Projetos, Mensagens, Docs, Salas, Equipe, Calendario, Producao, Checagens, Pedidos, Tickets, Melhorias, Conteudo, Sessoes, Produto, Configuracoes e Command Palette.

## Stack

- React 18 + TypeScript + Vite
- Supabase (PostgreSQL + RLS + Auth + Storage + Realtime)
- shadcn/ui + Tailwind CSS
- TanStack React Query
- Hospedado via Lovable

## Publicacao

- Frontend/app: publicar pelo Lovable a partir da branch Git atual. Mudancas locais so aparecem no Lovable depois de `commit` + `push`.
- Banco: migrations aplicadas no Supabase; para pacotes manuais, usar o SQL Editor.
- Edge Functions: publicar no Supabase separadamente. Lovable nao faz deploy das functions.
- Ambiente publicado: `https://mooui-collab-hub.lovable.app`.
- Pendencias nao bloqueantes pos-publicacao: smoke manual completo, restringir `ALLOWED_ORIGIN` para a URL final e configurar Resend/Email quando a operacao quiser envio automatico.

## Rodar localmente

```bash
npm install
npm run dev
```

## Status detalhado

Ver [STATUS.md](STATUS.md)
