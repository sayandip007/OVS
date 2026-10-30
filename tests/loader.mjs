import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const hookSource = `
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.png') || specifier.endsWith('.jpg') || specifier.endsWith('.jpeg') || specifier.endsWith('.svg')) {
    const parentPath = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : process.cwd();
    const resolvedPath = path.resolve(parentPath, specifier);
    return {
      url: pathToFileURL(resolvedPath).href,
      shortCircuit: true,
    };
  }

  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier)) {
    const parentPath = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : process.cwd();
    for (const ext of ['.js', '.jsx', '.mjs']) {
      const candidate = path.resolve(parentPath, specifier + ext);
      if (fs.existsSync(candidate)) {
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
        };
      }
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.svg')) {
    return {
      format: 'module',
      source: \`export default \${JSON.stringify(url)};\`,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
`;

register(
  `data:text/javascript;base64,${Buffer.from(hookSource).toString('base64')}`,
  pathToFileURL('./')
);
