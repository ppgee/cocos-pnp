// 在head里面添加
export const APPEND_TO_HEAD = `<script src="cordova.js"></script><script>function onLoad(){document.addEventListener("deviceready",()=>{navigator.splashscreen.hide()},false)}</script>`

// 将下面代码放入 body 中，且在开发者自己的 js 代码之前
export const INSERT_BEFORE_SCRIPT = `<script src="https://sf3-ttcdn-tos.pstatp.com/obj/union-fe-nc/playable/sdk/playable-sdk.js" data-tomark-pass></script>`