export interface ICacheObject {
    [k: string]: Map<string, any> | ICacheObject;
  }
  