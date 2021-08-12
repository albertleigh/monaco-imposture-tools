const path = require('path');
const rimraf = require('rimraf');

function promisedRimraf(path){
    return new Promise((res)=>{
        rimraf(path, function (){
            res();
        })
    })
}

const BASE_DIR = path.resolve(__dirname, '..');

async function run(){
    await Promise.all([
        "./lib",
        "./grammar",
        "./scanner",
    ].map(file => promisedRimraf(path.resolve(BASE_DIR, file))));
}

run();