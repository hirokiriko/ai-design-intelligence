import { describe, expect, it } from 'vitest';
import { parsePublicAppConfig, readPublicAppConfig } from './PublicAppConfig';

describe('public app config', () => {
  it('defaults only a missing mode to standard', () => {
    expect(parsePublicAppConfig(undefined)).toEqual({
      ok: true,
      config: { mode: 'standard' },
    });
    expect(readPublicAppConfig({})).toEqual({
      ok: true,
      config: { mode: 'standard' },
    });
  });

  it.each(['standard', 'trial'] as const)('accepts the exact public mode %s', (mode) => {
    expect(parsePublicAppConfig(mode)).toEqual({ ok: true, config: { mode } });
  });

  it.each(['', ' trial', 'trial ', 'TRIAL', 'preview', null, 1])(
    'fails closed without echoing an invalid value: %j',
    (value) => {
      const result = parsePublicAppConfig(value);

      expect(result).toEqual({
        ok: false,
        code: 'invalid_app_mode',
        message: '公開アプリの動作モードを確認できませんでした。管理者にお問い合わせください。',
      });
      if (typeof value === 'string' && value.length > 0) {
        expect(JSON.stringify(result)).not.toContain(value);
      }
    },
  );
});
