import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@tobilu/qmd') {
      throw new Error('QMD must not load for import/help/version');
    }
    return nextResolve(specifier, context);
  },
});
