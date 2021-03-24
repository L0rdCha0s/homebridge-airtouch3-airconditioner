import { Zone } from "./Zone"
import { Sensor } from "./Sensor"

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
  }


}
