import * as path from 'path';

export const ROOT_DIR = process.cwd();
export const OPT_DIR = path.resolve(process.cwd(), 'opt');
export const EMSDK_DIR = path.resolve(OPT_DIR, 'emsdk');
export const ONIGURUMA_DIR = path.resolve(ROOT_DIR, 'opt', 'oniguruma');
export const ONIG_ASM_LIB_DIR = path.resolve(ROOT_DIR, 'packages', 'onigasm', 'lib');
export const ONIGURUMA_GIT = "https://github.com/kkos/oniguruma";

export const CMAKE_DEBUG_TARGET = 'cmake-build-em-debug';
export const CMAKE_RELEASE_TARGET = 'cmake-build-em-release';

export const CMAKE_TOOLCHAIN_FILE_PATH = ["upstream", "emscripten", "cmake", "Modules", "Platform", "Emscripten.cmake"];
