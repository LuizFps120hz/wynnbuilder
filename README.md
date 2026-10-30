# Wynn Build Finder

Um protótipo estático de otimizador de equipamentos para Wynncraft. A pessoa define classe, nível, itens que quer fixar e pesos para atributos; o app procura combinações, valida skill points e mostra as melhores builds encontradas.

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
- Faz uma busca heurística em candidatos de cada espaço. Para manter a resposta rápida, limita candidatos por espaço e mantém uma beam de combinações; portanto, o ranking é uma aproximação e não promete o ótimo matemático global.
- Antes de mostrar uma build, procura uma ordem para equipar as oito peças de armadura/acessórios e depois a arma. A verificação considera requisitos, bônus e penalidades de skill points, bônus de set e o limite de 100 pontos atribuídos por habilidade. Também limita o total de pontos pelo nível informado.
- O score prioriza identificações genéricas de itens. Ainda não soma IDs de dano elemental específico nem reproduz o cálculo de dano, spell cycle, árvore de habilidades, powders, tomes, aspectos ou efeitos de habilidade do WynnBuilder.
- O link de compartilhamento guarda classe, nível, prioridades e itens fixados no fragmento da URL. Nenhum dado é enviado a um servidor pelo app.

### Atualizar o catálogo

O catálogo incluído é uma cópia do arquivo público `data/baseline/compressed/compress.json` do WynnBuilder. Para atualizá-lo, baixe novamente o arquivo para `data/items.json` e rode os testes. O esquema consumido pelo app é o formato comprimido do WynnBuilder.

## Créditos e licença

Os dados de itens e sets vêm do repositório público WynnBuilder e são incluídos de acordo com a licença GPL-3.0 indicada em [`LICENSE`](./LICENSE). Wynncraft e WynnBuilder não endossam este projeto; nomes e marcas pertencem aos respectivos titulares.
