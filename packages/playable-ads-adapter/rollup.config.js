import pkgJson from './package.json'
import commonjs from '@rollup/plugin-commonjs'
import copy from 'rollup-plugin-copy'
import cocosPluginUpdater from './plugins/cocos-plugin-updater'
import cocosPluginWorker from './plugins/cocos-plugin-worker'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import isBuiltin from 'is-builtin-module';
import json from '@rollup/plugin-json'
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import alias from '@rollup/plugin-alias'

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
    cocosPluginWorker(),
    cocosPluginUpdater({
      src: `${__dirname}/${outputDir}`,
      dest: `~/.CocosCreator/${is2xBuilder ? 'packages' : 'extensions'}/${appName}`
    }),
  ],
  external: ['fs', 'path', 'os', 'electron']
}
