# Histórico — mw-ha-humidifier-level-card

## 2026-08-07 — nascimento (v0.1.0)

Pedido do dono com o print de um `tile` + feature `select-options`: «crie um
MW Humidifier Level Card para exibir esse dropdown com o padrão papel, bastando
apenas apontar nele o umidificador e selecionar a entidade que configura o
nível. Reutilize os conhecimentos anteriores para otimizar o trabalho.»

Decisões:

- **Uma linha, não um quadrado.** O card do umidificador é quadrado porque
  divide altura com a grade de botões; este aqui é uma faixa de controle e
  vive bem embaixo dele. Por isso a tipografia é em px: uma linha de 48 px não
  precisa de tipografia proporcional, ao contrário do tile quadrado.
- **`<select>` nativo.** O menu que abre é o do sistema — o mesmo que o dono
  já conhece no celular — e vem com teclado e leitor de tela de graça. Só a
  aparência fechada é nossa (`appearance:none` + seta própria). Escrever um
  menu do zero custaria acessibilidade e um portal para não ser recortado.
- **Rótulo e ícone pelo FIM do `entity_id`**, como nos irmãos, e em CAIXA ALTA
  — é como a família desenha texto de controle, e é o que sai sem uma linha de
  configuração. `_spraying_level` → NÍVEL 💧, `_countdown` → TIMER ⏱.
- **`option_labels`**: `LEVEL 1` é o que o aparelho manda; o que se lê é
  escolha do dono, e o valor enviado ao HA continua o original.
- **Desligado ≠ travado.** Com a opção em `cancel` o card fica escuro, mas o
  seletor continua utilizável — é por ele que se liga de novo. Só «sem
  resposta» desabilita.
- **`getGridOptions`**: no modo `sections` o card já nasce ocupando a linha
  inteira, que é o `grid_options: columns: full` que o dono escrevia à mão.

Reaproveitado dos irmãos, sem repetir o custo de descobrir:

- `line-height` **sem unidade** — o frontend do HA define um valor absoluto no
  `body` e ele herda para dentro do shadow DOM;
- `:host{display:block}` — elemento custom nasce inline;
- DOM montado uma vez, `set hass` em O(1) por comparação de referência;
- bancada herdando `line-height: 32px` de propósito: bancada que não herda o
  que o HA herda nunca vê o bug de layout;
- probe com as entidades **reais** da casa.

Uma armadilha nova, essa do próprio componente: **a lista de `<option>` não
pode ser reconstruída a cada `hass`** — o HA empurra o objeto inteiro a cada
mudança de qualquer entidade da casa, e recriar os filhos fecharia o menu
nativo no dedo do usuário. A lista só é refeita quando as opções (ou os
rótulos) mudam de fato; o valor é sincronizado à parte. Virou verificação.

Verificado: `node --check` + probe (43 verificações) verdes; bancada visual em
cinco cenas. **Conferência na tela do HA é do dono.**
