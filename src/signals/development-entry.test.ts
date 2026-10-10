import { describe, expect, it } from 'vitest';
import { isSignalsApprovedPreview, isSignalsDevelopmentView } from './development-entry';

describe('explicit local fictional development entry', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])('allows only the requested development view on %s', (hostname) => {
    expect(isSignalsDevelopmentView(true, hostname, '?signalsDemo=fictional')).toBe(true);
    expect(isSignalsDevelopmentView(true, hostname, '')).toBe(false);
  });
  it('cannot enable a fictional view in a production build or on a remote host', () => {
    expect(isSignalsDevelopmentView(false, 'localhost', '?signalsDemo=fictional')).toBe(false);
    expect(isSignalsDevelopmentView(true, 'fixture.example.test', '?signalsDemo=fictional')).toBe(false);
    expect(isSignalsDevelopmentView(true, '127.0.0.1', '?signalsDemo=real')).toBe(false);
  });
});

describe('approved material local preview entry', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])('requires explicit local development selection on %s', (hostname) => {
    expect(isSignalsApprovedPreview(true, hostname, '?signalsDemo=approved')).toBe(true);
    expect(isSignalsApprovedPreview(true, hostname, '?signalsDemo=fictional')).toBe(false);
    expect(isSignalsDevelopmentView(true, hostname, '?signalsDemo=approved')).toBe(false);
    expect(isSignalsApprovedPreview(true, hostname, '')).toBe(false);
  });
  it('rejects production and remote host selection', () => {
    expect(isSignalsApprovedPreview(false, '127.0.0.1', '?signalsDemo=approved')).toBe(false);
    expect(isSignalsApprovedPreview(true, 'fixture.example.test', '?signalsDemo=approved')).toBe(false);
  });
});
