import pkgJson from './package.json'
import commonjs from '@rollup/plugin-commonjs'
import copy from 'rollup-plugin-copy'
import cocosPluginUpdater from './plugins/cocos-plugin-updater'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import isBuiltin from 'is-builtin-module';
import json from '@rollup/plugin-json'
import replace from '@rollup/plugin-replace'
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import alias from '@rollup/plugin-alias'
import { minify } from 'uglify-js'

const appName = pkgJson.name
const appVersion = pkgJson.version
const outputDir = `dist/${appName}`
const builderVersion = process.env.BUILD_VERSION || '2x'
const is2xBuilder = builderVersion === '2x'

export default {
  input: {
    main: `src/main${builderVersion}.ts`,
    ...(is2xBuilder ? {} : { hooks: `src/hooks.ts` })
  },
  output: {
    dir: outputDir,
    format: 'commonjs'
  },
  plugins: [
    typescript(),
    commonjs(),
    terser(),
    alias({
      entries: [
        { find: '@', replacement: __dirname + '/src' },
        { find: '~types', replacement: __dirname + '@types' }
      ]
    }),
    replace({
      preventAssignment: true,
      values: {
        'process.env.BUILD_VERSION': JSON.stringify(process.env.BUILD_VERSION),
      }
    }),
    json(),
    nodeResolve({
      preferBuiltins: is2xBuilder,
      ...(is2xBuilder ? {} : {
        resolveOnly: (module) => module === 'string_decoder' || !isBuiltin(module),
        exportConditions: ['node'],
      })
    }),
    copy({
      targets: [
        {
          src: `assets/package-${builderVersion}.json`,
          dest: outputDir,
          rename: 'package.json',
          transform: (contents) => {
            const tempPkgJson = JSON.parse(contents.toString('utf-8'))
            tempPkgJson.version = appVersion
            return JSON.stringify(tempPkgJson, null, 2)
          }
        },
        {
          src: `injects/${builderVersion}/init.js`,
          dest: outputDir,
          rename: 'injects/init.js',
          transform: (contents) => {
            return minify(contents.toString('utf-8')).code
          }
        },
        {
          src: `injects/${builderVersion}/main.js`,
          dest: outputDir,
          rename: 'injects/main.js',
          transform: (contents) => {
            return minify(contents.toString('utf-8')).code
          }
        },
        { src: `injects/libs/jszip.js`, dest: outputDir, rename: 'injects/jszip.js' },
        { src: 'i18n/**/*', dest: `${outputDir}/i18n` }
      ],
      verbose: true
    }),
    cocosPluginUpdater({
      src: `${__dirname}/${outputDir}`,
      dest: `~/.CocosCreator/${is2xBuilder ? 'packages' : 'extensions'}/${appName}`
    }),
  ],
  external: ['fs', 'path', 'https', 'os', 'electron']
}
