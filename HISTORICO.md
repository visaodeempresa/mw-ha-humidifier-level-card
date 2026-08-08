# Histórico — mw-ha-humidifier-level-card

## 2026-08-08 — cor por nível (v0.2.0)

Pedido do dono, com o print da linha `NÍVEL · LEVEL 3` em papel creme: «que o
card apresente uma cor diferente conforme o nível selecionado; crie cores
predefinidas e opção de configurar outras cores também».

Decisões:

- **A rampa é amostrada pela POSIÇÃO da opção, não pelo nome dela.** Nenhuma
  tabela de `LEVEL 1/2/3`: o primeiro nível pega a ponta clara, o último a
  ponta forte, e o meio se distribui. Funciona igual para 3 níveis de névoa e
  para um countdown de 9 horas, e sobrevive a um firmware que renomeie tudo.
- **As opções de desligado saem da conta da rampa.** No countdown, `cancel`
  mora no fim da lista: contá-la faria «3 Hours» cair no meio da rampa e a
  ponta forte ficar num estado que nem colorido é.
- **Rampa colorida NÃO sai da paleta de papel.** Papel encardido é de
  saturação baixa de propósito (descansa a vista num card ligado o dia todo);
  três tons dele lado a lado ficam indistinguíveis — que é exatamente o
  contrário do que uma cor por nível serve para fazer. Verificado na bancada
  antes de trocar: a primeira versão, feita com chaves da paleta, era um
  sussurro. As rampas novas são cartolinas — saturação média, nunca néon —
  e o relevo de papel continua desenhado por cima. Quem quiser o sussurro tem
  `nevoa` e `encardido`, esses sim na paleta.
- **`level_colors` vence o esquema**, opção por opção, e aceita chave da
  paleta, hex, `rgb()`, nome de cor do CSS ou um gradiente inteiro. Cor
  nomeada do CSS não dá para escurecer nem medir: passa crua — por isso
  `parseColor` agora devolve `null` em vez de um cinza inventado.
- **Contraste automático com saída de emergência.** Cor escura ⇒ texto e
  ícone em creme e o relevo invertido (o realce interno branco vira mancha
  num fundo escuro). Mas se o dono escreveu `color_on_name`, a palavra dele
  vence: automatismo não sobrescreve escolha.
- **Cor apontada para a opção de desligado é pedido, não acidente**: o card
  pinta, mas o `mode` continua `off` — quem lê o estado não é enganado.
- **Editor:** uma linha por opção da entidade (paleta · cor livre · «do
  esquema»), mostrando de onde vem a cor que está valendo. O painel só é
  redesenhado quando a lista muda de fato — o HA empurra `hass` a cada
  mudança de qualquer entidade da casa, e redesenhar roubaria o foco do
  seletor aberto no editor. É a mesma lição do `<select>` do card, agora do
  lado de cá.

Verificado: `node --check`, probe com 66 verificações (23 novas) e
`check-embeds.sh` verdes; bancada visual em duas cenas novas. **Conferência
na tela do HA é do dono.**

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
