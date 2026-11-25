import type { BridgeGeneratorOptions, SdkChannelId } from './runtime.js';

/**
 * Generates a minimal, zero-dependency, channel-isolated inline JS snippet.
 * Critically, non-MRAID channels emit ZERO references to `mraid`, and
 * strict-redirect channels emit ZERO references to `window.open` / `location.href`.
 */
export function generateChannelBridgeScript(
  channel: SdkChannelId,
  options: BridgeGeneratorOptions = {}
): string {
  const iosUrl = JSON.stringify(options.iosUrl || options.fallbackUrl || '');
  const androidUrl = JSON.stringify(options.androidUrl || options.fallbackUrl || '');

  const commonShell = (body: string) =>
    `(function(){var H={},S=false,M=false;function emitResize(){var sz={width:window.innerWidth,height:window.innerHeight};H.onResize&&H.onResize(sz);try{window.dispatchEvent(new Event('resize'))}catch(_){}}function emitStart(){if(S)return;S=true;H.onStart&&H.onStart()}function emitPause(){M=true;H.onMuteChange&&H.onMuteChange(true);H.onPause&&H.onPause()}function emitResume(){M=false;H.onMuteChange&&H.onMuteChange(false);H.onResume&&H.onResume()}function bindResize(){window.addEventListener('resize',function(){H.onResize&&H.onResize({width:window.innerWidth,height:window.innerHeight})})}function resolveUrl(u){if(u)return u;var ua=navigator.userAgent||'';if(/android/i.test(ua))return ${androidUrl}||${iosUrl};return ${iosUrl}||${androidUrl}}${body}window.__PLAYABLE_CHANNEL__=${JSON.stringify(channel)};window.__PLAYABLE_BRIDGE__=B;window.playable=B;})();`;

  switch (channel) {
    case 'applovin':
    case 'unity':
      return commonShell(
        `var B={channel:${JSON.stringify(channel)},init:function(h){H=h||{};bindResize();if(window.mraid){var onReady=function(){if(mraid.isViewable()){emitStart();emitResize()}mraid.addEventListener('viewableChange',function(v){if(v){if(!S)emitStart();else emitResume();emitResize()}else{emitPause()}});mraid.addEventListener('audioVolumeChange',function(vol){var muted=vol===0||vol===null||vol===undefined;M=muted;H.onMuteChange&&H.onMuteChange(muted)})};if(mraid.getState()==='loading'){mraid.addEventListener('ready',onReady)}else{onReady()}}else{emitStart()}},ready:function(){},cta:function(u){var url=resolveUrl(u);if(window.mraid&&typeof mraid.open==='function'){url?mraid.open(url):mraid.open()}},complete:function(){},gameEnd:function(){},isMuted:function(){return M}};`
      );

    case 'google':
      return commonShell(
        `var B={channel:'google',init:function(h){H=h||{};bindResize();emitStart()},ready:function(){},cta:function(){if(window.ExitApi&&typeof ExitApi.exit==='function'){ExitApi.exit()}},complete:function(){},gameEnd:function(){},isMuted:function(){return M}};`
      );

    case 'meta':
    case 'moloco':
      return commonShell(
        `var B={channel:${JSON.stringify(channel)},init:function(h){H=h||{};bindResize();emitStart()},ready:function(){},cta:function(){if(window.FbPlayableAd&&typeof FbPlayableAd.onCTAClick==='function'){FbPlayableAd.onCTAClick()}},complete:function(){},gameEnd:function(){},isMuted:function(){return M}};`
      );

    case 'tiktok':
      return commonShell(
        `var B={channel:'tiktok',init:function(h){H=h||{};bindResize();emitStart()},ready:function(){},cta:function(){if(typeof window.openAppStore==='function'){window.openAppStore()}else if(window.playableSDK&&typeof window.playableSDK.openAppStore==='function'){window.playableSDK.openAppStore()}},complete:function(){},gameEnd:function(){},isMuted:function(){return M}};`
      );

    case 'mintegral':
      return commonShell(
        `var R=false,E=false;window.gameStart=function(){if(!S)emitStart();else emitResume()};window.gameClose=function(){emitPause()};var B={channel:'mintegral',init:function(h){H=h||{};bindResize();emitStart()},ready:function(){if(R)return;R=true;if(typeof window.gameReady==='function'){window.gameReady()}},cta:function(){if(typeof window.install==='function'){window.install()}},complete:function(){B.gameEnd()},gameEnd:function(){if(E)return;E=true;if(typeof window.gameEnd==='function'){window.gameEnd()}},isMuted:function(){return M}};`
      );

    case 'liftoff':
      return commonShell(
        `var C=false;window.addEventListener('ad-event-pause',function(){emitPause()});window.addEventListener('ad-event-resume',function(){emitResume()});var B={channel:'liftoff',init:function(h){H=h||{};bindResize();emitStart()},ready:function(){},cta:function(){if(window.parent&&typeof window.parent.postMessage==='function'){window.parent.postMessage('download','*')}},complete:function(){if(C)return;C=true;if(window.parent&&typeof window.parent.postMessage==='function'){window.parent.postMessage('complete','*')}},gameEnd:function(){B.complete()},isMuted:function(){return M}};`
      );
  }
}
