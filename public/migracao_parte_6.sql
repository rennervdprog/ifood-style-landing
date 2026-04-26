-- Habilitar RLS em tabelas principais
DO $$
DO $$
DO $$

-- Políticas de Segurança
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public profiles are viewable by everyone') THEN
        CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read products') THEN
        CREATE POLICY "Anyone can read products" ON products FOR SELECT USING (true);
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can read own orders') THEN
        CREATE POLICY "Clients can read own orders" ON orders FOR SELECT USING (client_id = auth.uid());
END $$;