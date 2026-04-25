import re

def add_if_not_exists(sql):
    # Tables
    sql = re.sub(r'CREATE TABLE (public\.[a-zA-Z0-9_]+)', r'CREATE TABLE IF NOT EXISTS \1', sql)
    # Types (Enums) - Postgres doesn't have IF NOT EXISTS for CREATE TYPE directly in a simple way 
    # but we can wrap it in a DO block if needed. For now let's focus on tables and indices.
    sql = re.sub(r'CREATE INDEX ([a-zA-Z0-9_]+) ON (public\.[a-zA-Z0-9_]+)', r'CREATE INDEX IF NOT EXISTS \1 ON \2', sql)
    # Constraints are harder to do "IF NOT EXISTS" in pure SQL without PL/pgSQL
    return sql

with open('full_migration.sql', 'r') as f:
    content = f.read()

formatted = add_if_not_exists(content)

with open('migration_copy_paste.txt', 'w') as f:
    f.write(formatted)
