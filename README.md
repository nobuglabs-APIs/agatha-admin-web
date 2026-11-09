# Ágata Admin

Console de operação da plataforma Nobug Labs para o **Ágata ERP**. É um frontend
**independente** do espaço de trabalho das empresas (`frontends/agatha-erp`),
com projeto, build, porta e sessão próprios.

Só entra quem tem uma conta com `is_platform_admin`. Qualquer outra conta
autenticada recebe o ecrã de acesso negado.

## Executar localmente

```bash
cp .env.example .env
npm install
npm run dev
```

O console abre em `http://localhost:3003`. Em desenvolvimento, o Vite encaminha
`/api` e `/media` para a API Agatha em `http://localhost:8080`.

Para apontar a uma API remota, defina `VITE_AGATHA_API_BASE_URL` (por exemplo
`https://api.exemplo.ao/api/v1`). Nesse caso, a origem do console tem de estar
em `CORS_ORIGINS` na API.

## O que faz

| Área | Ações |
|---|---|
| Visão geral | Totais exatos por estado e fila prioritária de onboarding |
| Fila de empresas | Filtro por estado, filtro nesta página, paginação |
| Processo | Perfil da empresa, progresso documental e ações de estado |
| Documentos | Abrir o ficheiro, validar, pedir correção com nota |
| Requisitos | Marcar documentos obrigatórios e deixar notas à empresa |
| Subscrição | Planos, ciclo, datas e registo do pagamento confirmado |
| Histórico | Linha temporal das mudanças de estado |

Ações disponíveis por estado: iniciar revisão (`submitted`), aprovar, solicitar
correções ou rejeitar (`under_review`), suspender (`approved`) e reativar
(`suspended`). A ativação de subscrição exige empresa aprovada e plano escolhido.

## Contrato com a API

Apenas endpoints `/platform/*` e a autenticação:

- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- `GET /platform/companies`, `GET /platform/companies/{id}`
- `POST /platform/companies/{id}/start-review|approve|reject|suspend|reinstate|request-correction`
- `PATCH /platform/documents/{id}/review`
- `GET|PUT /platform/companies/{id}/document-requirements`
- `POST /platform/companies/{id}/subscription/activate`

## Scripts

```bash
npm run dev      # servidor de desenvolvimento na porta 3003
npm run lint     # tsc --noEmit
npm run build    # typecheck + build de produção
```

## Limites atuais

- Não cria empresas nem substitui o registo público de onboarding.
- Não gere planos nem preços; isso continua no catálogo da API.
- A confirmação de pagamento é registada manualmente pela equipa; o checkout
  simulado continua no ERP para desenvolvimento.
