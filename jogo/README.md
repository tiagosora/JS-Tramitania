# Código-fonte de Tramitânia

O jogo edita-se no **Twine**. Os ficheiros desta pasta servem para correr os testes automáticos sobre a versão do Twine.

## 1. Importar para o Twine (uma vez)
1. No Twine: **Library → Import** e escolhe `Tramitania.html` (na pasta acima desta).
2. A história «Tramitânia» aparece na biblioteca, já com o formato SugarCube 2.37.3.

Onde está cada coisa no Twine:
- **Texto das passagens:** no mapa da história. As cores das etiquetas mostram a zona do jogo: amarelo é o percurso principal, azul os serviços, laranja as pessoas, verde as pausas, vermelho os desfechos e roxo as passagens de sistema.
- **Setas no mapa:** o Twine só desenha setas para ligações escritas entre parênteses retos duplos, como `<<link [[Texto|Destino]]>>`. Quando o destino depende do código (por exemplo `<<goto $voltar>>`), a passagem termina com um comentário `/* … [[Destino]] */`, que o jogo ignora e o Twine usa para desenhar a seta. Se acrescentarem um `<<goto>>`, acrescentem também o destino a esse comentário.
- **Jogar ou testar:** o botão **Play** mostra o jogo como os jogadores o veem. O botão **Test** liga o modo de depuração do SugarCube, que mostra os nomes das macros (`<<if>>`, `<<link>>`) por cima do texto; serve para procurar erros, não para jogar.
- **Regras, documentos e números:** Story → Details → **JavaScript**. Os documentos estão em `S.DOCS`, os locais em `S.PLACES` e o equilíbrio (prazos, stress, preços) em `S.CFG`.
- **Aspeto visual:** Story → Details → **Stylesheet**.

## 2. Depois de editar no Twine: correr os testes
Com o Twine aberto ou fechado (o Twine grava sozinho), num terminal aberto em qualquer pasta:

```bash
python3 ~/Documents/Universidade/MDJD/JS/jogo/build.py extrair
```

```bash
node ~/Documents/Universidade/MDJD/JS/jogo/test_bot.js 300
```

O primeiro comando lê a história da biblioteca do Twine (`~/Documents/Twine/Stories`) e atualiza `passagens.twee`, `story.js` e `story.css`. O segundo joga centenas de partidas simuladas e avisa se o jogo deixou de se poder ganhar, ou se gerir o stress deixou de fazer diferença.

## 3. Entregar
No Twine: **Build → Publish to File**. É esse ficheiro que se entrega.

## Ficheiros
| Ficheiro | O que tem |
|---|---|
| `passagens.twee`, `story.js`, `story.css` | Cópia do jogo, atualizada com `extrair`. |
| `test_bot.js` | Testes do motor e simulação de partidas. |
| `build.py` | `extrair` lê do Twine; sem argumentos, monta um `Tramitania.html` a partir destes ficheiros. |
| `vendor/` | O formato SugarCube 2.37.3, tirado do Twine instalado. |

Depois de importarem, editem só no Twine. Se correrem `python3 build.py` sem `extrair`, o `Tramitania.html` é reconstruído a partir dos ficheiros desta pasta e não inclui o que mudaram no Twine.
