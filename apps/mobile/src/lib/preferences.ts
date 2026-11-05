import { deleteSecure, readSecureJson, writeSecureJson } from './secure-storage';

const KEY = 'neara.preferences.v1';

type Preferences = {
  activeTenantId?: string;
};

export async function readActiveTenantId() {
  const preferences = await readSecureJson<Preferences>(KEY);
  return preferences?.activeTenantId ?? null;
}

export async function writeActiveTenantId(tenantId: string) {
  await writeSecureJson(KEY, { activeTenantId: tenantId });
}

export async function clearPreferences() {
  await deleteSecure(KEY);
}
