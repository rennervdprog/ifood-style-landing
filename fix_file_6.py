import os

content = """-- Habilitar RLS em tabelas principais
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public profiles are viewable by everyone') THEN 
        CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true); 
    END IF; 
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile') THEN 
        CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id); 
    END IF; 
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read products') THEN 
        CREATE POLICY "Anyone can read products" ON products FOR SELECT USING (true); 
    END IF; 
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can read own orders') THEN 
        CREATE POLICY "Clients can read own orders" ON orders FOR SELECT USING (auth.uid() = client_id); 
    END IF; 
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can manage their stores') THEN 
        CREATE POLICY "Owners can manage their stores" ON stores FOR ALL USING (auth.uid() = owner_id); 
    END IF; 
END $$;
"""

with open('public/migracao_parte_6.sql', 'w', encoding='utf-8') as f:
    f.write(content)
