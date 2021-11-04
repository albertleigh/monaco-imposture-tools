const fs = require('fs');
const http = require('http');
const path = require('path');
// const rimraf = require('rimraf');
const Mocha = require('mocha');

const PORT = 3003;
const BASE = path.resolve(__dirname, '..');
// const NYC_OUTPUT_PATH = path.resolve(__dirname, '..', '..', '..');

const localServer = http.createServer(function (req, res) {
  // console.info(`Test server listening on ${PORT} responses ${req.url}`);
  fs.readFile(
    path.resolve(
      BASE, 'dist',
      ...(req.url === '/' || !req.url?
        ['index.html']: req.url.split('/').filter(Boolean))
    ), function (err,data) {
    if (err) {
      res.writeHead(404);
      res.end(JSON.stringify(err));
      return;
    }
    res.writeHead(200);
    res.end(data);
  });
});

// if (fs.existsSync(path.resolve(BASE, '.nyc_output'))){
//   rimraf.sync(path.resolve(BASE, '.nyc_output'))
// }

localServer.listen(PORT);

// Instantiate a Mocha instance.
const mocha = new Mocha({
  slow: 0,
  timeout: 2000000,
  // fgrep: path.join(BASE, 'test', '**', '*.spec.js')
});

mocha.addFile(path.join(BASE, 'test', 'entry.spec.js'));

localServer.on('listening', () => {
  mocha.run(failures => {
    process.exitCode = failures ? 1 : 0;  // exit with non-zero status if there were failures
    localServer.close(err => {
      console.log(`Test server stopped listening on ${PORT}`);
    });
  })
})
