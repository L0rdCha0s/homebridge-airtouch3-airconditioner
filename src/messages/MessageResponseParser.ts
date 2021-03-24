import { MessageConstants } from "./MessageConstants"
import { ZoneStatus } from "./enums/ZoneStatus"
import { Zone } from "./Zone"
import { Aircon } from "./Aircon"

export class MessageResponseParser {
  readonly GroupNameStart : number = 104;
  readonly ZoneDataStart : number = 232;
  readonly GroupPercentageDataStart = 248;
  readonly GroupDataStart = 264;
  readonly GroupSettingStart = 296;
  readonly NumberOfZones = 352;
  readonly SystemNameStart = 383;
  readonly AirconStatus = 423;
  readonly AirconBrandId = 425;
  readonly AirconMode = 427;
  readonly FanSpeed = 429;
  readonly DesiredTemperature = 431;
  readonly RoomTemperature = 433;
  readonly AirconId = 439;
  readonly ThermostatMode = 441;
  readonly TouchpadGroupId = 443;
  readonly TouchpadTemperature = 445;
  readonly SensorDataStart = 451;
  readonly AirTouchIdStart = 483;

  responseBuffer: Int8Array;

  constructor(responseBuffer: Int8Array) {
    this.responseBuffer = responseBuffer;
  }

  private isPrint(aChar) : boolean {
      let myCharCode = aChar.charCodeAt(0);

      if((myCharCode > 31) && (myCharCode <  127))
      {
         return true;
      }

      return false;
  }

  private fromBytesInt32(arr) : number {
    var result=0;
    for (let i=3;i>=0;i--) {
        console.log("Byte is: " + arr[i]);
        result+=arr[3-i]<<(8*i);
    }
    return result;
  };

  private dec2bin(dec) : string {
   return (dec >>> 0).toString(2);
  }

  public parse() {
    console.log("Length of response: " + this.responseBuffer.length);

    let aircon = new Aircon();


    // for (let i = 0; i < this.responseBuffer.length; i++)
    // {
    //   console.log( (i) + ": " + this.responseBuffer[i]);
    // }

    //Get unit id
    console.log("AC id is: " + this.responseBuffer[this.AirconId]);

    //Running status..
    aircon.status = this.responseBuffer[this.AirconStatus] >> 7 ? true : false;
    console.log("AC Status is: " + aircon.status);

    //Get unit name
    let unitName = "";
    for (let i = 0; i < 16; i++)
    {
        unitName += String.fromCharCode(this.responseBuffer[this.SystemNameStart + i]);
    }
    console.log("Unit name is: ''" + unitName + "'");

    this.parseZones();
  }

  public parseZones() : Array<Zone> {
     let zoneData = new Int8Array(16);
     let groupData = new Int8Array(16);
     let groupNames = new Int8Array(128);
     let zoneNames = new Int8Array(127);
     let groupSetting = new Int8Array(16);

     for (let i = 0;i<16;i++) {
       zoneData[i] = this.responseBuffer[this.ZoneDataStart + i];
       // console.log("Binary is: " + zoneData[i]);
     }
     for (let i = 0;i<16;i++) {
       groupData[i] = this.responseBuffer[this.GroupDataStart + i];
     }

     for (let i = 0; i < 128; i++)
     {
        groupNames[i] = this.responseBuffer[this.GroupNameStart + i];
     }

     for (let i = 0; i <= 127; i++)
     {
        zoneNames[i] = groupNames[i];
     }

     for (let i = 0; i <= 15; i++)
     {
        groupSetting[i] = this.responseBuffer[this.GroupSettingStart + i];
     }

     let zones = new Array<Zone>();
     let numberOfZones = this.responseBuffer[this.NumberOfZones];
     console.log("Number of zones: " + numberOfZones);

     for (let i = 0; i < numberOfZones; i++) {
        let zone = new Zone(0);

        let zoneName = "";
        for (let x = i * 8; x < (i + 1) * 8; x++) {
            let char = groupNames[x];
            zoneName += String.fromCharCode(char);
        }

        //Discard lowest order bit (240 == 11110000), by performing binary and and bit-shifting right 4 bits
        let startZone = (groupData[i] & 240) >> 4;
        console.log("Start zone: " + startZone);

        //We only want highest bit, so dec->bin, highest-significant-bit binary and, shift 7
        zone.status = ((zoneData[startZone] + 256) & 128) >> 7 ? ZoneStatus.ZoneOn : ZoneStatus.ZoneOff;

        zone.name = zoneName;
        console.log("Zone " + i + " name is '" + zoneName + "' and status is: " + zone.status);

        // zone.desiredTemperature = Convert.ToInt32(groupSetting[i].JavaStyleSubstring(3, 8), 2) + 1;
        zone.desiredTemperature = (groupSetting[i] & 31) + 1;
        console.log("Desired temperature: " + zone.desiredTemperature);

     }

     return zones;
  }
}
