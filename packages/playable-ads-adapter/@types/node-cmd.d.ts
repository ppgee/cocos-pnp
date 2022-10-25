declare module 'node-cmd' {
  export function run(command: string, callback: (err: any, data: any, stderr: any) => void): ChildProcess
  export function runSync(command: any): {
    data: string;
    err: null;
    stderr: null;
  } | {
    data: null;
    err: any;
    stderr: any;
  }
};