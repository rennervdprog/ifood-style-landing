ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DO 1029 BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public profiles are viewable by everyone') THEN CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true); END IF; END 1029;

DO 1029 BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile') THEN CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id); END IF; END 1029;