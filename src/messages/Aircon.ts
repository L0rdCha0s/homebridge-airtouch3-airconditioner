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

  private _sensors : Array<Sensor>;
  public get sensors() : Array<Sensor> {
    return this._sensors;
  }
  public set sensors(v : Array<Sensor>) {
    this._sensors = v;
  }

  private _status : boolean;
  public get status() : boolean {
    return this._status;
  }
  public set status(v : boolean) {
    this._status = v;
  }

  private _fanSpeed : number;
  public get fanSpeed() : number {
    return this._fanSpeed;
  }
  public set fanSpeed(v : number) {
    this._fanSpeed = v;
  }

  constructor() {
    this._zones = new Array<Zone>();
    this._sensors = new Array<Sensor>();
    this._status = false;
    this._roomTemperature = 0;
    this._desiredTemperature = 0;
    this._brandId = 0;
    this._mode = AcMode.AUTO;
    this._fanSpeed = 0;
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

  private _brandId : number;
  public get brandId() : number {
    return this._brandId;
  }
  public set brandId(v : number) {
    this._brandId = v;
  }
}
