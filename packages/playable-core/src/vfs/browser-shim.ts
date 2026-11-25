/**
 * Engine-agnostic browser-level VFS runtime interceptor covering all 7 standard
 * browser resource loading mechanisms:
 * 1. window.URL (SafeURL guard against blob:null / about:blank AdWebViews)
 * 2. window.fetch
 * 3. window.XMLHttpRequest
 * 4. WebAssembly.instantiateStreaming
 * 5. HTMLImageElement.prototype.src + setAttribute('src') (PixiJS/Phaser/Three.js/PlayCanvas/Canvas)
 * 6. HTMLMediaElement.prototype.src + window.Audio (dynamic audio/video loading)
 * 7. window.FontFace (runtime font loading)
 */
export function buildBrowserVfsShim(): string {
  return `(function(){
  if(window.__PLAYABLE_VFS_READY__) return;
  window.__PLAYABLE_VFS_READY__=true;
  var res=window.__PLAYABLE_VFS__||(window.__PLAYABLE_VFS__={});

  // 1. SafeURL guard for AdWebViews running under blob:null / about:blank
  if(typeof window.URL==='function'){
    var NativeURL=window.URL;
    function SafeURL(input,base){
      if(arguments.length>=2){
        try{return new NativeURL(input,base);}catch(_){
          var fb=(typeof location!=='undefined'&&/^https?:\\/\\//i.test(location.href))?location.href:'https://playable.local/';
          return new NativeURL(input,fb);
        }
      }
      return new NativeURL(input);
    }
    SafeURL.prototype=NativeURL.prototype;
    SafeURL.createObjectURL=NativeURL.createObjectURL.bind(NativeURL);
    SafeURL.revokeObjectURL=NativeURL.revokeObjectURL.bind(NativeURL);
    if(NativeURL.canParse) SafeURL.canParse=NativeURL.canParse.bind(NativeURL);
    try{window.URL=SafeURL;}catch(_){}
  }

  function b64ToBuf(dataUri){
    var idx=dataUri.indexOf(',');
    var b64=idx>=0?dataUri.slice(idx+1):dataUri;
    var bin=atob(b64);
    var u8=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    return u8.buffer;
  }

  function b64ToBlob(dataUri,fallbackType){
    var mime=fallbackType||'application/octet-stream';
    var m=/^data:([^;]+);base64,/.exec(dataUri);
    if(m) mime=m[1];
    return new Blob([b64ToBuf(dataUri)],{type:mime});
  }

  function normalizeUrl(url){
    var s=String(url||'').split('?')[0].split('#')[0];
    try{s=decodeURIComponent(s);}catch(_){}
    return s.replace(/^https?:\\/\\/[^/]+/,'').replace(/^\\.\\//,'').replace(/^\\/+/, '');
  }

  function findKey(url){
    var raw=String(url||'');
    if(!raw||raw.indexOf('data:')===0||raw.indexOf('blob:')===0) return null;
    var clean=normalizeUrl(raw);
    if(res[clean]!==undefined) return clean;
    for(var k in res){
      if(clean===k||clean.endsWith('/'+k)) return k;
    }
    if(clean.indexOf('.wasm')!==-1){
      var base=clean.split('/').pop().replace(/\\.[a-f0-9]+\\.wasm$/i,'.wasm').replace(/\\.wasm$/i,'');
      for(var wk in res){
        if(wk.indexOf('.wasm')!==-1&&wk.indexOf(base)!==-1) return wk;
      }
    }
    return null;
  }

  function getRes(url){
    var k=findKey(url);
    return k!==null?res[k]:null;
  }

  function findPrefix(prefix){
    for(var k in res){if(k.indexOf(prefix)===0) return k;}
    return null;
  }

  function toAssetUrl(url){
    var hit=getRes(url);
    if(hit==null) return null;
    if(hit.indexOf('data:')===0) return hit;
    return 'data:application/octet-stream;base64,'+btoa(unescape(encodeURIComponent(hit)));
  }

  window.__PLAYABLE_VFS_HELPER__={
    res:res,b64ToBuf:b64ToBuf,b64ToBlob:b64ToBlob,
    findKey:findKey,getRes:getRes,findPrefix:findPrefix,toAssetUrl:toAssetUrl
  };

  // 2. fetch interception
  var origFetch=window.fetch;
  if(origFetch){
    window.fetch=function(input,init){
      var url=typeof input==='string'?input:(input&&input.url)||'';
      var hit=getRes(url);
      if(hit!=null){
        var isData=hit.indexOf('data:')===0;
        var ct=url.indexOf('.wasm')!==-1?'application/wasm':url.indexOf('.json')!==-1?'application/json':url.indexOf('.css')!==-1?'text/css':'application/octet-stream';
        var resp={
          ok:true,status:200,statusText:'OK',url:url,
          headers:{get:function(h){return h&&h.toLowerCase()==='content-type'?ct:null;}},
          clone:function(){return resp;},
          text:function(){return Promise.resolve(isData?new TextDecoder().decode(b64ToBuf(hit)):hit);},
          json:function(){return Promise.resolve(JSON.parse(isData?new TextDecoder().decode(b64ToBuf(hit)):hit));},
          arrayBuffer:function(){return Promise.resolve(isData?b64ToBuf(hit):new TextEncoder().encode(hit).buffer);},
          blob:function(){return Promise.resolve(isData?b64ToBlob(hit,ct):new Blob([hit],{type:ct}));}
        };
        return Promise.resolve(resp);
      }
      return origFetch.call(this,input,init);
    };
  }

  // 3. XMLHttpRequest interception
  if(typeof window.XMLHttpRequest==='function'){
    var OrigXHR=window.XMLHttpRequest;
    var origOpen=OrigXHR.prototype.open;
    var origSend=OrigXHR.prototype.send;
    OrigXHR.prototype.open=function(method,url){
      this.__playableUrl=url;
      return origOpen.apply(this,arguments);
    };
    OrigXHR.prototype.send=function(){
      var hit=this.__playableUrl?getRes(this.__playableUrl):null;
      if(hit!=null){
        var self=this;
        var isData=hit.indexOf('data:')===0;
        var out=hit;
        if(self.responseType==='arraybuffer'){
          out=isData?b64ToBuf(hit):new TextEncoder().encode(hit).buffer;
        }else if(self.responseType==='json'){
          out=JSON.parse(isData?new TextDecoder().decode(b64ToBuf(hit)):hit);
        }else if(self.responseType==='blob'){
          out=isData?b64ToBlob(hit):new Blob([hit]);
        }else if(isData){
          out=new TextDecoder().decode(b64ToBuf(hit));
        }
        try{
          Object.defineProperty(self,'readyState',{configurable:true,value:4});
          Object.defineProperty(self,'status',{configurable:true,value:200});
          Object.defineProperty(self,'response',{configurable:true,value:out});
          if(typeof out==='string') Object.defineProperty(self,'responseText',{configurable:true,value:out});
        }catch(_){}
        setTimeout(function(){
          if(typeof self.onreadystatechange==='function') self.onreadystatechange();
          if(typeof self.onload==='function') self.onload();
          if(typeof self.dispatchEvent==='function'){
            self.dispatchEvent(new Event('load'));
            self.dispatchEvent(new Event('loadend'));
          }
        },0);
        return;
      }
      return origSend.apply(this,arguments);
    };
  }

  // 4. WebAssembly.instantiateStreaming fallback
  if(typeof WebAssembly!=='undefined'&&WebAssembly.instantiateStreaming){
    var origStream=WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming=function(respPromise,imports){
      return Promise.resolve(respPromise).then(function(r){
        if(r&&typeof r.arrayBuffer==='function'){
          return r.arrayBuffer().then(function(buf){return WebAssembly.instantiate(buf,imports);});
        }
        return origStream.call(WebAssembly,Promise.resolve(r),imports);
      });
    };
  }

  // 5. HTMLImageElement.prototype.src & setAttribute('src') interception
  if(typeof HTMLImageElement!=='undefined'){
    var imgDesc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
    if(imgDesc&&imgDesc.set&&imgDesc.get){
      Object.defineProperty(HTMLImageElement.prototype,'src',{
        configurable:true,
        get:function(){return imgDesc.get.call(this);},
        set:function(v){
          var mapped=toAssetUrl(v);
          return imgDesc.set.call(this,mapped!=null?mapped:v);
        }
      });
    }
    var origImgSetAttr=HTMLImageElement.prototype.setAttribute;
    HTMLImageElement.prototype.setAttribute=function(name,val){
      if(String(name).toLowerCase()==='src'){
        var mapped=toAssetUrl(val);
        if(mapped!=null) return origImgSetAttr.call(this,name,mapped);
      }
      return origImgSetAttr.call(this,name,val);
    };
  }

  // 6. HTMLMediaElement.prototype.src & window.Audio interception
  if(typeof HTMLMediaElement!=='undefined'){
    var mediaDesc=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');
    if(mediaDesc&&mediaDesc.set&&mediaDesc.get){
      Object.defineProperty(HTMLMediaElement.prototype,'src',{
        configurable:true,
        get:function(){return mediaDesc.get.call(this);},
        set:function(v){
          var mapped=toAssetUrl(v);
          return mediaDesc.set.call(this,mapped!=null?mapped:v);
        }
      });
    }
  }
  if(typeof window.Audio==='function'){
    var NativeAudio=window.Audio;
    function PatchedAudio(src){
      var mapped=src?toAssetUrl(src):null;
      return new NativeAudio(mapped!=null?mapped:src);
    }
    PatchedAudio.prototype=NativeAudio.prototype;
    try{window.Audio=PatchedAudio;}catch(_){}
  }

  // 7. FontFace constructor interception
  if(typeof window.FontFace==='function'){
    var NativeFontFace=window.FontFace;
    function PatchedFontFace(family,source,descriptors){
      if(typeof source==='string'){
        var m=/url\\(\\s*(['"]?)([^)'"]+)\\1\\s*\\)/.exec(source);
        if(m){
          var mapped=toAssetUrl(m[2]);
          if(mapped!=null) source='url('+mapped+')';
        }
      }
      return new NativeFontFace(family,source,descriptors);
    }
    PatchedFontFace.prototype=NativeFontFace.prototype;
    try{window.FontFace=PatchedFontFace;}catch(_){}
  }
})();`;
}
