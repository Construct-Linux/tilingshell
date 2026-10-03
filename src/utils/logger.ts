export function rect_to_string(rect: {
    x: number;
    y: number;
    width: number;
    height: number;
}) {
    return `{x: ${rect.x}, y: ${rect.y}, width: ${rect.width}, height: ${rect.height}}`;
}

// flip to trace the extension in the journal; off, every logger is a no-op
const DEBUG = false;

const noop = (..._content: unknown[]): void => {};

export const logger = (prefix: string) =>
    DEBUG
        ? (...content: unknown[]): void =>
              console.log('[tilingshell]', `[${prefix}]`, ...content)
        : noop;
