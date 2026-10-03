// flip to trace the extension in the journal; off, every logger is a no-op
const DEBUG = false;

const noop = (..._content: unknown[]): void => {};

export const logger = (prefix: string) =>
    DEBUG
        ? (...content: unknown[]): void =>
              console.log('[tilingshell]', `[${prefix}]`, ...content)
        : noop;
