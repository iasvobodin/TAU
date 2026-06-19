import { filesystem } from '@neutralinojs/lib'

export type AuthMode = 'device' | 'login'

export interface AuthConfig {
  mode: AuthMode
}

function getConfigPath(): string {
  return `${window.NL_PATH}/.tmp/authConfig.json`
}

export async function loadAuthConfig(): Promise<AuthConfig> {
  try {
    const content = await filesystem.readFile(getConfigPath())
    return JSON.parse(content) as AuthConfig
  } catch {
    return { mode: 'device' }
  }
}

export async function saveAuthConfig(config: AuthConfig): Promise<void> {
  await filesystem.writeFile(getConfigPath(), JSON.stringify(config, null, 2))
}
