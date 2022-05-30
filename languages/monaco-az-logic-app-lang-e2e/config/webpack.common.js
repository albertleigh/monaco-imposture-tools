const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const paths = require('./paths');
const getClientEnvironment = require('./env');
const env = getClientEnvironment();
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

/**@type {import('webpack').Configuration}*/
module.exports = {
  entry: './src/index.ts',
  resolve: {
    extensions: paths.moduleFileExtensions,
    alias: {
      vscode: false,
      fs: false,
      path: false,
    },
  },
  performance: {
    maxAssetSize: 512000,
  },
  module: {
    rules: [
      // {
      //   test: /\.(png|jpe?g|gif|woff|svg|eot|ttf)$/i,
      //   use: [{loader: 'file-loader'}],
      // },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-typescript'],
            plugins: ['@babel/plugin-transform-runtime', '@babel/plugin-proposal-class-properties'],
          },
        },
      },
      {
        test: /\.wasm$/,
        type:
          "javascript/auto" /** this disables webpacks default handling of wasm */,
        use: [
          {
            loader: "file-loader",
            options: {
              name: "assets/wasm/[name].[hash].[ext]",
              publicPath: ""
            }
          }
        ]
      }
    ],
  },
  plugins: [
    new webpack.DefinePlugin(env.stringified),
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    new ESLintPlugin({
      // Plugin options
      extensions: ['js', 'mjs', 'jsx', 'ts', 'tsx'],
      eslintPath: require.resolve('eslint'),
      context: paths.appSrc,
      // ESLint class options
      cwd: paths.appPath,
      resolvePluginsRelativeTo: __dirname,
      baseConfig: {
        // extends: [require.resolve('eslint-config-react-app/base')],
      },
    }),
    new ForkTsCheckerWebpackPlugin(),
    new MonacoWebpackPlugin({
      languages: ['json', 'javascript', 'cpp'],
      features: [
        '!codelens',
        '!colorPicker',
        '!contextmenu',
        '!cursorUndo',
        '!find',
        'folding',
        '!quickCommand',
        '!quickHelp',
        '!quickOutline',
        '!referenceSearch',
      ],
      publicPath: '/',
    }),
  ],
};
