-- Habilitar RLS em tabelas principais
DO 577 BEGIN ALTER TABLE profiles ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END 577;
DO 577 BEGIN ALTER TABLE stores ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END 577;
DO 577 BEGIN ALTER TABLE products ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END 577;
DO 577 BEGIN ALTER TABLE orders ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END 577;
DO 577 BEGIN ALTER TABLE order_items ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END 577;

-- Políticas de Segurança
DO 577 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public profiles are viewable by everyone') THEN 
        CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true); 
    END IF; 
END 577;

DO 577 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile') THEN 
        CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id); 
    END IF; 
END 577;

DO 577 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read products') THEN 
        CREATE POLICY "Anyone can read products" ON products FOR SELECT USING (true); 
    END IF; 
END 577;

DO 577 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can read own orders') THEN 
        CREATE POLICY "Clients can read own orders" ON orders FOR SELECT USING (client_id = auth.uid()); 
    END IF; 
END 577;