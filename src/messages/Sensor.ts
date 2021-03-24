export class Sensor {
  private _currentTemperature : number;
  public get currentTemperature() : number {
    return this._currentTemperature;
  }
  public set currentTemperature(v : number) {
    this._currentTemperature = v;
  }

  constructor() {
    this._currentTemperature = 0;
  }

}
