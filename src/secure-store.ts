import keytar from 'keytar';

const SERVICE_NAME = 'tempo-tracker';

export async function storeToken(key: string, token: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, key, token);
}

export async function getTokens(key: string): Promise<string | null> {
  return keytar.getPassword(SERVICE_NAME, key);
}

export async function deleteToken(key: string): Promise<boolean> {
  return keytar.deletePassword(SERVICE_NAME, key);
}