import { ZoneStatus } from "./enums/ZoneStatus"

export class Zone {
   private _touchPadTemperature : number;
   public get touchPadTemperature() : number {
     return this._touchPadTemperature;
   }
   public set touchPadTemperature(v : number) {
     this._touchPadTemperature = v;
   }

   private _name : string;
   public get name() : string {
     return this._name;
   }
   public set name(v : string) {
     this._name = v;
   }

   private _id : number;
   public get id() : number {
     return this._id;
   }
   public set id(v : number) {
     this._id = v;
   }

   private _status : ZoneStatus;
   public get status() : ZoneStatus {
     return this._status;
   }
   public set status(v : ZoneStatus) {
     this._status = v;
   }

   private _desiredTemperature : number;
   public get desiredTemperature() : number {
     return this._desiredTemperature;
   }
   public set desiredTemperature(v : number) {
     this._desiredTemperature = v;
   }

   constructor(touchPadTemperature : number) {
       this.touchPadTemperature = touchPadTemperature;
   }
}
