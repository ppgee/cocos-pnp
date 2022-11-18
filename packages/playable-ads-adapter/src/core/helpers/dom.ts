import { CheerioAPI } from "cheerio"
import { getAdapterRCJson } from "@/core/utils"

export const injectFromRCJson = async ($: CheerioAPI, channel: TChannel) => {
  const adapterJson = getAdapterRCJson()
  if (!adapterJson || !adapterJson.injectOptions || !adapterJson.injectOptions[channel]) {
    return
  }

  const { head, body } = adapterJson.injectOptions[channel]
  if (head) {
    $(head).appendTo('head')
  }

  if (body) {
    $('body script').first().before(body)
  }
}