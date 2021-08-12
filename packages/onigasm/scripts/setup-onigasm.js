const os = require("os")
const fs = require("fs")
const path = require("path")
const fse = require("fs-extra")
const shell = require("shelljs")

if (!shell.which('git')) {
  shell.echo('Sorry, this script requires git');
  shell.exit(1);
}

const GIT_HASH = process.argv[2] || ''
const ROOT_DIR = process.cwd();
const EMSDK_DIR = path.resolve(ROOT_DIR, 'emsdk');
const ONIGURUMA_DIR = path.resolve(ROOT_DIR, 'oniguruma');
const CURRENT_DIR = __dirname;
const ONIGURUMA_GIT = "https://github.com/kkos/oniguruma";

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
}
shell.popd();

shell.echo(`*** Using oniguruma version: ${GIT_HASH? GIT_HASH : 'latest'}`);

// start to build oniguruma
shell.pushd(ONIGURUMA_DIR);
const curPlatform = os.platform();
shell.echo(`*** Building oniguruma on ${curPlatform}`);
if(curPlatform=== "win32"){
  shell.exec(path.resolve(EMSDK_DIR, "emsdk_env.bat"));
  shell.exec(path.resolve(ONIGURUMA_DIR, "make_win.bat"));
  // todo config & make
}else if (
  curPlatform === "darwin" ||
  curPlatform === "linux"
){
  shell.exec(path.resolve(EMSDK_DIR, "emsdk_env.sh"));
  if (!fs.existsSync(path.resolve(ONIGURUMA_DIR, 'configure'))){
    shell.echo(`*** Running autoreconf -vfi`);
    shell.exec("autoreconf -vfi");
  }
  if (!fs.existsSync(path.resolve(ONIGURUMA_DIR, 'configure'))){
    shell.echo(`*** Running emconfigure ./configure`);
    shell.exec("emconfigure ./configure --enable-posix-api=no");
    shell.exec("autoreconf -vfi");
  }
  shell.exec("make clean");
  shell.exec("emmake make");
}
shell.popd();

shell.exit(0);
