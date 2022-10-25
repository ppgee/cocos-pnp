export let globalVar2x = `var window = $global;
var cc = window.cc = window.cc || {};
var b2 = window.b2 = window.b2 || {};
var sp = window.sp = window.sp || {};
var dragonBones = window.dragonBones = window.dragonBones || {};
var __globalAdapter = window.__globalAdapter = window.__globalAdapter || {};
var __cocos_require__ = window.__cocos_require__;
var Image = window.Image;
var HTMLCanvasElement = window.HTMLCanvasElement;
var HTMLImageElement = window.HTMLImageElement;
var ImageBitmap = window.ImageBitmap;
var document = window.document;
var DOMParser = window.DOMParser;
var performance = window.performance;
var __extends = window.__extends
var __decorate = window.__decorate
var __require = window.__require;
`
export let settingsVar2x = `var window = $global;
`
export let ccRequireVar2x = `var window = $global;

let moduleMap = {
  {{replace-with-module-map}}
  // tail
};

window.__cocos_require__ = function (moduleName) {
  let func = moduleMap[moduleName];
  if (!func) {
    console.log(\`cannot find module \$\{moduleName\}\`)
    throw new Error(\`cannot find module \${moduleName}\`);
  }
  return func();
};
`
