import os
import re

def final_fix(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Substituir qualquer DO seguido de um numero por DO $$
    # Usando uma abordagem de substituição de string direta onde for possível
    lines = content.split('\n')
    new_lines = []
    for line in lines:
        s = line.strip()
        if s.startswith('DO ') and any(c.isdigit() for c in s):
            new_lines.append('DO $$')
        elif s.startswith('END ') and any(c.isdigit() for c in s):
            new_lines.append('END $$;')
        else:
            new_lines.append(line)
    
    content = '\n'.join(new_lines)
    # Limpeza extra
    content = re.sub(r'DO \$\$\nDO \$\$', 'DO $$', content)
    content = re.sub(r'END \$\$;\nEND \$\$;', 'END $$;', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

for i in range(1, 7):
    final_fix(f'public/migracao_parte_{i}.sql')
