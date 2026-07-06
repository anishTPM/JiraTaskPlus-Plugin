import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const isProd = process.env.NODE_ENV === 'production';
const plugins = [resolve()];
if (isProd) plugins.push(terser());

const chromeExternal = {
  external: ['chrome'],
  output: { globals: { chrome: 'chrome' } },
};

export default [
  {
    input: 'src/background.js',
    output: { file: 'build/background.js', format: 'iife', ...chromeExternal.output },
    external: chromeExternal.external,
    plugins,
  },
  {
    input: 'src/content.js',
    output: { file: 'build/content.js', format: 'iife' },
    plugins,
  },
  {
    input: 'src/modal/modal.js',
    output: { file: 'build/modal/modal.js', format: 'iife' },
    plugins,
  },
  {
    input: 'src/settings/options.js',
    output: { file: 'build/settings/options.js', format: 'iife' },
    plugins,
  },
];
