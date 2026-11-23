# Engineering rules

- Type webhook payloads and narrow caught errors without disabling strict checks, so compilation catches malformed assumptions.
- Keep edge functions self-contained when adding transport types, because external deployment does not upload shared subdirectories.

## Fluxo de entrega (branch → PR → CI → merge → production)

- Nada vai direto para a `main`: toda mudança nasce numa branch,
  vira PR (draft enquanto estiver em trabalho) e só mergeia com o CI
  verde — o check obrigatório é o `Vitest - PDV` (`pdv-tests.yml`).
- `.github/CODEOWNERS` marca o Renner (@rennervdprog) como dono de
  tudo: todo PR pede a revisão dele.
- A proteção da branch `main` (exigir PR antes do merge + exigir o
  status check `Vitest - PDV` verde) é ligada por ele em
  Settings → Branches no GitHub — não é configurável por código.
- Depois do merge na `main`, a ida para produção é outro PR:
  `main` → `production`. Testar no site ao vivo depois do merge em
  produção antes de dar o trabalho como pronto.
- Nunca mergear PR com CI vermelho, nem trabalho em andamento (WIP):
  cada merge na `main` dispara o build do APK no GitHub Actions.
