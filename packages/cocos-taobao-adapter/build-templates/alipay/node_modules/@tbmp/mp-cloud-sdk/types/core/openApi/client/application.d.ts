import {ICloudService} from "../../interface/cloudService";

export default class Application extends ICloudService {

  httpRequest(options: {path: string, params?: any, body?: any, headers?: any, method?: string, exts?: any}): Promise<any>;
  
}
