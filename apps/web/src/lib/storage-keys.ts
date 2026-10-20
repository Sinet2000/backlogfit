export const STORAGE_KEYS = {
  theme: 'bf:theme',
  mode: 'bf:mode',
  name: 'bf:name',
  lastConfig: 'bf:last-config',
  resume: (roomId: string) => `bf:resume:${roomId}`,
  identity: (roomId: string) => `bf:who:${roomId}`,
  admin: (roomId: string) => `bf:admin:${roomId}`,
  preparedTasks: (roomId: string) => `bf:prepared:${roomId}`,
} as const;

export const LEGACY_THEME_KEYS = { theme: 'bf-theme', mode: 'bf-mode' } as const;
