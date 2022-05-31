const path = require("path");
const process = require("process");
const fs = require("fs");
const fse = require("fs-extra");
const shell = require("shelljs");

const {CMAKE_DEBUG_TARGET, CMAKE_RELEASE_TARGET, PROJECT_DIR, LIB_DIR} = require('./paths');

const IS_DEBUG = process.argv[2] === 'debug';
const TARGET_FOLDER = IS_DEBUG ? CMAKE_DEBUG_TARGET : CMAKE_RELEASE_TARGET;
const TARGET_PATH = path.resolve(PROJECT_DIR, TARGET_FOLDER);

const files=[
    'OnigurumaAsm.js',
    // 'OnigurumaAsm.wasm',
];


files.forEach(one=>{
    fse.copySync(path.join(TARGET_PATH, 'onigasm', one), path.join(LIB_DIR, one));
    shell.echo(`*** Copy ${IS_DEBUG?'DEBUG':'RELEASE'} file ${one} into libs`);
})

// manually replace %%MAGIC_ASM_BASE64%%
const onigurumaAsmHPath = path.join(process.cwd(), 'lib', 'onigasmH.js');

const onigurumaAsmBuffer = fs.readFileSync(path.join(TARGET_PATH, 'onigasm', 'OnigurumaAsm.wasm'));
const onigurumaAsmBase64 = onigurumaAsmBuffer.toString('base64');

let onigurumaAsmHContent = fs.readFileSync(onigurumaAsmHPath, {encoding: 'utf8'});

onigurumaAsmHContent = onigurumaAsmHContent.replace("%%MAGIC_ASM_BASE64%%", onigurumaAsmBase64);

fs.writeFileSync(onigurumaAsmHPath, onigurumaAsmHContent, {encoding: 'utf8'});


