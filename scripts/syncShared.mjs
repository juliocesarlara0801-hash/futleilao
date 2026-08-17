// Copia shared/types.ts para dentro de cada workspace (client e server), já que
// cada um compila isoladamente (rootDir: src) e não pode importar de fora da pasta.
// shared/types.ts é a fonte da verdade; nunca edite as cópias diretamente.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const source = readFileSync(path.join(root, 'shared', 'types.ts'), 'utf-8');
const banner = '// ⚠️ ARQUIVO GERADO — não edite. Fonte: shared/types.ts (rode `npm run sync`).\n\n';

const targets = [
  path.join(root, 'server', 'src', 'types.ts'),
  path.join(root, 'client', 'src', 'types', 'index.ts'),
];

for (const target of targets) {
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, banner + source, 'utf-8');
}

console.log('shared/types.ts sincronizado para server/src/types.ts e client/src/types/index.ts');
