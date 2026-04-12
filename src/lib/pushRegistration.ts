import { supabase } from "@/integrations/supabase/client";

interface RegisterPushDevicePayload {
  device_info?: string;
  fcm_token?: string;
  player_id?: string;
}

async function invokeRegisterPushDevice(payload: RegisterPushDevicePayload) {
  const { data: { session } } = await supabase.auth.getSession();

  const { data, error } = await supabase.functions.invoke("register-push-device", {
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : undefined,
    body: payload,
  });

  if (error) throw error;
  return data;
}

export async function claimFcmPushToken(token: string, deviceInfo?: string) {
  if (!token) return null;

  return invokeRegisterPushDevice({
    fcm_token: token,
    device_info: deviceInfo,
  });
}

export async function claimOneSignalPlayer(playerId: string, deviceInfo?: string) {
  if (!playerId) return null;

  return invokeRegisterPushDevice({
    player_id: playerId,
    device_info: deviceInfo,
  });
}
