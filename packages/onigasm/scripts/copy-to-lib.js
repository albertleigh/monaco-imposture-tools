const path = require("path")
const fse = require("fs-extra")
const shell = require("shelljs")

const {CMAKE_DEBUG_TARGET, CMAKE_RELEASE_TARGET, PROJECT_DIR, LIB_DIR} = require('./paths');

const IS_DEBUG = process.argv[2] === 'debug';
const TARGET_FOLDER = IS_DEBUG ? CMAKE_DEBUG_TARGET : CMAKE_RELEASE_TARGET;
const TARGET_PATH = path.resolve(PROJECT_DIR, TARGET_FOLDER);

const files=[
    'OnigurumaAsm.js',
    'OnigurumaAsm.wasm',
];


files.forEach(one=>{
    fse.copySync(path.join(TARGET_PATH, 'onigasm', one), path.join(LIB_DIR, one));
    shell.echo(`*** Copy ${IS_DEBUG?'DEBUG':'RELEASE'} file ${one} into libs`);
})

