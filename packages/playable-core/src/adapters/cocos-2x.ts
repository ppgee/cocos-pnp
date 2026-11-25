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

function buildCocos2xLoaderScript(): string {
  return `(function(){
  var H=window.__PLAYABLE_VFS_HELPER__;
  if(!H) return;
  var res=H.res,getRes=H.getRes,findPrefix=H.findPrefix,b64ToBuf=H.b64ToBuf,b64ToBlob=H.b64ToBlob;
  function evalRes(key){
    if(!key||res[key]==null) return;
    (0,eval)(res[key]);
  }
  evalRes(findPrefix('src/settings'));
  evalRes(findPrefix('cocos2d-js'));
  evalRes(findPrefix('main'));
  if(window.cc&&window.cc.assetManager&&window.cc.assetManager.downloader){
    var dl=window.cc.assetManager.downloader;
    var loadScript=function(url,_o,cb){var s=getRes(url);if(s!=null)(0,eval)(s);cb&&cb(null);};
    var loadJson=function(url,_o,cb){var r=getRes(url);try{cb&&cb(null,r!=null?JSON.parse(r):null);}catch(e){cb&&cb(e);}};
    var loadImg=function(url,_o,cb){
      var img=new Image();
      img.onload=function(){cb&&cb(null,img);};
      img.onerror=function(){cb&&cb(new Error('Image load failed: '+url));};
      img.src=getRes(url)||url;
      return img;
    };
    var loadAudio=function(url,_o,cb){
      var data=getRes(url);
      if(!data){cb&&cb(new Error('Audio missing: '+url));return;}
      if(window.cc.sys&&window.cc.sys.__audioSupport&&window.cc.sys.__audioSupport.context){
        window.cc.sys.__audioSupport.context.decodeAudioData(b64ToBuf(data),function(buf){cb&&cb(null,buf);},function(err){cb&&cb(err);});
      }else{
        var a=new Audio(data);
        cb&&cb(null,a);
      }
    };
    var loadFont=function(url,_o,cb){
      var family=url.split('/').pop().split('.')[0];
      var data=getRes(url);
      if(!data||typeof FontFace==='undefined'){cb&&cb(null,family);return;}
      var ff=new FontFace(family,'url('+data+')');
      document.fonts.add(ff);
      ff.load().then(function(){cb&&cb(null,family);},function(){cb&&cb(null,family);});
    };
    var loadText=function(url,_o,cb){cb&&cb(null,getRes(url));};
    var loadBuf=function(url,_o,cb){var d=getRes(url);cb&&cb(null,d?b64ToBuf(d):new ArrayBuffer(0));};
    var loadBundle=function(url,opts,cb){
      var bundleName=window.cc.path.basename(url);
      var baseUrl=/^(?:\\w+:\\/\\/|\\.+\\/)/.test(url)?url:'assets/'+bundleName;
      var ver=(opts&&opts.version)||(dl.bundleVers&&dl.bundleVers[bundleName]);
      var cfgPath=baseUrl+'/config.'+(ver?ver+'.':'')+'json';
      var jsPath=baseUrl+'/index.'+(ver?ver+'.':'')+'js';
      var done=0,out=null,errOut=null;
      var finish=function(){if(++done===2) cb&&cb(errOut,out);};
      loadJson(cfgPath,opts,function(e,data){if(e)errOut=e;out=data;if(out)out.base=baseUrl+'/';finish();});
      loadScript(jsPath,opts,function(e){if(e)errOut=e;finish();});
    };
    dl.downloadScript=loadScript;
    dl.register('bundle',loadBundle);
    dl.register('.json',loadJson);
    dl.register('.js',loadScript);
    ['.png','.jpg','.jpeg','.bmp','.gif','.webp'].forEach(function(e){dl.register(e,loadImg);});
    ['.mp3','.ogg','.wav','.m4a'].forEach(function(e){dl.register(e,loadAudio);});
    ['.ttf','.woff','.woff2','.eot','.svg'].forEach(function(e){dl.register(e,loadFont);});
    ['.txt','.xml','.atlas','.plist','.fnt'].forEach(function(e){dl.register(e,loadText);});
    ['.bin','.skel','.dbbin','.pvr','.astc'].forEach(function(e){dl.register(e,loadBuf);});
    dl.register('default',loadText);
  }
  var plugins=window.__PLAYABLE_COCOS_PLUGINS__||[];
  for(var p=0;p<plugins.length;p++) evalRes('src/'+plugins[p]);
  if(typeof window.boot==='function') window.boot();
})();`;
}

/**
 * Pluggable Cocos Creator 2.x (2.4.x) engine adapter.
 */
export const cocos2xAdapter: EngineAdapter = {
  id: 'cocos-2x',
  displayName: 'Cocos Creator 2.x (2.4.x)',
  preferSlimZip: true,

  detect(files: VirtualFile[]): boolean {
    const hasSettingsJs = files.some((f) => /^src\/settings(\.[a-f0-9]+)?\.js$/i.test(f.path));
    const hasEngine = files.some((f) => /^cocos2d-js(-min)?(\.[a-f0-9]+)?\.js$/i.test(f.path));
    return hasSettingsJs && hasEngine;
  },

  transformSingleHtml(ctx: AdapterTransformContext): string {
    const { $, entryHtmlPath, fileMap, compress, adapterOptions } = ctx;
    const disableSplash = Boolean(adapterOptions?.disableSplash);

    $('link[rel="stylesheet"][href], link[type="text/css"][href]').each((_i, el) => {
      const href = $(el).attr('href') || '';
      const resolved = resolveRelPath(entryHtmlPath, href);
      if (!resolved) return;
      const file = fileMap.get(resolved);
      if (!file) return;
      const css = inlineCssUrls(file.content.toString('utf-8'), resolved, fileMap);
      $(el).replaceWith(`<style>${css}</style>`);
    });

    if (disableSplash) {
      $('head').append('<style>#splash{display:none!important;opacity:0!important;}</style>');
    }

    $('body script').remove();

    const vfs: Record<string, string> = {};
    let pluginJsList: string[] = [];

    for (const [relPath, file] of fileMap.entries()) {
      if (relPath === entryHtmlPath) continue;
      if (TEXT_EXTENSIONS.has(file.ext)) {
        let text = file.content.toString('utf-8');
        if (/^src\/settings(\.[a-f0-9]+)?\.js$/i.test(relPath)) {
          const match = /jsList\s*:\s*(\[[^\]]*\])/.exec(text);
          if (match) {
            try {
              pluginJsList = JSON.parse(match[1]) as string[];
              text = text.replace(match[0], 'jsList:[]');
            } catch {
              // Keep original settings.js
            }
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
      `<script data-id="playable-cocos2x-boot">${escapeInlineScript(buildCocos2xLoaderScript())}</script>`
    );

    return $.html();
  }
};
