type IBaseHooks = (options: IBuildTaskOptions, result?: IBuildResult) => void | Promise<void>;

export namespace BuildHook {
  export type throwError = boolean;
  export type title = string;
  export type onBeforeBuild = IBaseHooks;
  export type onBeforeCompressSettings = IBaseHooks;
  export type onAfterCompressSettings = IBaseHooks;
  export type onAfterBuild = IBaseHooks;
  export type load = () => Promise<void> | void;
  export type unload = () => Promise<void> | void;
}