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
  mode: 'production',
  devtool: 'source-map',
  output: {
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[id].js',
  },
  optimization:{
    minimize: false
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(
            __dirname,
            '..',
            'node_modules',
            'monaco-azure-logic-app-lang',
            'scanner',
            'scanner.wasm'
          ),
          to: path.resolve(__dirname, '..', 'dist', 'assets', 'scanner.wasm'),
        }
      ],
    }),
  ],
};

module.exports = merge(commonConfig, prodConfig);
