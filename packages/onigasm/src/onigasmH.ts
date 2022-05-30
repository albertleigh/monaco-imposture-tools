declare const require;

/**
 * Handle to onigasm module (the JS glue code emitted by emscripten, that provides access to C/C++ runtime)
 * Single handle shared among modules that decorate the C runtime to deliver `atom/node-oniguruma` API
 */
export let onigasmH;
const OnigasmModuleFactory = require('./OnigurumaAsm')

async function initModule() {
  return new Promise<void>((resolve, _reject) => {
    const {log, warn, error} = console;
    OnigasmModuleFactory().then((moduleH) => {
      onigasmH = moduleH;
      resolve();
    });
    if (typeof print !== 'undefined') {
      // can be removed when https://github.com/emscripten-core/emscripten/issues/9829 is fixed.
      // tslint:disable-next-line:no-console
      console.log = log;
      // tslint:disable-next-line:no-console
      console.error = error;
      // tslint:disable-next-line:no-console
      console.warn = warn;
    }
  });
}

let isInitialized = false;

/**
 * Mount the .wasm file that will act as library's "backend"
 */
export async function initOnigasm() {
  if (isInitialized) {
    throw new Error(
      `Oniguruma asm#init has been called and was succesful, subsequent calls are not allowed once initialized`
    );
  }
  await initModule();
  isInitialized = true;
}
