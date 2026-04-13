
-- Table to enforce single-device login
CREATE TABLE public.user_active_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  device_id text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_active_devices ENABLE ROW LEVEL SECURITY;

-- Users can read their own device record
CREATE POLICY "Users can read own device"
  ON public.user_active_devices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RPC to register device and kick others
CREATE OR REPLACE FUNCTION public.register_device_login(_device_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _old_device text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get current device if any
  SELECT device_id INTO _old_device
  FROM public.user_active_devices
  WHERE user_id = _user_id;

  -- Upsert the new device
  INSERT INTO public.user_active_devices (user_id, device_id, last_seen_at)
  VALUES (_user_id, _device_id, now())
  ON CONFLICT (user_id) DO UPDATE SET
    device_id = EXCLUDED.device_id,
    last_seen_at = now();

  RETURN jsonb_build_object(
    'registered', true,
    'previous_device', _old_device
  );
END;
$$;

-- RPC to check if current device is still active
CREATE OR REPLACE FUNCTION public.check_device_active(_device_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_active_devices
    WHERE user_id = auth.uid()
      AND device_id = _device_id
  );
$$;

-- Enable realtime so we can listen for changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_active_devices;
