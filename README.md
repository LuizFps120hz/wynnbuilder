# Wynn Build Finder

Um protótipo estático de otimizador de equipamentos para Wynncraft. A pessoa define classe, nível, itens que quer fixar e como avaliar os atributos; o app procura combinações, valida skill points e mostra as melhores builds encontradas.

## Executar localmente

Abra `index.html` em um servidor estático local. Por exemplo:

```sh
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`. Não há etapa de build nem dependências de runtime.

Os testes do validador usam apenas Node.js:

```sh
npm test
```

## Publicar no GitHub Pages

Envie os arquivos deste diretório para um repositório e selecione **Settings → Pages → Deploy from a branch**, apontando para a branch e pasta que contém `index.html` (normalmente `/(root)`). O arquivo de dados fica em `data/items.json`.

## Como o otimizador trabalha

- Usa os dados públicos de itens/sets publicados pelo projeto [WynnBuilder](https://github.com/wynnbuilder/wynnbuilder.github.io), armazenados localmente em `data/items.json`.
- Para cada atributo priorizado, soma os valores dos itens e bônus de set. Os pesos são aplicados a valores normalizados pelo percentil 90 do catálogo para que percentuais, valores fixos e regeneração não fiquem em escalas incomparáveis.
- Há três modos de busca: **Manual** classifica builds somente pelos pesos definidos; **Assistido** mantém esses pesos e aplica limites mínimos escolhidos pelo usuário (Health Regen Raw começa em zero ou mais); **Inteligente** prioriza a soma dos atributos `hp` e `hpBonus`, usando os pesos definidos pelo usuário como critério secundário, e começa exigindo Mana Regen, Mana Steal e Health Regen Raw não negativos. Os limites são visíveis, podem ser alterados e são incluídos nos links compartilhados.
- O modo Inteligente otimiza a vida fornecida pelos equipamentos, não EHP real. O catálogo atual não contém vida base por classe nem a fórmula de mitigação necessária para calcular vida efetiva; por isso, o resultado não deve ser interpretado como uma estimativa de EHP.
- Faz uma busca heurística em candidatos de cada espaço. Para manter a resposta rápida, limita candidatos por espaço e mantém uma beam de combinações; portanto, o ranking é uma aproximação e não promete o ótimo matemático global.
- Antes de mostrar uma build, procura uma ordem para equipar as oito peças de armadura/acessórios e depois a arma. A verificação considera requisitos, bônus e penalidades de skill points, bônus de set e o limite de 100 pontos atribuídos por habilidade. Também limita o total de pontos pelo nível informado.
- Cada combinação mostra um resumo do equipamento e permite abrir os detalhes da build, incluindo atributos totais, bônus de conjuntos, requisitos, identificações, lore e estado de negociação (`Tradable`/`Not tradable`) das peças.
- Cada recomendação também tem o botão **Abrir no WynnBuilder**, que abre aquela combinação no builder público com classe inferida pela arma, nível e os oito espaços de equipamento preenchidos, incluindo os dois anéis.
- Esse link usa o hash binário oficial do WynnBuilder, implementado em [`build_encode_decode.js`](https://github.com/wynnbuilder/wynnbuilder.github.io/blob/master/js/builder/build_encode_decode.js): cabeçalho `C` (formato binário), IDs numéricos de equipamento, skill points automáticos e nível. Os nomes não são inseridos na URL; o alfabeto Base64 próprio do WynnBuilder inclui `+`, que deve permanecer literal no fragmento. O formato atual usado aqui é a versão de codificação 35 (WynnBuilder 2.2.5.0); se o formato ou os IDs do catálogo mudarem, atualize o gerador junto com os dados.
- O score prioriza identificações genéricas de itens. Ainda não soma IDs de dano elemental específico nem reproduz o cálculo de dano, spell cycle, árvore de habilidades, powders, tomes, aspectos ou efeitos de habilidade do WynnBuilder.
- **Compartilhar build** guarda classe, nível, prioridades e itens fixados no fragmento próprio do Finder. Os links do WynnBuilder são montados localmente e não enviam dados a um servidor do Finder.

### Atualizar o catálogo

O catálogo incluído é uma cópia do arquivo público `data/baseline/compressed/compress.json` do WynnBuilder. Para atualizá-lo, baixe novamente o arquivo para `data/items.json` e rode os testes. O esquema consumido pelo app é o formato comprimido do WynnBuilder.

## Créditos e licença

Os dados de itens e sets vêm do repositório público WynnBuilder e são incluídos de acordo com a licença GPL-3.0 indicada em [`LICENSE`](./LICENSE). Wynncraft e WynnBuilder não endossam este projeto; nomes e marcas pertencem aos respectivos titulares.
