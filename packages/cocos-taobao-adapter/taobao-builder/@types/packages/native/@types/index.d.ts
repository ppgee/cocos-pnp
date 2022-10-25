
export * from '@editor/library-type/packages/builder/@types/protect';
import { IInternalBuildOptions, InternalBuildResult, IPolyFills, IBuildScriptParam } from '@editor/library-type/packages/builder/@types/protect';

export interface IOrientation {
    landscapeLeft: boolean;
    landscapeRight: boolean;
    portrait: boolean;
    upsideDown: boolean;
}

export interface IAndroidOptions {
    apiLevel: string,
    appABIs: string[],
    appBundle: boolean,
    keystoreAlias: string,
    keystoreAliasPassword: string,
    keystorePath: string,
    keystorePassword: string,
    orientation: IOrientation,
    packageName: string,
    useDebugKeystore: boolean,
    sdkPath: string;
    ndkPath: string;
    androidInstant:boolean;
    remoteUrl:string;
}

export interface IAndroidOptions {
    apiLevel: string,
    appABIs: string[],
    appBundle: boolean,
    keystoreAlias: string,
    keystoreAliasPassword: string,
    keystorePath: string,
    keystorePassword: string,
    orientation: IOrientation,
    packageName: string,
    useDebugKeystore: boolean,
    androidInstant:boolean;
    remoteUrl:string;
    swappy: boolean;
}

/**
 * 鸿蒙参数配置
 */
export interface IOHOSOptions {
    packageName: string;
    sdkPath?: string;
    ndkPath?: string;
    apiLevel: number;

    orientation: IOrientation;
}

declare enum NetMode {
    client = 0,
    hostServer = 1,
    listenServer = 2,
}
export interface ITaskOptionPackages {
    native: IOptions;
    android?: IAndroidOptions,
    ios?: {
        orientation: IOrientation,
        packageName: string,
        developerTeam?: string,
        targetVersion?: string;
        skipUpdateXcodeProject: boolean;
        osTarget: {
            iphoneos: boolean;
            simulator: boolean;
        };
    },
    mac?: {
        packageName: string;
        supportM1: boolean;
        targetVersion?: string;
        serverMode: boolean;
        skipUpdateXcodeProject: boolean;
    },
    windows?: {
        sdkVersion: string;
        serverMode: boolean;
        targetPlatform: 'win32' | 'x64';
    },
    ohos?: IOHOSOptions;
}

interface ICustomBuildScriptParam extends IBuildScriptParam {
    experimentalHotReload: boolean;
}

export interface ITaskOption extends IInternalBuildOptions {
    packages: ITaskOptionPackages;
    buildScriptParam: ICustomBuildScriptParam;
}

export interface IOptions {
    template: string;
    remoteServerAddress: string;
    polyfills?: IPolyFills;
    engine?: string;
    makeAfterBuild: boolean;
    runAfterMake: boolean;
    encrypted: boolean;// 是否加密脚本
    compressZip: boolean;// 是否压缩脚本
    xxteaKey?: string;// xxtea 加密的 key 值
    params?: any; // console 需要的参数
    JobSystem: 'none' | 'tbb' | 'taskFlow';
    serverMode: boolean;
    netMode: NetMode;
}

export interface IBuildCache extends InternalBuildResult {
    userFrameWorks: boolean; // 是否使用用户的配置数据
}
