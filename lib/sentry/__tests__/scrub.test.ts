import { describe, expect, it } from 'vitest';
import { scrubSentryValue } from '../scrub';

describe('scrubSentryValue', () => {
  it('replaces circular references instead of recursing indefinitely', () => {
    const breadcrumb: Record<string, unknown> = { screen: 'Modal' };
    breadcrumb.parent = breadcrumb;

    expect(scrubSentryValue(breadcrumb)).toEqual({
      screen: 'Modal',
      parent: '[Circular]',
    });
  });
});
