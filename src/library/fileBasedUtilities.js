import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';

export async function createFile({ directory, filePath, data }) {
  await mkdir(directory, { recursive: true });
  await writeFile(filePath, data, 'utf8');
}

export async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function removeFile(filePath) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function escapeDesktopValue(value) {
  return value.replace(/[\\\n\r\t]/g, (character) => ({
    '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t'
  })[character]).replace(/^ +| +$/g, (spaces) => '\\s'.repeat(spaces.length));
}

export function escapeFilePath(value) {
  // Exec quoting is applied before the Desktop Entry string escaping layer.
  const quoted = `"${value.replace(/%/g, '%%').replace(/["`$\\]/g, '\\$&')}"`;
  return escapeDesktopValue(quoted);
}
