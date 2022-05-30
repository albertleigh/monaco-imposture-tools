declare const require;

/**
 * Handle to onigasm module (the JS glue code emitted by emscripten, that provides access to C/C++ runtime)
 * Single handle shared among modules that decorate the C runtime to deliver `atom/node-oniguruma` API
 */
export let onigasmH;
const OnigasmModuleFactory = require('./OnigurumaAsm')

/**
 * ASM_IN_BASE64 would be replaced at compile time, do not change it
 */
const ASM_IN_BASE64 = '%%MAGIC_ASM_BASE64%%';

function base64ToArrayBuffer( base64Data: string ) {
  const isBrowser = typeof window !== 'undefined' && typeof window.atob === 'function';
  const binary = isBrowser? window.atob(base64Data): Buffer.from(base64Data, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i =0; i < binary.length;  ++i){
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function initModule() {
  return new Promise<void>((resolve, _reject) => {
    const {log, warn, error} = console;
    OnigasmModuleFactory({
      instantiateWasm(imports, successCallback){
        WebAssembly.instantiate(
          base64ToArrayBuffer(ASM_IN_BASE64),
          imports
        ).then((output)=>{
          successCallback(output.instance);
        }).catch((err)=>{
          _reject(err);
        });
        return {};
      }
    }).then((moduleH) => {
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
      `Oniguruma asm#init has been called and was successful, subsequent calls are not allowed once initialized`
    );
  }
  await initModule();
  isInitialized = true;
}
