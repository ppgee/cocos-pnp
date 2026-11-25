import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateChannelBridgeScript, type SdkChannelId } from './index.js';

describe('@cocos-pnp/playable-sdk bridge generator', () => {
  it('emits zero mraid references for non-MRAID channels', () => {
    const forbiddenMraid: SdkChannelId[] = ['google', 'meta', 'tiktok', 'mintegral', 'moloco'];
    for (const ch of forbiddenMraid) {
      const code = generateChannelBridgeScript(ch);
      assert.equal(/mraid/i.test(code), false, `${ch} bridge must not contain mraid`);
      assert.equal(/\bwindow\.open\s*\(|location\.href/i.test(code), false, `${ch} bridge must not use raw redirects`);
      assert.ok(code.length < 1800, `${ch} bridge should stay lightweight (<1.8KB)`);
    }
  });

  it('emits required channel-specific CTA & lifecycle signatures', () => {
    assert.ok(generateChannelBridgeScript('applovin').includes('mraid.open'));
    const unity = generateChannelBridgeScript('unity');
    assert.ok(unity.includes('viewableChange'));
    assert.ok(unity.includes('audioVolumeChange'));
    assert.ok(unity.includes('emitResize()'));
    assert.ok(generateChannelBridgeScript('google').includes('ExitApi.exit()'));
    assert.ok(generateChannelBridgeScript('meta').includes('FbPlayableAd.onCTAClick()'));
    assert.ok(generateChannelBridgeScript('moloco').includes('FbPlayableAd.onCTAClick()'));
    assert.ok(generateChannelBridgeScript('tiktok').includes('window.openAppStore()'));

    const mtg = generateChannelBridgeScript('mintegral');
    assert.ok(mtg.includes('window.gameReady()'));
    assert.ok(mtg.includes('window.gameEnd()'));
    assert.ok(mtg.includes('window.install()'));

    const liftoff = generateChannelBridgeScript('liftoff');
    assert.ok(liftoff.includes("postMessage('download'"));
    assert.ok(liftoff.includes("postMessage('complete'"));
    assert.ok(liftoff.includes('mraid.open'));
  });
});
