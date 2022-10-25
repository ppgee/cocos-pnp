import { run } from 'node-cmd'

export default function cocosPluginUpdater(options) {
  const { src, dest } = options
  return {
    name: 'cocos-plugin-update',
    closeBundle() {
      // console.log(process.env)
      if (!src || !dest) {
        return
      }

      console.log('cocos-plugin-update copy folder to global cocos plugin packages')
      run(`rm -rf ${dest} && cp -r ${src} ${dest}`)
      console.log('cocos-plugin-update copy folder success')
    }
  }
}