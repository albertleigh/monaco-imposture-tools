'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

const webpack = require('webpack');
const {merge} = require('webpack-merge');

const commonConfig = require('./webpack.common');

/**@type {import('webpack').Configuration}*/
const prodConfig = {
  mode: 'production',
  devtool: 'source-map',
  output: {
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[id].js',
  },
  optimization:{
    // todo fix it
    minimize: false,
    // chunkIds: "named"
  },
  plugins: [
    // new webpack.ids.DeterministicChunkIdsPlugin({
    //   maxLength: 5,
    // }),
  ],
};

module.exports = merge(commonConfig, prodConfig);
