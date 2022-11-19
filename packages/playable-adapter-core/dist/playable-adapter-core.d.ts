declare type TChannelRC = {
    head: string;
    body: string;
    sdkScript: string;
};
declare type TAdapterRC = {
    buildPlatform: TPlatform;
    skipBuild: boolean;
    orientation: TWebOrientations;
    exportChannels: TChannel[];
    injectOptions: {
        [key in TChannel]: TChannelRC;
    };
    tinify?: boolean;
    tinifyApiKey?: string;
};
declare const getAdapterRCJson: () => TAdapterRC | null;
declare const getOriginPkgPath: () => string;
declare const getChannelRCJson: (channel: TChannel) => TChannelRC | null;
declare const getRCSkipBuild: () => boolean;
declare const getRCTinify: () => {
    tinify: boolean;
    tinifyApiKey: string;
};
declare const getChannelRCSdkScript: (channel: TChannel) => string;

declare const getRealPath: (pathStr: string) => string;

declare type TWebOrientations = 'portrait' | 'landscape' | 'auto';
declare type TPlatform = 'web-desktop' | 'web-mobile' | 'wechatgame' | 'oppo-mini-game' | 'vivo-mini-game' | 'huawei-quick-game' | 'alipay-mini-game' | 'mac' | 'ios' | 'linux' | 'android' | 'ohos' | 'open-harmonyos' | 'windows' | 'xiaomi-quick-game' | 'baidu-mini-game' | 'bytedance-mini-game' | 'cocos-play' | 'huawei-agc' | 'link-sure' | 'qtt' | 'cocos-runtime' | 'xr-meta' | 'xr-huaweivr' | 'xr-pico' | 'xr-rokid' | 'xr-monado' | 'ar-android' | 'ar-ios';
declare const mountProjectGlobalVars: (options: {
    projectRootPath: string;
    projectBuildPath?: string;
}) => void;
declare const mountBuildGlobalVars: (options: {
    platform: TPlatform;
    adapterBuildConfig?: TAdapterRC | null;
}) => void;
declare const unmountAllGlobalVars: () => void;
declare const getGlobalBuildPlatform: () => any;
declare const getGlobalBuildConfig: () => any;
declare const getGlobalProjectRootPath: () => string;
declare const getGlobalProjectBuildPath: () => string;

declare type TChannel = 'AppLovin' | 'Facebook' | 'Google' | 'IronSource' | 'Liftoff' | 'Mintegral' | 'Moloco' | 'Pangle' | 'Rubeex' | 'Tiktok' | 'Unity';
declare type TChannelPkgOptions = {
    orientation: TWebOrientations;
    zipRes?: {
        [key: string]: string;
    };
    notZipRes?: {
        [key: string]: string;
    };
};

declare const execTinify: () => Promise<{
    success: boolean;
    msg: string;
}>;

declare const genSingleFile$1: () => Promise<void>;

declare const genSingleFile: () => Promise<{
    zipRes: {
        [key: string]: string;
    };
    notZipRes: {
        [key: string]: string;
    };
}>;

declare const genChannelsPkg$1: (options: TChannelPkgOptions) => Promise<void>;

declare const genChannelsPkg: (options: TChannelPkgOptions) => Promise<void>;

export { TAdapterRC, TChannel, TChannelPkgOptions, TChannelRC, TPlatform, TWebOrientations, execTinify, genChannelsPkg$1 as gen2xChannelsPkg, genSingleFile$1 as gen2xSingleFile, genChannelsPkg as gen3xChannelsPkg, genSingleFile as gen3xSingleFile, getAdapterRCJson, getChannelRCJson, getChannelRCSdkScript, getGlobalBuildConfig, getGlobalBuildPlatform, getGlobalProjectBuildPath, getGlobalProjectRootPath, getOriginPkgPath, getRCSkipBuild, getRCTinify, getRealPath, mountBuildGlobalVars, mountProjectGlobalVars, unmountAllGlobalVars };
