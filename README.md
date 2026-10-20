# Garbage Kingdom

Jogo incremental 2D top-down de coleta, reciclagem e automação: remova **1.000.000** de unidades de lixo de um terreno gigantesco.
Toda a arte, animação, música e efeitos sonoros são **gerados por código** (Canvas 2D + WebAudio), sem assets externos.

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # typecheck + build de produção (dist/)
npm test         # testes da simulação (mundo, coleta, economia, máquinas, save)
npm run sim -- 240 1   # bot de balanceamento: joga sozinho por 240 min (seed 1)
```

**Controles** — WASD/setas andar · segurar mouse/ESPAÇO coletar · E interagir · roda zoom · B construir · U melhorias · T ferramentas · I depósito · M mapa · R girar esteira · Esc fechar.
No celular: joystick dinâmico à esquerda, botões COLETAR/INTERAGIR, pinça para zoom.

## Arquitetura (`src/`)
- `world/` — geração determinística (regiões, estradas, ruínas, descobertas) e dados reais do lixo por tile (`Uint8Array`, soma exata de 1.000.000).
- `game/` — simulação sem DOM: jogador, coleta, economia, máquinas/esteiras/robôs/escavadeira (rodam fora da tela), descobertas, save versionado e progresso offline.
- `render/` — sprites procedurais em atlas, chunks em cache (só o visível é desenhado), personagem e máquinas vetoriais animados, partículas em pool.
- `ui/` — HUD, árvore de melhorias, menus, entrada teclado/mouse/toque.
- `audio/` — efeitos sintetizados e música generativa.
