import { MessageConstants } from "./MessageConstants"
import { ZoneStatus } from "./enums/ZoneStatus"
import { Zone } from "./Zone"
import { Aircon } from "./Aircon"
import { AcMode } from "./enums/AcMode"

import {
  Logging
} from "homebridge";
import { Sensor } from "./Sensor"

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
  log: Logging

  constructor(responseBuffer: Int8Array, log: Logging) {
    this.responseBuffer = responseBuffer;
    this.log = log;
  }

  private isPrint(aChar : string) : boolean {
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
        this.log.info("Byte is: " + arr[i]);
        result+=arr[3-i]<<(8*i);
    }
    return result;
  };

  private dec2bin(dec) : string {
   return (dec >>> 0).toString(2);
  }

  private print8BitBinary(value) {
    let binary = (value & 0xFF).toString(2); // Mask to 8 bits and convert to binary
    return binary.padStart(8, '0'); // Pad with zeros to ensure 8 digits
  }

  public parse() : Aircon {
    this.log.debug("Length of response: " + this.responseBuffer.length);

    let aircon = new Aircon();


    // for (let i = 0; i < this.responseBuffer.length; i++)
    // {
    //   log.info( (i) + ": " + this.responseBuffer[i]);
    // }

    //Get unit id
    this.log.debug("AC id is: " + this.responseBuffer[this.AirconId]);

    //Running status..
    aircon.status = this.responseBuffer[this.AirconStatus] >> 7 ? true : false;
    this.log.info("AC Status is: " + aircon.status);

    //Get unit name
    let unitName = "";
    for (let i = 0; i < 16; i++)
    {
        unitName += String.fromCharCode(this.responseBuffer[this.SystemNameStart + i]);
    }
    this.log.debug("Unit name is: ''" + unitName + "'");

    //All except most significant bit
    aircon.desiredTemperature = this.responseBuffer[this.DesiredTemperature] & 127;

    //Get mode - all except most significant bit
    let mode = this.responseBuffer[this.AirconMode] & 127;
    switch (mode) {
      case 0: aircon.mode = AcMode.AUTO; break;
      case 1: aircon.mode = AcMode.HEAT; break;
      case 4: aircon.mode = AcMode.COOL; break;

      //Homekit doesn't handle 'DRY' or 'FAN' - pretend we're in 'AUTO'
      default: aircon.mode = AcMode.AUTO; break;
    }

    aircon.brandId = this.responseBuffer[this.AirconBrandId];
    this.log.debug("Air conditioner brand id is: " + aircon.brandId);

    //Fan speed
    aircon.fanSpeed = this.responseBuffer[this.FanSpeed] & 15;
    switch (aircon.fanSpeed)
    {
        case 0:
            aircon.fanSpeed = 0;
            break;
        case 4:
            aircon.fanSpeed = 0;
            break;
    }

    this.log.debug("Fan speed is set to " + aircon.fanSpeed);

    //Get sensors..
    aircon.sensors = this.parseSensors();

    aircon.zones = this.parseZones(aircon);

    let roomTemperature = 0;
    let roomTemperatureZones = 0;
    for (let i=0;i<aircon.zones.length; i++) {
      if (aircon.zones[i].sensor && aircon.zones[i].sensor?.isAvailable) {
        roomTemperatureZones++;
        roomTemperature += aircon.zones[i].sensor!.currentTemperature;

      } else {
        this.log.debug(`Zone ${i} doesn't have a sensor`);
      }
    }
    aircon.roomTemperature = 1.0 * roomTemperature / roomTemperatureZones;
    this.log.info("Room temperature is: " + aircon.roomTemperature);


    return aircon;
  }

  parseSensors(): Array<Sensor> {
    const sensors = new Array<Sensor>();
      for (let i = 0; i < 32; i++) {
        const sensor = new Sensor();

        
        this.log.debug(`Sensor ${i} : ` + this.print8BitBinary(this.responseBuffer[this.SensorDataStart + i]));
        const binValue = this.print8BitBinary(this.responseBuffer[this.SensorDataStart + i]);

        //Temperature - bits 3-8
        const temp = parseInt(binValue.slice(2),2);
        this.log.debug(`Sensor ${i} temp is ` + temp);

        sensor.currentTemperature = temp;
        sensor.isAvailable = binValue.charAt(0) == '1';

        this.log.debug(`Sensor ${i} IsAvailable: ${sensor.isAvailable}`);
        sensors.push(sensor);
      }

      return sensors;
  }

  public parseZones(aircon: Aircon) : Array<Zone> {
     let zoneData = new Int8Array(16);
     let groupData = new Int8Array(16);
     let groupNames = new Int8Array(128);
     let zoneNames = new Int8Array(127);
     let groupSetting = new Int8Array(16);

     for (let i = 0;i<16;i++) {
       zoneData[i] = this.responseBuffer[this.ZoneDataStart + i];
       // log.info("Binary is: " + zoneData[i]);
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
     this.log.info("Number of zones: " + numberOfZones);



     for (let i = 0; i < numberOfZones; i++) {
        let zone = new Zone(0);

        if (aircon.sensors[i].isAvailable) {
          zone.sensor = aircon.sensors[i];
        } else if (aircon.sensors[i+1].isAvailable) {
          zone.sensor = aircon.sensors[i+1];
        }
         

        let zoneName = "";
        for (let x = i * 8; x < (i + 1) * 8; x++) {
            let char = groupNames[x];
            zoneName += String.fromCharCode(char);
        }

        //Discard lowest order bit (240 == 11110000), by performing binary and and bit-shifting right 4 bits
        let startZone = (groupData[i] & 240) >> 4;
        this.log.debug("Start zone: " + startZone);

        //We only want highest bit, so dec->bin, highest-significant-bit binary and, shift 7
        zone.status = ((zoneData[startZone] + 256) & 128) >> 7 ? ZoneStatus.ZoneOn : ZoneStatus.ZoneOff;

        zone.name = zoneName;
        this.log.debug("Zone " + i + " name is '" + zoneName + "' and status is: " + zone.status);

        // zone.desiredTemperature = Convert.ToInt32(groupSetting[i].JavaStyleSubstring(3, 8), 2) + 1;
        zone.desiredTemperature = (groupSetting[i] & 31) + 1;
        this.log.debug("Desired temperature: " + zone.desiredTemperature);

        zones.push(zone);

     }

     return zones;
  }
}
