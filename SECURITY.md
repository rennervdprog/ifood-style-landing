# Security checklist

Se este repositório continha um arquivo `.env` com chaves/segredos, siga este checklist IMEDIATAMENTE:

1. Rotacione todas as chaves potencialmente expostas
   - Supabase
   - Firebase
   - Sentry
   - Qualquer outra API key/secret

2. Atualize as variáveis de ambiente no provedor de hospedagem
   - Vercel / Netlify / GitHub Actions Secrets

3. Se precisar limpar o histórico (opcional, destrutivo)
   - Use `git-filter-repo` ou BFG para remover os arquivos do histórico
   - Aviso: isso reescreve o histórico. Todos colaboradores devem clonar novamente.

   Exemplo com git-filter-repo:

   ```bash
   # instalar: pip install git-filter-repo
   git clone --mirror git@github.com:rennervdprog/ifood-style-landing.git
   cd ifood-style-landing.git
   git filter-repo --invert-paths --paths .env project_source.zip
   git push --force
   ```

4. Verifique o histórico com um scanner de segredos
   - truffleHog, detect-secrets, git-secrets

5. Remova o arquivo do repositório atual e adicione ao .gitignore (feito neste commit)

Se quiser, eu posso executar a limpeza do histórico por você — confirme explicitamente se quer que eu proceda.
