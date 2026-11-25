import type { VirtualFile } from '../types.js';
import { buildBrowserVfsShim } from '../vfs/browser-shim.js';
import {
  escapeInlineScript,
  inlineCssUrls,
  resolveRelPath,
  TEXT_EXTENSIONS,
  toDataUri
} from '../vfs/html-utils.js';
import { buildVfsPayloadScripts } from '../vfs/payload.js';
import type { AdapterTransformContext, EngineAdapter } from './types.js';

/**
 * Cocos Creator 3.x bootstrap & assetManager downloader registrations:
 * - Zero blob: script loading (Google/Meta CSP safe, issues #16/#18/#26)
 * - Complete loaders: bundle, json, font (FontFace), image, video (VideoPlayerImplManager), text, binary/wasm, script
 * - MD5 hash filename safe (issue #47)
 */
export function buildCocos3xLoaderScript(): string {
  return `(function(){
  var H=window.__PLAYABLE_VFS_HELPER__;
  if(!H) return;
  var res=H.res,getRes=H.getRes,findPrefix=H.findPrefix,b64ToBuf=H.b64ToBuf,b64ToBlob=H.b64ToBlob;
  function evalRes(key){
    if(!key||res[key]==null) return;
    (0,eval)(res[key]);
  }
  evalRes(findPrefix('src/polyfills.bundle'));
  evalRes(findPrefix('src/system.bundle'));
  if(window.System&&window.System.constructor&&window.System.constructor.prototype){
    var proto=window.System.constructor.prototype;
    var origCreate=proto.createScript;
    if(origCreate){
      proto.createScript=function(url){
        var hit=getRes(url);
        if(hit!=null){
          var s=document.createElement('script');
          s.async=true;
          s.crossOrigin='anonymous';
          s.text=hit;
          setTimeout(function(){s.dispatchEvent(new Event('load'));},0);
          return s;
        }
        return origCreate.call(this,url);
      };
    }
  }
  var importMapKey=findPrefix('src/import-map');
  var imports=importMapKey?JSON.parse(res[importMapKey]).imports||{}:{};
  var chain=Promise.resolve();
  var keys=Object.keys(imports);
  for(var i=keys.length-1;i>=0;i--){
    (function(mod){chain=chain.then(function(){return window.System?window.System.import(mod):undefined;});})(keys[i]);
  }
  chain.then(function(){
    if(window.cc&&window.cc.assetManager&&window.cc.assetManager.downloader){
      var dl=window.cc.assetManager.downloader;
      var loadScript=function(url,_o,cb){
        var s=getRes(url);
        if(s!=null)(0,eval)(s);
        cb&&cb(null);
      };
      var loadJson=function(url,_o,cb){
        var raw=getRes(url);
        try{cb&&cb(null,raw!=null?JSON.parse(raw):null);}catch(e){cb&&cb(e);}
      };
      var loadBundle=function(url,opts,cb){
        var baseUrl=/^(?:\\w+:\\/\\/|\\.+\\/)/.test(url)?url:'assets/'+window.cc.path.basename(url);
        var bundleName=window.cc.path.basename(url);
        var ver=(opts&&opts.version)||(dl.bundleVers&&dl.bundleVers[bundleName]);
        var cfgPath=baseUrl+'/config.'+(ver?ver+'.':'')+'json';
        var jsPath=baseUrl+'/index.'+(ver?ver+'.':'')+'js';
        var done=0,out=null,errOut=null;
        var finish=function(){if(++done===2) cb&&cb(errOut,out);};
        loadJson(cfgPath,opts,function(e,data){if(e)errOut=e;out=data;if(out)out.base=baseUrl+'/';finish();});
        loadScript(jsPath,opts,function(e){if(e)errOut=e;finish();});
      };
      var loadFont=function(url,_o,cb){
        var family=url.split('/').pop().split('.')[0];
        var data=getRes(url);
        if(!data||typeof FontFace==='undefined'){cb&&cb(null,family);return;}
        var ff=new FontFace(family,'url('+data+')');
        document.fonts.add(ff);
        ff.load().then(function(){cb&&cb(null,family);},function(){cb&&cb(null,family);});
      };
      var loadImg=function(url,_o,cb){
        var img=new Image();
        img.onload=function(){cb&&cb(null,img);};
        img.onerror=function(){cb&&cb(new Error('Image load failed: '+url));};
        img.src=getRes(url)||url;
        return img;
      };
      var loadVideo=function(url,_o,cb){
        var video=document.createElement('video');
        var source=document.createElement('source');
        video.appendChild(source);
        var data=getRes(url);
        if(data){
          source.src=URL.createObjectURL(b64ToBlob(data,'video/mp4'));
          cb&&cb(null,video);
        }else{
          cb&&cb(new Error('Video missing: '+url));
        }
      };
      var loadText=function(url,_o,cb){cb&&cb(null,getRes(url));};
      var loadBuf=function(url,_o,cb){var d=getRes(url);cb&&cb(null,d?b64ToBuf(d):new ArrayBuffer(0));};

      if(window.cc.internal&&window.cc.internal.VideoPlayerImplManager){
        var origGetImpl=window.cc.internal.VideoPlayerImplManager.getImpl;
        window.cc.internal.VideoPlayerImplManager.getImpl=function(comp){
          var impl=origGetImpl.call(this,comp);
          if(impl&&impl.createVideoPlayer){
            var origCreateVP=impl.createVideoPlayer;
            impl.createVideoPlayer=function(url){
              var data=getRes(url);
              if(data) return origCreateVP.call(this,URL.createObjectURL(b64ToBlob(data,'video/mp4')));
              return origCreateVP.call(this,url);
            };
          }
          return impl;
        };
      }

      dl.downloadScript=loadScript;
      dl.register('bundle',loadBundle);
      dl.register('.json',loadJson);
      dl.register('.js',loadScript);
      ['.font','.eot','.ttf','.woff','.woff2','.svg','.ttc'].forEach(function(e){dl.register(e,loadFont);});
      ['.png','.jpg','.jpeg','.bmp','.gif','.ico','.tiff','.webp','.image'].forEach(function(e){dl.register(e,loadImg);});
      ['.mp4','.avi','.mov','.mpg','.mpeg','.webm'].forEach(function(e){dl.register(e,loadVideo);});
      ['.txt','.xml','.vsh','.fsh','.atlas','.tmx','.tsx','.plist','.fnt'].forEach(function(e){dl.register(e,loadText);});
      ['.pvr','.pkm','.astc','.binary','.bin','.dbbin','.skel','.wasm'].forEach(function(e){dl.register(e,loadBuf);});
      dl.register('default',loadText);
    }
    var plugins=window.__PLAYABLE_COCOS_PLUGINS__||[];
    for(var p=0;p<plugins.length;p++) evalRes('src/'+plugins[p]);
    var indexKey=findPrefix('index.');
    if(indexKey&&window.System) window.System.import('./'+indexKey);
  });
})();`;
}

/**
 * Pluggable Cocos Creator 3.x engine adapter (supports 3.6–3.8.8+ including MD5 cache & WASM).
 */
export const cocos3xAdapter: EngineAdapter = {
  id: 'cocos-3x',
  displayName: 'Cocos Creator 3.x',
  preferSlimZip: true,

  detect(files: VirtualFile[]): boolean {
    const hasSystemBundle = files.some((f) => /^src\/system\.bundle(\.[a-f0-9]+)?\.js$/i.test(f.path));
    const hasSettingsJson = files.some((f) => /^src\/settings(\.[a-f0-9]+)?\.json$/i.test(f.path));
    const hasImportMap = files.some((f) => /^src\/import-map(\.[a-f0-9]+)?\.json$/i.test(f.path));
    return hasSystemBundle && (hasSettingsJson || hasImportMap);
  },

  transformSingleHtml(ctx: AdapterTransformContext): string {
    const { $, entryHtmlPath, fileMap, compress, adapterOptions } = ctx;
    const disableSplash = Boolean(adapterOptions?.disableSplash);

    // Inline CSS
    $('link[rel="stylesheet"][href], link[type="text/css"][href]').each((_i, el) => {
      const href = $(el).attr('href') || '';
      const resolved = resolveRelPath(entryHtmlPath, href);
      if (!resolved) return;
      const file = fileMap.get(resolved);
      if (!file) return;
      const css = inlineCssUrls(file.content.toString('utf-8'), resolved, fileMap);
      $(el).replaceWith(`<style>${css}</style>`);
    });

    // Preserve systemjs-importmap inline
    let importMapTags = '';
    $('script[type="systemjs-importmap"][src]').each((_i, el) => {
      const src = $(el).attr('src') || '';
      const resolved = resolveRelPath(entryHtmlPath, src);
      if (!resolved) return;
      const file = fileMap.get(resolved);
      if (!file) return;
      importMapTags += `<script type="systemjs-importmap">${escapeInlineScript(file.content.toString('utf-8'))}</script>`;
    });

    $('body script').remove();
    if (importMapTags) {
      $('body').append(importMapTags);
    }

    // Collect all project assets into VFS map
    const vfs: Record<string, string> = {};
    let pluginJsList: string[] = [];

    for (const [relPath, file] of fileMap.entries()) {
      if (relPath === entryHtmlPath) continue;
      if (TEXT_EXTENSIONS.has(file.ext)) {
        let text = file.content.toString('utf-8');
        if (/^src\/settings(\.[a-f0-9]+)?\.json$/i.test(relPath)) {
          try {
            const settings = JSON.parse(text) as {
              plugins?: { jsList?: string[] };
              splashScreen?: { totalTime?: number };
            };
            pluginJsList = [...(settings.plugins?.jsList ?? [])];
            settings.plugins = { ...settings.plugins, jsList: [] };
            if (disableSplash && settings.splashScreen) {
              settings.splashScreen.totalTime = 0;
            }
            text = JSON.stringify(settings);
          } catch {
            // Keep original settings.json if non-standard
          }
        }
        vfs[relPath] = text;
      } else {
        vfs[relPath] = toDataUri(file);
      }
    }

    $('body').append(
      `<script data-id="playable-cocos-plugins">window.__PLAYABLE_COCOS_PLUGINS__=${escapeInlineScript(JSON.stringify(pluginJsList))};</script>`
    );

    const payload = buildVfsPayloadScripts(vfs, { compress });
    for (const blk of payload.scripts) {
      $('body').append(`<script data-id="${blk.id}">${escapeInlineScript(blk.code)}</script>`);
    }

    $('body').append(
      `<script data-id="playable-vfs-loader">${escapeInlineScript(buildBrowserVfsShim())}</script>`
    );
    $('body').append(
      `<script data-id="playable-cocos3x-boot">${escapeInlineScript(buildCocos3xLoaderScript())}</script>`
    );

    return $.html();
  }
};
