declare namespace Editor {
  type ListenEvent =
    | 'before-change-files'
    | 'build-start'
    | 'build-finished'

  type IpcMsgEvent =
    /** 编译状态更新时，发送的消息 */
    | 'builder:state-changed'
    /** 查看构建的选项 */
    | 'builder:query-build-options'
    /** 开始构建任务 */
    | 'builder:start-task'

  const Builder: {
    on(event: ListenEvent, eventFn: (options: any, callback: () => void) => void)
  };
  function log(message?: any, ...optionalParams: any[]): void
  function error(message?: any, ...optionalParams: any[]): void
  function fatal(message?: any, ...optionalParams: any[]): void
  function failed(message?: any, ...optionalParams: any[]): void
  function info(message?: any, ...optionalParams: any[]): void
  function success(message?: any, ...optionalParams: any[]): void
  function warn(message?: any, ...optionalParams: any[]): void
}