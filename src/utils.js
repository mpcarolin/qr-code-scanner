const SHOULD_LOG = false;

/**
 * Logs if SHOULD_LOG is true
 * @param  {...any} args
 */
export const log = (...args) => SHOULD_LOG && console.log(...args);
