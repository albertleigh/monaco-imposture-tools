'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

const fs = require('fs');
const path = require('path');
const {merge} = require('webpack-merge');
// const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");

const commonConfig = require('./webpack.common');
// const packageJson  = require('../package.json');

const wasmBinPath = path.resolve(
  __dirname,
  '..',
  'node_modules',
  'monaco-azure-logic-app-lang',
  'scanner',
  'scanner.wasm'
);
const grammarBasePath = path.resolve(__dirname, '..', 'node_modules', 'monaco-azure-logic-app-lang', 'grammar');

/**@type {import('webpack').Configuration}*/
const devConfig = {
  mode: 'development',
  devtool: 'cheap-module-source-map',
  output: {
    publicPath: 'http://localhost:3001/',
  },
  devServer: {
    port: 3001,
    historyApiFallback: {
      index: 'index.html',
    },
    proxy: {
      '/assets': {
        selfHandleResponse: true,
        bypass(req, resp) {
          if (req.url.indexOf('/assets/grammars') > -1) {
            const matchIndices = req.url.match(/assets\/grammars\/([-\w]+)\/([-\w\.]+)/);
            const _folderName = matchIndices[1];
            const fileName = matchIndices[2];
            resp.header('Content-Type', 'application/json');
            fs.createReadStream(path.join(grammarBasePath, fileName)).pipe(resp);
          } else {
            return false;
          }
        },
      },
    },
  },
  plugins: [],
};

module.exports = merge(commonConfig, devConfig);
