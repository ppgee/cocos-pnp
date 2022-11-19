import { TWebOrientations } from '@/global'

export type TChannel =
  | 'AppLovin'
  | 'Facebook'
  | 'Google'
  | 'IronSource'
  | 'Liftoff'
  | 'Mintegral'
  | 'Moloco'
  | 'Pangle'
  | 'Rubeex'
  | 'Tiktok'
  | 'Unity'


export type TChannelPkgOptions = {
  orientation: TWebOrientations
  zipRes?: { [key: string]: string }
  notZipRes?: { [key: string]: string }
}