const path = require("path")

const ROOT_DIR = process.cwd();
const EMSDK_DIR = path.resolve(ROOT_DIR, 'emsdk');
const ONIGURUMA_DIR = path.resolve(ROOT_DIR, 'oniguruma');
const LIB_DIR = path.resolve(ROOT_DIR, 'lib');
const ONIGURUMA_GIT = "https://github.com/kkos/oniguruma";

const CMAKE_DEBUG_TARGET = 'cmake-build-debug';
const CMAKE_RELEASE_TARGET = 'cmake-build-release';

const CMAKE_TOOLCHAIN_FILE_PATH = ["upstream", "emscripten", "cmake", "Modules", "Platform", "Emscripten.cmake"];

module.exports= {
  ROOT_DIR,
  EMSDK_DIR,
  ONIGURUMA_DIR,
  LIB_DIR,
  ONIGURUMA_GIT,
  CMAKE_DEBUG_TARGET,
  CMAKE_RELEASE_TARGET,
  CMAKE_TOOLCHAIN_FILE_PATH
}
