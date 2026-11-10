// electron-builder afterPack hook.
// There is no paid Apple Developer certificate here, so the app gets a valid
// ad-hoc signature instead. Without this, an arm64 Mac refuses to launch it
// ("the application is damaged") once it has been copied from a .dmg.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  console.log(`  • ad-hoc signing  app=${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', appPath], {
    stdio: 'inherit',
  });
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });
};
