#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startLocalServer } from '../lib/local-server.mjs';

const help = `Kullanım: fmv [--no-open] [--] [dosya-veya-klasör]

Yerel 3B modelleri tarayıcıda açar.
  --no-open  Tarayıcıyı otomatik açmadan bağlantıyı yazdır.
  -h, --help Bu yardımı göster.

Durdurmak için Ctrl+C kullan.`;

function parseArgs(args) {
  const options = { open: true };
  let positionalOnly = false;
  for (const arg of args) {
    if (!positionalOnly && arg === '--') positionalOnly = true;
    else if (!positionalOnly && arg === '--no-open') options.open = false;
    else if (!positionalOnly && ['--help', '-h'].includes(arg)) options.help = true;
    else if (!positionalOnly && arg.startsWith('-')) throw new Error(`Bilinmeyen seçenek: ${arg}`);
    else if (options.argument !== undefined) throw new Error('Yalnızca bir dosya veya klasör belirt.');
    else options.argument = arg;
  }
  return options;
}

function openBrowser(url) {
  const command = process.platform === 'win32' ? ['rundll32.exe', 'url.dll,FileProtocolHandler']
    : process.platform === 'darwin' ? ['open'] : ['xdg-open'];
  const browserLauncher = spawn(command[0], [...command.slice(1), url], { stdio: 'ignore', windowsHide: true });
  browserLauncher.once('error', () => console.error('Tarayıcı açılamadı. Yukarıdaki bağlantıyı kullan.'));
  browserLauncher.once('exit', (code) => {
    if (code) console.error('Tarayıcı açılamadı. Yukarıdaki bağlantıyı kullan.');
  });
  return browserLauncher;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(help);
    return;
  }

  const webRoot = fileURLToPath(new URL('../out/', import.meta.url));
  const server = await startLocalServer({ webRoot, argument: options.argument });
  console.log(`FMV · ${server.url}`);
  const launcher = options.open ? openBrowser(server.url) : null;
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    launcher?.kill();
    await server.close();
  }
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, stop);
}

main().catch((error) => {
  console.error(`FMV · ${error.message}`);
  process.exitCode = 1;
});
