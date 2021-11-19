const rewireReactHotLoader = require("react-app-rewire-hot-loader");
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = function override(config, env) {
  pathWasmFileLoader(config);
  patchMonacoWebpackPlugin(config);
  rewireReactHotLoader(config, env);
  return config;
};

function pathWasmFileLoader(config){

  const wasmExtensionRegExp = /\.wasm$/;

  config.resolve.extensions.push('.wasm');

  config.module.rules.forEach(rule => {
    (rule.oneOf || []).forEach(oneOf => {
      if (oneOf.loader && oneOf.loader.indexOf('file-loader') >= 0) {
        // make file-loader ignore WASM files
        oneOf.exclude.push(wasmExtensionRegExp);
      }
    });
  });

  config.module.rules.unshift({
    test: wasmExtensionRegExp,
    type: "javascript/auto" /** this disables webpacks default handling of wasm */,
    use: [
      {
        loader: "file-loader",
        options: {
          name: "static/wasm/[name].[hash].[ext]",
          publicPath: ""
        }
      }
    ]
  })
}

function patchMonacoWebpackPlugin(config){
  config.plugins.push(
    new MonacoWebpackPlugin({
      languages: [],
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
    })
  )
}
