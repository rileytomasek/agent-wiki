import { existsSync } from 'node:fs';

if (
  process.env['CI'] !== 'true' &&
  process.env['HUSKY'] !== '0' &&
  existsSync('.git')
) {
  const { default: install } = await import('husky');
  const message = install();
  if (message !== '') {
    throw new Error(message);
  }
}
