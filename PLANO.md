# Plano — mw-ha-humidifier-level-card

Uma linha de papel com o seletor do umidificador (nível de névoa, countdown,
modo, velocidade). Feito na fábrica de cards MW: arquivo único, sem build,
editor `<ha-form>`, HACS tipo Dashboard.

**Componente separado** (ADR 0002). Compartilha só a paleta de papel, que é
dado — e as *lições* dos irmãos, que vieram como código copiado à mão.

## Entrega 1 — v0.1.0

- [x] Uma linha: ícone · rótulo · seletor, no papel/neumórfico da família.
- [x] Quatro estados: ativo, desligado (`cancel`/`off`), sem resposta e
      entidade inexistente (que cai em «sem resposta», nunca em erro).
- [x] Rótulo e ícone deduzidos do **fim** do `entity_id` (NÍVEL, TIMER,
      VELOCIDADE, MODO, LED) — YAML mínimo é só a entidade.
- [x] `option_labels` para renomear as opções sem mexer no valor enviado.
- [x] `<select>` nativo: menu do sistema, teclado e leitor de tela de graça.
- [x] Lista de opções só é recriada quando as opções mudam — senão o menu
      nativo fecharia no dedo do usuário a cada `hass`.
- [x] `getGridOptions`: no modo `sections` já nasce ocupando a linha inteira.
- [x] Editor: dispositivo → entidade (cascata), aparência, rótulos das opções
      e a seção de cores com alfa.
- [x] As três lições da família embutidas e verificadas: `line-height` sem
      unidade, `:host{display:block}` e DOM montado uma vez.
- [x] Probe headless (43 verificações) com as entidades reais da casa.
- [x] Bancada em `tools/preview.html`, herdando `line-height: 32px` de propósito.
- [x] README com 6 exemplos e imagens.

## Entrega 2 — publicação

- [x] Repositório público, release v0.1.0 por tag assinada, HACS.

## Entrega 3 — DevOps (aguardando o ok do dono depois do teste na tela)

- [ ] `IA/tools/mw-devops.sh apply mw-ha-humidifier-level-card`.

## Próximas (só com pedido do dono)

- [ ] Modo «segmentado»: as opções como botões lado a lado em vez de dropdown
      (bom para 3 níveis, ruim para o countdown de 9 opções).
- [ ] Várias linhas num card só (nível + countdown), se a parede pedir.
- [ ] Ícone por opção (gota pequena/média/grande conforme o nível).

## Regras deste repositório

- Versão no banner `console.info` não se mexe à mão depois que o DevOps entrar.
- `memoria-ia/` é ignorada pelo git.
- Mexeu no bloco `paper-palette v1`? Rodar `IA/tools/check-embeds.sh`.
- Nenhum `line-height` em px. O probe falha se aparecer.
