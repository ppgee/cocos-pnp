import { IBuildResult, IBuildTaskOption } from "~types/packages/builder/@types";
import { initBuildFinishedEvent, initBuildStartEvent } from "@/extensions/builder/3x";

export function onBeforeBuild(options: IBuildTaskOption) {
  console.log(options)
  initBuildStartEvent(options)
}

export function onAfterBuild(options: IBuildTaskOption, _result: IBuildResult) {
  console.log(options)
  initBuildFinishedEvent(options)
}