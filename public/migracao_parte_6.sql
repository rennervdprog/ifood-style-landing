-- Habilitar RLS em tabelas principais
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (Removido blocos DO $$ para compatibilidade máxima)
-- Se a política já existir, o SQL apenas dará um aviso ou erro que você pode ignorar.

CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read products" ON products FOR SELECT USING (true);
CREATE POLICY "Clients can read own orders" ON orders FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Owners can manage their stores" ON stores FOR ALL USING (auth.uid() = owner_id);
