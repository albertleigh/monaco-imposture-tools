const os = require("os")
const fs = require("fs")
const path = require("path")
const fse = require("fs-extra")
const shell = require("shelljs")

if (!shell.which('git')) {
  shell.echo('Sorry, this script requires git');
  shell.exit(1);
}
const VERSION = process.argv[2] || 'latest'
const ROOT_DIR = process.cwd();
const EMSDK_DIR = path.resolve(ROOT_DIR, 'emsdk');
const CURRENT_DIR = __dirname;

if (fs.existsSync(EMSDK_DIR)){
  shell.echo(`*** Updating emscripten-core/emsdk.git at ${EMSDK_DIR}`);
  shell.pushd(EMSDK_DIR);
  shell.exec(`git pull`);
}else{
  shell.echo(`*** Cloning emscripten-core/emsdk.git to  ${EMSDK_DIR}`);
  shell.pushd(ROOT_DIR);
  shell.exec(`git clone https://github.com/emscripten-core/emsdk.git`);
}
shell.popd();

shell.echo(`*** Using emsdk version: ${VERSION}`);

shell.pushd(ROOT_DIR);
const curPlatform = os.platform();
if(curPlatform=== "win32"){
  shell.exec(`${path.join("emsdk", "emsdk.bat")} install ${VERSION}`)
  shell.exec(`${path.join("emsdk", "emsdk.bat")} activate ${VERSION}`)
}else if (
  curPlatform === "darwin" ||
  curPlatform === "linux"
){
  shell.exec(`${path.join("emsdk", "emsdk")} install ${VERSION}`)
  shell.exec(`${path.join("emsdk", "emsdk")} activate ${VERSION}`)
}
shell.popd();


shell.exit(0);
