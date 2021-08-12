const os = require("os")
const fs = require("fs")
const path = require("path")
// const fse = require("fs-extra")
const shell = require("shelljs")

const {ROOT_DIR, EMSDK_DIR, ONIGURUMA_DIR, ONIGURUMA_GIT, CMAKE_RELEASE_TARGET, CMAKE_TOOLCHAIN_FILE_PATH} = require('./paths')

if (!shell.which('git')) {
  shell.echo('Sorry, this script requires git');
  shell.exit(1);
}

if (!shell.which('cmake')) {
  shell.echo('Sorry, this script requires cmake');
  shell.exit(1);
}


const GIT_HASH = process.argv[2] || ''
// const CURRENT_DIR = __dirname;
const TARGET_FOLDER = CMAKE_RELEASE_TARGET;

if (fs.existsSync(ONIGURUMA_DIR)){
  shell.echo(`*** Updating kkos/oniguruma.git at ${ONIGURUMA_DIR}`);
  shell.pushd(ONIGURUMA_DIR);
  if (GIT_HASH){
    // check out to a version
    shell.exec(`git reset --hard ${GIT_HASH}`)
  }else{
    // update to latest only
    shell.exec(`git pull`);
  }
}else{
  shell.echo(`*** Cloning kkos/oniguruma.git at ${ONIGURUMA_DIR}`);
  shell.pushd(ROOT_DIR);
  shell.exec(`git clone ${ONIGURUMA_GIT}`);
  if (GIT_HASH){
    // check out to a version
    shell.pushd(ONIGURUMA_DIR);
    shell.exec(`git reset --hard ${GIT_HASH}`)
    shell.popd();
  }
}
shell.popd();

shell.echo(`*** Using oniguruma version: ${GIT_HASH? GIT_HASH : 'latest'}`);

// start to build oniguruma
const ONIGURUMUA_TARGET_PATH = path.resolve(ONIGURUMA_DIR, TARGET_FOLDER);
if (!fs.existsSync(ONIGURUMUA_TARGET_PATH)){
  fs.mkdirSync(ONIGURUMUA_TARGET_PATH);
}
shell.pushd(ONIGURUMUA_TARGET_PATH);

const curPlatform = os.platform();
shell.echo(`*** Building oniguruma on ${curPlatform}`);
if(curPlatform=== "win32"){
  if (!shell.which('nmake')) {
    shell.echo('Sorry, this script requires nmake upon win32 platform');
    shell.exit(1);
  }
  // built it
  // cmake.exe -DCMAKE_BUILD_TYPE=Release -DCMAKE_TOOLCHAIN_FILE=D:/Workspaces/WebAsmWs/monaco-tm/packages/onigasm/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake -DCMAKE_DEPENDS_USE_COMPILER=FALSE -G "CodeBlocks - NMake Makefiles" D:\Workspaces\WebAsmWs\monaco-tm\packages\onigasm\oniguruma
  // cmake.exe
  //    -DCMAKE_BUILD_TYPE=Release
  //    -DCMAKE_TOOLCHAIN_FILE=D:/Workspaces/WebAsmWs/monaco-tm/packages/onigasm/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake
  //    -DCMAKE_DEPENDS_USE_COMPILER=FALSE
  //    -G "CodeBlocks - NMake Makefiles"
  //    D:\Workspaces\WebAsmWs\monaco-tm\packages\onigasm\oniguruma
  shell.exec(`cmake.exe -DCMAKE_BUILD_TYPE=Release -DCMAKE_TOOLCHAIN_FILE=${path.resolve(EMSDK_DIR, ...CMAKE_TOOLCHAIN_FILE_PATH)} -DCMAKE_DEPENDS_USE_COMPILER=FALSE -G "CodeBlocks - NMake Makefiles" ${ONIGURUMA_DIR}`);

  // cmake.exe --build D:\Workspaces\WebAsmWs\monaco-tm\packages\onigasm\oniguruma\cmake-build-release --target onig
  // cmake.exe
  //  --build D:\Workspaces\WebAsmWs\monaco-tm\packages\onigasm\oniguruma\cmake-build-release
  //  --target onig
  shell.exec(`cmake.exe --build ${ONIGURUMUA_TARGET_PATH} --target onig`);

}else if (
  curPlatform === "darwin" ||
  curPlatform === "linux"
){
  // cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_DEPENDS_USE_COMPILER=FALSE -G "CodeBlocks - Unix Makefiles" /home/ali/Workspaces/CppWs/oniguruma
  shell.exec(`cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_TOOLCHAIN_FILE=${path.resolve(EMSDK_DIR, ...CMAKE_TOOLCHAIN_FILE_PATH)} -DCMAKE_DEPENDS_USE_COMPILER=FALSE -G "CodeBlocks - Unix Makefiles" ${ONIGURUMA_DIR}`)

  // cmake --build /home/ali/Workspaces/CppWs/oniguruma/cmake-build-release --target onig -- -j 6
  shell.exec(`cmake --build ${ONIGURUMUA_TARGET_PATH} --target onig -- -j 6`)

  // if (!fs.existsSync(path.resolve(ONIGURUMA_DIR, 'configure'))){
  //   shell.echo(`*** Running autoreconf -vfi`);
  //   shell.exec("autoreconf -vfi");
  // }
  // if (!fs.existsSync(path.resolve(ONIGURUMA_DIR, 'configure'))){
  //   shell.echo(`*** Running emconfigure ./configure`);
  //   shell.exec("emconfigure ./configure --enable-posix-api=no");
  //   shell.exec("autoreconf -vfi");
  // }
  // shell.exec("make clean");
  // shell.exec("emmake make");
}else{
  shell.echo(`*** Cannot build oniguruma on ${curPlatform}`);
  shell.exit(1);
}
shell.popd();

shell.exit(0);
