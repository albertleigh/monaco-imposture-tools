'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const {merge} = require('webpack-merge');
// const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");

const commonConfig = require('./webpack.common');
// const packageJson  = require('../package.json');

const prodConfig = {
  mode:'production',
  output:{
    filename:'[name].[contenthash:8].js'
  },
  plugins:[
    new CopyPlugin({
      patterns:[
        {
          from: path.resolve(__dirname, "..", "node_modules", "@monaco-imposture-tools", "oniguruma-asm", "lib", "OnigurumaAsm.wasm"),
          to: path.resolve(__dirname, "..", 'dist', 'assets', "OnigurumaAsm.wasm")
        },
        {
          from: path.resolve(__dirname, "..", "node_modules", "@monaco-imposture-tools", "grammars", "cpp"),
          to: path.resolve(__dirname, "..", 'dist', 'assets', "grammars", "cpp")
        },
      ]
    })
  ]
}

module.exports = merge(commonConfig, prodConfig);
