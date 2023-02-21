const WORKER_FLAG = "?worker";
const getResolveUrl = (path, joinFn) => `${joinFn}(${path})`;
/**
 * 提供rollup对nodejs的worker_threads的支持
 */
function rollupPluginWorker() {
  let opts;
  return {
    name: "cocos-plugin-worker",
    buildStart(config) {
      opts = config;
    },
    resolveId(source, importer) {
      if (source.endsWith(WORKER_FLAG)) {
        // 基于importer获取实际的文件路径
        return this.resolve(
          source.slice(0, source.length - WORKER_FLAG.length),
          importer
        ).then((resolvedId) => resolvedId.id + WORKER_FLAG);
      }
    },
    async load(id) {
      if (id.endsWith(WORKER_FLAG)) {
        const finialId = id.slice(0, id.length - WORKER_FLAG.length);
        const referenceId = this.emitFile({
          type: "chunk",
          id: finialId
        });
        // 虚拟模块，导出文件的路径
        return `export default import.meta.ROLLUP_FILE_URL_${referenceId};`;
      }
    },
    // 自定义import.meta.ROLLUP_FILE_URL_{referenceId}的生成，对cjs特殊处理,默认会以file:///开头
    resolveFileUrl({ relativePath, format }) {
      if (format === "cjs") {
        return getResolveUrl(
          `__dirname + '/${relativePath}'`,
          `(require('path').join)`
        );
      }
    }
  };
}
export default rollupPluginWorker;