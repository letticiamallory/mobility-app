# Handoff: rotas Sozinho / Acompanhado, partição por score e detalhe do trajeto

Documento para o próximo agente (ex.: Claude Opus) **consertar de ponta a ponta** o fluxo de busca de rotas, as duas abas e a tela de detalhe. Ajuste o que estiver desatualizado após inspecionar o código.

---

## Restrições de implementação (obrigatório)

- **Não alterar aparência nem estrutura de tela**: proibido mexer em **CSS** (web), **StyleSheet**, cores, espaçamentos, tipografia, ordem visual de componentes, ou qualquer coisa que **mude o layout**.
- O escopo permitido é **somente lógica**: serviços, API, utils, parsing de dados, merges, pontuação, testes, tipos — sem “polimento visual” nem refatoração de UI.
- Se for inevitável tocar em um arquivo que mistura UI + lógica, extrair ou alterar **apenas** o trecho de lógica necessário, sem redesenhar o JSX nem estilos.

---

## Paralelismo e serviços combinados (pontuação)

- É **desejável e esperado** usar **paralelismo**: várias chamadas **ao mesmo tempo** (ex.: `Promise.all` / `Promise.allSettled`, enriquecimento concorrente por trecho ou por fonte), desde que respeitados timeouts e orçamento de tempo do `checkRoute`.
- **Não** adotar postura “ou um serviço ou outro” (substituir OTP por Google, ou desligar fonte A em favor só da B). O desenho correto é **combinar fontes** para que os dados **se acumulem** e alimentem uma **única tomada de decisão** de pontuação / acessibilidade (fusion, `accessibility_report`, flags por trecho, etc.).
- No **app**, o padrão de **várias** `searchRoutes` em paralelo com `transport_type` distintos já **agrega** alternativas no cliente — manter essa ideia de **acúmulo** e dedupe inteligente, não de “uma busca só”.
- No **mobility-api**, reforçar onde já existe fusão (Gemini, Overpass, ORS, OTP, Google, etc.): cada fonte deve **contribuir** sinais; a pontuação final da rota deve **refletir** evidências agregadas, não um único provedor isolado.

---

## Objetivo de produto (requisitos explícitos)

1. **Quantidade mínima**  
   - **Sozinho**: no mínimo **3 rotas** quando o motor de busca tiver alternativas suficientes.  
   - **Acompanhado**: no mínimo **3 rotas** nas mesmas condições.  
   - Se não houver itinerários suficientes no mundo real, documentar o fallback (mensagem UX) em vez de prometer 3 fantasmas.

2. **Faixas de pontuação (`accessibility_score`, 0–100)**  
   - **Sozinho**: rotas **mais acessíveis**, com score **70–100** (inclusive). Ordenar por score decrescente; desempate por duração menor, conforme política atual.  
   - **Acompanhado**: score **40–69** (inclusive). Mesma ideia de ordenação.  
   - **Atenção**: hoje o backend usa outras faixas (ver seção “Estado atual”); é **mudança de regra** alinhar a 70–100 / 40–69 e revisar o fallback quando nenhuma rota cai nas faixas (ex.: tudo &lt; 40 ou gaps entre 70 e 40).

3. **Aba Acompanhado e “Atenção”**  
   - Sempre que a rota tiver **trechos irregulares** (ex.: superfície/obstáculos, trechos não marcados como acessíveis, alertas de inclinação, bloqueadores relevantes no `accessibility_report`, etc.), garantir **copy de atenção** visível (badge / `warning` / texto equivalente), alinhado ao que o app já usa em `route-results` e ao que a API preenche em `routes.service.ts` (`baseRoutesCompanied`).  
   - Não tratar “Acompanhado” como segunda lista genérica: o usuário espera **avisos claros** onde o trajeto exige cuidado.

4. **Tela `route-detail` (detalhe do trajeto)**  
   - Garantir que abrir um card a partir de **route-results** (e fluxos relacionados, ex.: **route-plan**, params na URL) **funcione**: mapa, polilinha, estágios, horários, imagens de trecho quando existirem.  
   - Verificar parsing de params (`decodeURIComponent`, coordenadas string vs objeto, fallback se `routeList` truncar ou serialização JSON falhar).  
   - Casos de teste manuais sugeridos: OD longo (ex.: Shopping Parque da Cidade → Shopping Ibirapuera, SP), rota só ônibus, rota com metrô + caminhada.

---

## Estado atual do código (para diff mental)

### mobility-api

| Tópico | Onde olhar | Observação |
|--------|------------|------------|
| Partição por score | `src/routes/utils/route-scoring.util.ts` → `partitionRoutesByScore` | Hoje: **Sozinho 80–100**, **Acompanhado 60–79**, abaixo de 60 só entra no fallback que preenche só `companied`. **Não** bate com 70–100 / 40–69 pedidos acima. |
| Constantes / top-K | `ROUTES_ALONE_MAX`, `ROUTES_COMPANIED_MAX` (default **3** cada), `ROUTES_ALONE_MIN_SCORE` | `partitionRoutesByScore` recebe `options` com `aloneMax`/`companiedMax` mas o comentário diz que **não são usados** na regra por faixa — confirmar se o **slice** top-3 está aplicado em outro lugar ou se às vezes voltam mais de 3 rotas. |
| Duplicar rota nas duas abas | `routes.service.ts` → `ensureNonEmptyTabs` | Quando uma aba ficaria vazia, **promove** a mesma alternativa para a outra aba (mesmo `route_id` / mesmo score). Isso colide com dedupe no app se a assinatura não diferenciar aba. |
| Aviso “atenção” em acompanhado | `baseRoutesCompanied` em `routes.service.ts` | Já existe lógica (`hasHigh`, `messy`, `hazard`) que seta `warning` com texto de obstáculos — revisar se cobre **trechos irregulares** como o produto descreve e se score 40–69 sempre merece algum nível de alerta visual. |

### Mobility (app)

| Tópico | Onde olhar | Observação |
|--------|------------|------------|
| Merge de várias buscas | `services/fetch-diverse-routes.ts` | Várias chamadas `searchRoutes` (bus / subway / combined / walk), `dedupeBySignature`, **`makeDisjoint`** remove acompanhado com mesma assinatura que sozinho. |
| Assinatura de rota | `utils/route-results-logic.ts` → `routeSignature` | Deve incluir `search_profile` (`sp:alone` / `sp:companied`) quando a API envia, para **não** apagar a aba Acompanhado quando o backend duplica a mesma viagem nas duas listas. Confirmar se está **commitado**. |
| Resultados / abas | `app/route-results.tsx` | Filtros, loading inicial, epoch de fetch — evitar corrida com token/`userId` nulos após splash. |
| Splash / auth | `app/splash.tsx` | Bypass Letticia / `DEV_FORCE_LOGOUT` alteram **quem** é o `user_id` nas chamadas; não é a causa do `makeDisjoint`, mas muda respostas da API. |
| Detalhe | `app/route-detail.tsx` | Params longos, JSON da rota, coordenadas — foco em **robustez** e testes manuais. |

---

## Problemas conhecidos (checklist para o agente corrigir)

1. **Faixas de score**  
   - [ ] Alinhar partição do backend a **70–100 (Sozinho)** e **40–69 (Acompanhado)**.  
   - [ ] Atualizar constantes env (`ROUTES_ALONE_MIN_SCORE`, eventual `ROUTES_COMPANIED_MAX_SCORE` / faixa máxima), testes (`route-scoring.util.spec.ts`, e2e se houver) e `docs/ACCESSIBILITY_POLICY.md` no **mobility-api**.  
   - [ ] Definir comportamento para scores **&lt; 40** e para **gap 69–70** (não entra em nenhuma aba vs fallback).

2. **Mínimo 3 + 3 rotas**  
   - [ ] Garantir que o pipeline OTP/Google (ou fallback) **peça e mantém** alternativas suficientes **antes** do slice.  
   - [ ] Aplicar **top-3** (ou valor de env) **explicitamente** em `alone` e `companied` após ordenação, se ainda não estiver centralizado.  
   - [ ] Não depender só de `ensureNonEmptyTabs` para “inventar” segunda aba — priorizar rotas **reais** em cada faixa.

3. **Atenção em Acompanhado (trechos irregulares)**  
   - [ ] Revisar critérios no backend (blockers, `accessible` por trecho, slope, geometria walk).  
   - [ ] Garantir que o app mostre badge/“Atenção” em `route-results` e que `warning` chegue no detalhe.

4. **Cliente: abas não sumirem após merge**  
   - [ ] Manter `search_profile` na `routeSignature` + testes em `fetch-diverse-routes.test.ts`.  
   - [ ] Revalidar `makeDisjoint` após mudança de faixas de score (assinaturas podem divergir mais entre abas).

5. **`route-detail` estável**  
   - [ ] Abrir de cada aba (Sozinho e Acompanhado) com rota real.  
   - [ ] Corrigir regressões de params, mapa vazio, “rota inválida”, lista de estágios.

6. **Outros**  
   - [ ] Investigar **HTTP 500** em `transport_type: walk` em alguns OD (logs no Nest).  
   - [ ] Opcional: script de smoke `scripts/od-smoke-parque-ibirapuera.ts` (se existir) para contar `routes_alone` / `routes_companied` brutos vs pós-merge.

7. **Paralelismo e fusão (sem trocar layout)**  
   - [ ] Preservar ou ampliar chamadas **paralelas** onde fizer sentido (cliente e API), com **acúmulo** de dados para scoring — ver seção **“Paralelismo e serviços combinados”**.  
   - [ ] Evitar simplificações do tipo “usar só uma fonte”; priorizar **serviços combinados** na decisão de pontuação.  
   - [ ] Confirmar que nenhuma alteração viola **“Restrições de implementação”** (sem CSS / layout).

---

## Arquivos principais sugeridos (mobility-api)

- `src/routes/utils/route-scoring.util.ts`  
- `src/routes/routes.service.ts` (`checkRoute`, `ensureNonEmptyTabs`, particionamento)  
- `docs/ACCESSIBILITY_POLICY.md`  
- Testes em `src/routes/utils/route-scoring.util.spec.ts`, `test/routes-check-accessibility.e2e-spec.ts` (se aplicável)

## Arquivos principais sugeridos (Mobility)

- `utils/route-results-logic.ts`  
- `services/fetch-diverse-routes.ts`  
- `app/route-results.tsx`  
- `app/route-detail.tsx`  
- `app/splash.tsx` (apenas se houver corrida auth × primeira busca)

---

## Critério de “pronto”

- Para um OD com alternativas suficientes (ex.: SP intra-municipal denso): **≥ 3 rotas em Sozinho** (70–100) e **≥ 3 em Acompanhado** (40–69), com **atenção** visível onde houver trechos irregulares na lista acompanhado.  
- **route-detail** abre e exibe o trajeto corretamente nos cenários de teste manuais.  
- Testes automatizados relevantes passando; documentação de faixas atualizada.  
- **Sem mudanças de layout/CSS**; pontuação e enriquecimento favorecem **paralelismo** e **fusão de fontes**, não um único serviço isolado.

---

*Gerado como handoff de produto + engenharia; ajuste números e paths se o repositório divergir.*
