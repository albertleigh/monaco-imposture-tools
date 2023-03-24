const cp = require('child_process');
const fs = require('fs');
const process = require('process');
const readline = require('readline');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const isCI = process.env.CI === 'true';

function updateNextTag() {

    // read package.json from the current working directory
    var packageJSON = JSON.parse(fs.readFileSync('package.json').toString());
    var name = packageJSON.name;
    var version = packageJSON.version;
    if (version.indexOf('next') !== -1) {
        return;
    }

    opts = {};
    opts.stdio = 'inherit';

    if (isCI) {
        console.log(name + ": set 'next' tag to latest version in CI");

        const result = cp.spawnSync(npm, ['dist-tags', 'add', name + '@' + version, 'next'], opts);

        if (result.error || result.status !== 0) {
            process.exit(1);
        }

    } else {
        console.log(name + ": set 'next' tag to latest version");

        const rl = readline.createInterface({input: process.stdin, output: process.stdout});

        rl.question('Enter OTP token: ', (token) => {
            const result = cp.spawnSync(npm, ['--otp', token, 'dist-tags', 'add', name + '@' + version, 'next'], opts);

            rl.close();

            if (result.error || result.status !== 0) {
                process.exit(1);
            }
        });
    }
}

updateNextTag();
