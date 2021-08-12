const os = require("os")
const fs = require("fs")
const path = require("path")
// const fse = require("fs-extra")
const shell = require("shelljs")

const {ROOT_DIR, EMSDK_DIR, CMAKE_DEBUG_TARGET, CMAKE_RELEASE_TARGET, CMAKE_TOOLCHAIN_FILE_PATH} = require('./paths')

if (!shell.which('git')) {
  shell.echo('Sorry, this script requires git');
  shell.exit(1);
}

if (!shell.which('cmake')) {
  shell.echo('Sorry, this script requires cmake');
  shell.exit(1);
}

const isDebug = process.argv[2] === 'Debug';
const BUILD_TYPE = isDebug? 'Debug' : 'Release';
const TARGET_FOLDER = isDebug? CMAKE_DEBUG_TARGET : CMAKE_RELEASE_TARGET;
const TARGET_PATH = path.resolve(ROOT_DIR, TARGET_FOLDER);

if (!fs.existsSync(TARGET_PATH)){
  fs.mkdirSync(TARGET_PATH);
}

const curPlatform = os.platform();
shell.echo(`*** Building oniguruma-asm on ${curPlatform}`);

shell.pushd(TARGET_PATH);
if(curPlatform=== "win32"){
  if (!shell.which('nmake')) {
    shell.echo('Sorry, this script requires nmake upon win32 platform');
    shell.exit(1);
  }

  shell.exec(`cmake.exe -DCMAKE_BUILD_TYPE=${BUILD_TYPE} -DCMAKE_TOOLCHAIN_FILE=${path.resolve(EMSDK_DIR, ...CMAKE_TOOLCHAIN_FILE_PATH)} -DCMAKE_DEPENDS_USE_COMPILER=FALSE -G "CodeBlocks - NMake Makefiles" ${ROOT_DIR}`);

  shell.exec(`cmake.exe --build ${TARGET_PATH} --target OnigurumaAsm`);

}else if (
  curPlatform === "darwin" ||
  curPlatform === "linux"
){

  shell.exec(`cmake -DCMAKE_BUILD_TYPE=${BUILD_TYPE} -DCMAKE_TOOLCHAIN_FILE=${path.resolve(EMSDK_DIR, ...CMAKE_TOOLCHAIN_FILE_PATH)} -DCMAKE_DEPENDS_USE_COMPILER=FALSE -G "CodeBlocks - Unix Makefiles" ${ROOT_DIR}`);

  shell.exec(`cmake --build ${TARGET_PATH} --target OnigurumaAsm -- -j 6`)

}else{
  shell.echo(`*** Cannot build oniguruma-asm on ${curPlatform}`);
  shell.exit(1);
}
shell.popd();

shell.exit(0);