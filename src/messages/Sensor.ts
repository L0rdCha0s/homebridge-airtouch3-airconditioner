export class Sensor {
  private _currentTemperature : number;
  public get currentTemperature() : number {
    return this._currentTemperature;
  }
  public set currentTemperature(v : number) {
    this._currentTemperature = v;
  }

  private _isAvailable : boolean;
  public get isAvailable() : boolean {
    return this._isAvailable;
  }

  public set isAvailable(_isAvailable : boolean) {
    this._isAvailable = _isAvailable;
  }

  constructor() {
    this._currentTemperature = 0;
    this._isAvailable = false;
  }

}
