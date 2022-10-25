/// <reference path='../../../@types/index'/>
export * from '@editor/library-type/packages/builder/@types/protect';
import { IInternalBuildOptions, InternalBuildResult, IPolyFills, IBuildScriptParam } from '@editor/library-type/packages/builder/@types/protect';
import { CocosParams } from 'native-pack-tool';

declare enum NetMode {
    client = 0,
    hostServer = 1,
    listenServer = 2,
}
export interface ITaskOptionPackages {
    native: IOptions;
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
    engine?: string;
    runAfterMake: boolean;
    encrypted: boolean;// 是否加密脚本
    compressZip: boolean;// 是否压缩脚本
    xxteaKey?: string;// xxtea 加密的 key 值
    params?: CocosParams; // console 需要的参数
    JobSystem: 'none' | 'tbb' | 'taskFlow';
    serverMode: boolean;
    netMode: NetMode;
}

export interface IBuildCache extends InternalBuildResult {
    userFrameWorks: boolean; // 是否使用用户的配置数据
}
