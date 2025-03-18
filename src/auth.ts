import { join } from "path";
import { mkdir, writeFile, readFile } from "fs/promises";

const CONFIG_DIR = join(
  process.env.HOME || process.env.USERPROFILE!,
  ".config",
  "tempo-cli"
);
const TOKEN_PATH = join(CONFIG_DIR, "token");

export async function getApiKey(): Promise<string | null> {
  try {
    await mkdir(CONFIG_DIR, { recursive: true, mode: 0x1c0 }); // 0o700 in octal
    const token = await readFile(TOKEN_PATH, { encoding: "utf-8" });
    return token.trim();
  } catch (error) {
    return null;
  }
}

export async function setApiKey(key: string): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0x1c0 });
  await writeFile(TOKEN_PATH, key, {
    encoding: "utf-8",
    mode: 0x180, // 0o600 in octal
  });
}
