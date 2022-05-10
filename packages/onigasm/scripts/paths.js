const path = require("path")

const ROOT_DIR = process.cwd();
const PROJECT_DIR = path.resolve(process.cwd(), '..', '..');
const LIB_DIR = path.resolve(ROOT_DIR, 'lib');

const CMAKE_DEBUG_TARGET = 'cmake-build-em-debug';
const CMAKE_RELEASE_TARGET = 'cmake-build-em-release';

module.exports= {
  ROOT_DIR,
  PROJECT_DIR,
  LIB_DIR,
  CMAKE_DEBUG_TARGET,
  CMAKE_RELEASE_TARGET
}
