import { Zone } from "./Zone"
import { Sensor } from "./Sensor"
import { AcMode } from "./enums/AcMode"

export class Aircon {
  private _zones : Array<Zone>;
  public get zones() : Array<Zone> {
    return this._zones;
  }
  public set zones(v : Array<Zone>) {
    this._zones = v;
  }

  private _status : boolean;
  public get status() : boolean {
    return this._status;
  }
  public set status(v : boolean) {
    this._status = v;
  }

  constructor() {
    this._zones = new Array<Zone>();
    this._status = false;
    this._roomTemperature = 0;
    this._desiredTemperature = 0;
    this._mode = AcMode.AUTO;
  }

  private _roomTemperature : number;
  public get roomTemperature() : number {
    return this._roomTemperature;
  }
  public set roomTemperature(v : number) {
    this._roomTemperature = v;
  }

  private _desiredTemperature : number;
  public get desiredTemperature() : number {
    return this._desiredTemperature;
  }
  public set desiredTemperature(v : number) {
    this._desiredTemperature = v;
  }

  private _mode : AcMode;
  public get mode() : AcMode {
    return this._mode;
  }
  public set mode(v : AcMode) {
    this._mode = v;
  }

}
