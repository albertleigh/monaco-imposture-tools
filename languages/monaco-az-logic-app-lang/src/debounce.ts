export function debounce<T extends Function>(fn: T, ms: number): T {
  let timeout: number | NodeJS.Timeout;
  return function () {
    const self = this as any;
    const args = [].slice.call(arguments);
    clearTimeout(timeout as number);
    timeout = setTimeout(function () {
      fn.apply(self, args);
    }, ms);
  } as unknown as T;
}
