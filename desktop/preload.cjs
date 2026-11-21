const { contextBridge } = require('electron');

const prefix = '--fmv-system-language=';
const systemLanguage = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
contextBridge.exposeInMainWorld('fmvSystemLanguage', systemLanguage || 'en');
