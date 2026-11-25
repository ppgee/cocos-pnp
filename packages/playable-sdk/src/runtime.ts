export type SdkChannelId =
  | 'applovin'
  | 'unity'
  | 'google'
  | 'meta'
  | 'tiktok'
  | 'mintegral'
  | 'moloco'
  | 'liftoff';

export interface PlayableLifecycleHandlers {
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onMuteChange?: (muted: boolean) => void;
  onResize?: (size: { width: number; height: number }) => void;
}

export interface PlayableBridge {
  channel: SdkChannelId | 'preview';
  init: (handlers?: PlayableLifecycleHandlers) => void;
  ready: () => void;
  cta: (storeUrl?: string) => void;
  complete: () => void;
  gameEnd: () => void;
  isMuted: () => boolean;
}

export interface BridgeGeneratorOptions {
  iosUrl?: string;
  androidUrl?: string;
  fallbackUrl?: string;
}

declare global {
  interface Window {
    __PLAYABLE_CHANNEL__?: SdkChannelId | 'preview';
    __PLAYABLE_BRIDGE__?: PlayableBridge;
    playable?: PlayableBridge;
  }
}

function getGlobalBridge(): PlayableBridge | null {
  if (typeof window !== 'undefined' && window.__PLAYABLE_BRIDGE__) {
    return window.__PLAYABLE_BRIDGE__;
  }
  return null;
}

let previewStarted = false;
let previewMuted = false;

export const playable: PlayableBridge = {
  get channel() {
    return getGlobalBridge()?.channel ?? (typeof window !== 'undefined' ? window.__PLAYABLE_CHANNEL__ : undefined) ?? 'preview';
  },
  init(handlers?: PlayableLifecycleHandlers) {
    const bridge = getGlobalBridge();
    if (bridge) {
      bridge.init(handlers);
      return;
    }
    if (!previewStarted) {
      previewStarted = true;
      handlers?.onStart?.();
    }
    if (typeof window !== 'undefined' && handlers?.onResize) {
      const emit = () => handlers.onResize?.({ width: window.innerWidth, height: window.innerHeight });
      window.addEventListener('resize', emit);
    }
  },
  ready() {
    getGlobalBridge()?.ready();
  },
  cta(storeUrl?: string) {
    const bridge = getGlobalBridge();
    if (bridge) {
      bridge.cta(storeUrl);
      return;
    }
    if (typeof console !== 'undefined') {
      console.info('[playable-sdk:preview] CTA clicked', storeUrl ?? '');
    }
  },
  complete() {
    getGlobalBridge()?.complete();
  },
  gameEnd() {
    const bridge = getGlobalBridge();
    if (bridge) {
      bridge.gameEnd();
    }
  },
  isMuted() {
    return getGlobalBridge()?.isMuted() ?? previewMuted;
  }
};
