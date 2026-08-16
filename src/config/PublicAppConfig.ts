export type PublicAppMode = 'standard' | 'trial';

export interface PublicAppConfig {
  mode: PublicAppMode;
}

export type PublicAppConfigErrorCode = 'invalid_app_mode';

export type PublicAppConfigResult =
  | { ok: true; config: PublicAppConfig }
  | { ok: false; code: PublicAppConfigErrorCode; message: string };

export interface PublicAppEnvironment {
  readonly VITE_APP_MODE?: unknown;
}

const STANDARD_CONFIG: PublicAppConfig = Object.freeze({ mode: 'standard' });
const TRIAL_CONFIG: PublicAppConfig = Object.freeze({ mode: 'trial' });

export function parsePublicAppConfig(value: unknown): PublicAppConfigResult {
  if (value === undefined) return { ok: true, config: STANDARD_CONFIG };
  if (value === 'standard') return { ok: true, config: STANDARD_CONFIG };
  if (value === 'trial') return { ok: true, config: TRIAL_CONFIG };

  return {
    ok: false,
    code: 'invalid_app_mode',
    message: '公開アプリの動作モードを確認できませんでした。管理者にお問い合わせください。',
  };
}

export function readPublicAppConfig(
  environment: PublicAppEnvironment = import.meta.env,
): PublicAppConfigResult {
  return parsePublicAppConfig(environment.VITE_APP_MODE);
}
