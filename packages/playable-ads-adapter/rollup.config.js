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
import { readFileSync } from 'fs'

const appName = pkgJson.name
const appVersion = pkgJson.version
const outputDir = `dist/${appName}`
const builderVersion = process.env.BUILD_VERSION || '2x'
const is2xBuilder = builderVersion === '2x'

const getJSCode = (jsPath) => {
  return JSON.stringify(minify(readFileSync(__dirname + jsPath).toString('utf-8')).code)
}

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
        __adapter_init_2x_code__: () => getJSCode('/injects/2x/init.js'),
        __adapter_main_2x_code__: () => getJSCode('/injects/2x/main.js'),
        __adapter_init_3x_code__: () => getJSCode('/injects/3x/init.js'),
        __adapter_main_3x_code__: () => getJSCode('/injects/3x/main.js'),
        __adapter_jszip_code__: () => getJSCode('/injects/libs/jszip.js'),
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
        { src: 'i18n/**/*', dest: `${outputDir}/i18n` }
      ],
      verbose: true
    }),
    cocosPluginUpdater({
      src: `${__dirname}/${outputDir}`,
      dest: `~/.CocosCreator/${is2xBuilder ? 'packages' : 'extensions'}/${appName}`
    }),
  ],
  external: ['fs', 'path', 'os', 'electron']
}
