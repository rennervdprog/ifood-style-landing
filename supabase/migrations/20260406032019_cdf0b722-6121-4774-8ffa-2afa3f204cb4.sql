
CREATE TABLE public.onesignal_players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  player_id text NOT NULL,
  device_info text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, player_id)
);

ALTER TABLE public.onesignal_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own players" ON public.onesignal_players
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own players" ON public.onesignal_players
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update own players" ON public.onesignal_players
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own players" ON public.onesignal_players
  FOR DELETE TO authenticated USING (user_id = auth.uid());
