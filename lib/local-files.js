import { encodeModelPath } from './model-paths.mjs';

export function pickedFiles(files) {
  return new Map(Array.from(files, (file) => [file.webkitRelativePath || file.name, file]));
}

function readEntryFile(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walkEntry(entry, parent, result) {
  const path = parent + entry.name;
  if (entry.isFile) {
    result.set(path, await readEntryFile(entry));
    return;
  }
  if (!entry.isDirectory) return;

  const reader = entry.createReader();
  while (true) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) return;
    await Promise.all(batch.map((child) => walkEntry(child, path + '/', result)));
  }
}

export async function droppedFiles(transfer) {
  // Read DataTransfer synchronously while the browser still grants access.
  const items = Array.from(transfer.items).filter((item) => item.kind === 'file');
  const entries = items.map((item) => ({
    entry: item.webkitGetAsEntry?.(),
    file: item.getAsFile(),
  }));
  const files = pickedFiles(transfer.files);
  if (!entries.length) return files;

  const result = new Map();
  await Promise.all(entries.map(({ entry, file }) => {
    if (entry) return walkEntry(entry, '', result);
    if (file) result.set(file.name, file);
  }));
  return result;
}

export function browserSelection(files) {
  return {
    paths: [...files.keys()],
    createAsset(path) {
      const urls = new Map();
      return {
        path,
        title: path.split('/').at(-1),
        resolve(resource) {
          const file = files.get(resource);
          if (!file) return undefined;
          if (!urls.has(resource)) urls.set(resource, URL.createObjectURL(file));
          return urls.get(resource);
        },
        release() {
          for (const url of urls.values()) URL.revokeObjectURL(url);
          urls.clear();
        },
      };
    },
  };
}

export async function launchSelection(token, signal) {
  const prefix = `/_fmv/${token}/`;
  const response = await fetch(prefix + 'selection', { signal });
  if (!response.ok) throw new Error('Başlangıç dosyaları okunamadı.');
  const { paths, initial } = await response.json();
  return {
    paths,
    initial,
    createAsset(path) {
      return {
        path,
        title: path.split('/').at(-1),
        resolve: (resource) => prefix + 'file/' + encodeModelPath(resource),
      };
    },
  };
}
