import os
import re

def rewrite_file(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Corrigir DO $$ faltando BEGIN e adicionar IF/END IF se necessário
    # Vamos usar uma abordagem de substituição por blocos
    
    # Substituir blocos sem BEGIN (comuns na parte 1)
    content = re.sub(r'DO \$\$\n\s+IF', 'DO $$ BEGIN\n    IF', content)
    # Se já tiver DO $$ e IF na mesma linha (improvável mas possível)
    content = re.sub(r'DO \$\$\s+IF', 'DO $$ BEGIN IF', content)
    
    # Garante que todo DO $$ termina com END $$;
    # Mas como o arquivo tem vários, vamos garantir que cada um tenha BEGIN/END
    
    # 2. Corrigir o fechamento
    # Se houver END IF; mas o próximo for END $$; e não tiver o BEGIN, o parser falha.
    # Mas o script anterior já garantiu BEGIN se tiver IF.
    
    # Vamos verificar se existem blocos DO $$ sem BEGIN
    lines = content.split('\n')
    fixed_lines = []
    in_block = False
    for line in lines:
        stripped = line.strip()
        if stripped == 'DO $$':
            fixed_lines.append('DO $$ BEGIN')
            in_block = True
        elif stripped == 'END $$;':
            fixed_lines.append('END $$;')
            in_block = False
        else:
            fixed_lines.append(line)
            
    content = '\n'.join(fixed_lines)
    
    # 3. Limpeza de duplicatas BEGIN BEGIN
    content = content.replace('DO $$ BEGIN BEGIN', 'DO $$ BEGIN')
    content = content.replace('DO $$ BEGIN\nBEGIN', 'DO $$ BEGIN')
    
    # 4. Remover linhas DO $$ sozinhas que não fazem nada (vimos na parte 6)
    content = re.sub(r'DO \$\$ BEGIN\n\n', '', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

for i in range(1, 7):
    rewrite_file(f'public/migracao_parte_{i}.sql')
