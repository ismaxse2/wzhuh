import type { UserData } from "../types";
import { migrate } from "./migrations";
import { emptyData } from "./model";
// Keep the original key so existing users are migrated in place. The payload is versioned.
export const STORAGE_KEY = "wzhuh:user:v1";
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface UserRepository {
  load(): UserData;
  save(data: UserData): void;
}
export class LocalUserRepository implements UserRepository {
  constructor(private adapter: StorageAdapter) {}
  load(): UserData {
    const raw = this.adapter.getItem(STORAGE_KEY);
    if (raw === null) return emptyData();
    const parsed: { version?: unknown } = JSON.parse(raw);
    const data = migrate(parsed);
    // Validate the whole payload before replacing legacy data; setItem is atomic.
    if (
      parsed.version !== 2 ||
      data.activeSession?.status !==
        (parsed as UserData).activeSession?.status ||
      data.sessions.some(
        (s, i) => s.outcome !== (parsed as UserData).sessions?.[i]?.outcome,
      ) ||
      data.activeSession?.tasks.length !==
        (parsed as UserData).activeSession?.tasks.length
    )
      this.save(data);
    return data;
  }
  save(data: UserData): void {
    this.adapter.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}
// Resolve browser storage lazily: denied access is handled by the application provider.
export const storageService: UserRepository = new LocalUserRepository({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
});
