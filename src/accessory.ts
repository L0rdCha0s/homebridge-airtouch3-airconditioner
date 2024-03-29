import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  Characteristic,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service,
} from "homebridge";

import net from "net"
import {PromiseSocket, TimeoutError} from "promise-socket"
import PromiseWritable from "promise-writable"
import { AirTouchMessage } from "./messages/AirTouchMessage";
import { MessageResponseParser } from "./messages/MessageResponseParser"
import { Aircon } from "./messages/Aircon"
import { AcMode } from "./messages/enums/AcMode"

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("homebridge-airtouch3-airconditioner", Airtouch3Airconditioner);
};

class Zone {
  public zoneId: number;
  public zoneName: string;
  public zoneSwitch: Service;

  constructor(id: number, name: string) {
    this.zoneId = id;
    this.zoneName = name;
    this.zoneSwitch = new hap.Service.Switch(name, name.replace(" ",""));
  }
}

class Queue<T extends AirTouchMessage> {
  _store: T[] = [];
  push(val: T) {
    this._store.push(val);
  }
  pop(): T | undefined {
    return this._store.shift();
  }

  clearTemps() {
    var i = this._store.length;
    while (i--) {
      if (this._store[i].isTemp) this._store.splice(i,1);
    }
  }
}


class Airtouch3Airconditioner implements AccessoryPlugin {

  private readonly log: Logging;
  private antiFlap: boolean = false;
  private socket: net.Socket = new net.Socket();
  private promiseSocket: PromiseSocket<net.Socket> = new PromiseSocket(this.socket);
  private readonly name: string;
  private zoneSwitches: Array<Zone>
  private switchOn = false;
  private coolingTemperature = 24;
  private heatingTemperature = 15;
  private connected : boolean = false;
  private airConId = 0;
  private airtouchHost : string;
  private airtouchPort : number = 8899;
  private aircon: Aircon | undefined;
  private commandQueue = new Queue<AirTouchMessage>();
  private api: API;

  private readonly service: Service;
  private readonly fanService: Service;
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;

    this.api = api;

    this.zoneSwitches = new Array<Zone>();
    if (config.airConId) {
      this.log.debug("Selecting override airconditioner ID: " + config.airConId);
      this.airConId = config.airConId;
    }
    this.airtouchHost = config.airtouchHost;
    if (config.airtouchPort) this.airtouchPort = config.airtouchPort;


    // create a new Heater Cooler service
    this.service = new hap.Service.HeaterCooler(this.name);

    // create handlers for required characteristics
    this.service.getCharacteristic(hap.Characteristic.Active)
    .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      this.handleActiveGet(callback);
    })
    .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
      this.handleActiveSet(callback, value as string);
    })


    this.service.getCharacteristic(hap.Characteristic.CurrentHeaterCoolerState)
    .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      this.handleCurrentHeaterCoolerStateGet(callback);
    })

    this.service.getCharacteristic(hap.Characteristic.TargetHeaterCoolerState)
    .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      this.handleTargetHeaterCoolerStateGet(callback);
    })
    .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
      this.handleTargetHeaterCoolerStateSet(callback, value as string);
    })

    //Temperatures
    this.service.getCharacteristic(hap.Characteristic.CurrentTemperature)
    .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      this.handleCurrentTemperatureGet(callback);
    })


    this.service.getCharacteristic(hap.Characteristic.CoolingThresholdTemperature)
    .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      this.handleCoolingTemperatureGet(callback);
    })
    .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
      this.handleCoolingTemperatureSet(callback, value as string);
    })

    this.service.getCharacteristic(hap.Characteristic.HeatingThresholdTemperature)
    .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      this.handleHeatingTemperatureGet(callback);
    })
    .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
      this.handleHeatingTemperatureSet(callback, value as string);
    })

    this.fanService = new hap.Service.Fan(this.name + " fan");

    let rotationSpeed = this.fanService.getCharacteristic(hap.Characteristic.RotationSpeed)
    if (rotationSpeed == undefined) {
      rotationSpeed = this.fanService.addCharacteristic(hap.Characteristic.RotationSpeed)
    }

    rotationSpeed
    .setProps({ minValue: 0, maxValue: 3, minStep: 1 })
    .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        if (this.aircon != undefined) {
          let speed = this.aircon!.fanSpeed;
          callback(undefined, speed.toString());
        } else {
          callback(undefined, "0");
        }
    })
    .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.log.info("Setting fan speed to " + value);
        this.setFanSpeed(Number(value));
        callback(undefined);
    })

    this.fanService.getCharacteristic(hap.Characteristic.On)
    .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(undefined, true);
    })
    .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        callback(undefined);
    })

    //zones
    //Get zone list via API first, then create one switch per zone
    config.zones.map((zone : any) => {
      let objZone = new Zone(zone.zoneId, zone.name);

      objZone.zoneSwitch.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {

        if (this.aircon != undefined) {

          let zoneObj = this.aircon!.zones[zone.zoneId];
          if (zoneObj != undefined) {
            let activeState = zoneObj.status;
            this.log.debug("Zone status for '" + zone.name + "' from API is: " + activeState);
            if (activeState) {
              callback(undefined, true);
            } else {
              callback(undefined, false);
            }
          } else {
            this.log.info("Invalid zone id: " + zone.zoneId);
          }
        } else {
          this.log.info("No current status from aircon, assuming zone is off");
          callback(undefined, false);
        }
      })
      .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        log.info("Zone '" + zone.name + "' state was set to: " + value);

        if (this.aircon != undefined) {
          let currentState = this.aircon!.zones[zone.zoneId].status;
          if (value) {
            if (currentState) {
              //No OP.
              this.log.info("Zone " + zone.zoneId + " already on");
            } else {
              this.sendToggleZone(zone.zoneId);
            }
          } else {
            if (!currentState) {
              this.log.info("Zone " + zone.zoneId + " already off");
            } else {
              this.sendToggleZone(zone.zoneId);
            }
          }
        } else {
          this.log.info("Waiting for state from airconditioner");
        }
        callback(undefined);
      });

      this.zoneSwitches.push(objZone);
    })


    this.informationService = new hap.Service.AccessoryInformation()
    .setCharacteristic(hap.Characteristic.Manufacturer, "AirTouch")
    .setCharacteristic(hap.Characteristic.Model, "v3");

    log.info("Switch finished initializing!");


    //Start outbound command queue runner
    setInterval(async () => {
      if (this.connected == true) {
        let message = this.commandQueue.pop();
        if (message != undefined) {

          try {
            const total = await this.promiseSocket.write(Buffer.from(message.buffer.buffer));
            this.log.debug("Bytes written: " + total);
          } catch (e) {
            this.log.info("Error writing to socket - closing");
            this.connected = false;
          }
        } else {
          this.log.debug("No outbound commands to run on airtouch");
        }
      } else {
        this.log.debug("Can't process AirTouch command queue: not connected");
      }
    }, 1000);


    //Now, connect to airtouch..
    this.connectToServer();
  }


  /**
  * Handle requests to get the current value of the "Active" characteristic
  */
  handleActiveGet(callback: Function) : void {
    this.log.debug('Triggered GET Active');

    if (this!.aircon != undefined) {
      if (this.aircon!.status) {
        callback(undefined, hap.Characteristic.Active.ACTIVE);
      } else {
        callback(undefined, hap.Characteristic.Active.INACTIVE);
      }
    } else {
      callback(undefined, hap.Characteristic.Active.INACTIVE);
    }
  }

  /**
  * Handle requests to set the "Active" characteristic
  */
  async handleActiveSet(callback: Function, value: string) : Promise<void> {
    this.log.debug('Triggered SET Active:' + value);

    if (!this.antiFlap) {
      if (value == "1") {
          if (!this.aircon!.status) {
            await this.sendToggleAC();
            this.log.debug("Air Conditioner turn on");
          } else {
            this.log.debug("Air Conditioner already on!");
          }
      } else {
        if (this.aircon!.status) {
          await this.sendToggleAC();
          this.log.debug("Air Conditioner turn off");
        } else {
          this.log.debug("Air Conditioner already off!");
        }
      }

      this.antiFlap = true;
      setTimeout(() => {
          this.antiFlap = false;
      }, 2000);
    } else {
      this.log.info("Anti-flap triggered");
    }

    callback();

    // this.log.info(this.stackTrace());
  }

  /**
  * Handle requests to get the current value of the "Current Heater-Cooler State" characteristic
  */
  handleCurrentHeaterCoolerStateGet(callback: Function) : void {
    this.log.debug('Triggered GET CurrentHeaterCoolerState');


    if (this.aircon != undefined) {
      let mode = this.aircon.mode;
      let modeCallback : any = mode;

      if (mode == AcMode.COOL) {
        modeCallback = this.api.hap.Characteristic.CurrentHeaterCoolerState.COOLING; //Airtouch modes overlap 1-1, except for cool -which is '2' not '4'
      } else if (mode == AcMode.HEAT) {
        modeCallback = this.api.hap.Characteristic.CurrentHeaterCoolerState.HEATING;
      }
      callback(undefined, modeCallback);
    } else {
      this.log.debug("No aircon state currently, returning 0");
      callback(undefined, hap.Characteristic.TargetHeaterCoolerState.AUTO);
    }

  }


  /**
  * Handle requests to get the current value of the "Target Heater-Cooler State" characteristic
  */
  handleTargetHeaterCoolerStateGet(callback: Function) : void {
    this.log.debug('Triggered GET TargetHeaterCoolerState');

    if (this.aircon != undefined) {
      let mode = this.aircon.mode;
      let modeCallback : any = mode;

      if (mode == AcMode.COOL) {
        modeCallback = this.api.hap.Characteristic.TargetHeaterCoolerState.COOL;
      } else if (AcMode.HEAT) {
        modeCallback = this.api.hap.Characteristic.TargetHeaterCoolerState.HEAT;
      }
      callback(undefined, modeCallback);
    } else {
      this.log.debug("No aircon state currently, returning 0");
      callback(undefined, hap.Characteristic.TargetHeaterCoolerState.AUTO);
    }

  }

  /**
  * Handle requests to set the "Target Heater-Cooler State" characteristic
  */
   handleTargetHeaterCoolerStateSet(callback: Function, value: string) : void {
    this.log.debug('Triggered SET TargetHeaterCoolerState:' + value);

    this.setMode(Number(value));
    callback(undefined);
  }

  /**
  * Handle requests to get the current value of the "Current Temperature" characteristic
  */
  handleCurrentTemperatureGet(callback: Function) : void {
    this.log.debug('Triggered GET CurrentTemperature');
    if (this.aircon != undefined) {
      callback(undefined, this.aircon.roomTemperature);
    } else {
      this.log.debug("No aircon state currently, returning 0");
      callback(undefined, 0);
    }
  }

  handleCoolingTemperatureGet(callback: Function) : void {
    this.log.debug('Triggered GET CoolingTemperature');

    if (this.aircon != undefined) {
      callback(undefined, this.aircon.desiredTemperature);
    } else {
      this.log.debug("No aircon state currently, returning 0");
      callback(undefined, 0);
    }

  }

  handleHeatingTemperatureGet(callback: Function) : void {
    this.log.debug('Triggered GET HeatingTemperature');

    if (this.aircon != undefined) {
      callback(undefined, this.aircon.desiredTemperature);
    } else {
      this.log.debug("No aircon state currently, returning 0");
      callback(undefined, 0);
    }
  }

  handleCoolingTemperatureSet(callback: Function, value: string) : void {
    this.log.debug('Triggered SET TargetCoolingTemperatureSET:' + value);

    if (this.aircon != undefined) {
      this.setTargetTemperature(Number(value), callback);
    } else {
      this.log.debug("No aircon state currently, returning 0");
      callback(undefined, 0);
    }
  }

  handleHeatingTemperatureSet(callback: Function, value: string) : void {
    this.log.debug('Triggered SET HeatingTemperature:' + value);

    if (this.aircon != undefined) {
      this.setTargetTemperature(Number(value), callback);
    } else {
      this.log.debug("No aircon state currently, returning 0");
      callback(undefined, 0);
    }
  }


  async setTargetTemperature(temperature: number, callback: Function) : Promise<number> {
    this.log.debug('Setting target temperature: ' + temperature);

    //Clear temperatures, as we're about to change them all
    this.commandQueue.clearTemps();

    //Callback before working on it, because it may take a while and hit homekit's response time limit
    callback(undefined);

    //First get current zone temps
    if (this.aircon != undefined) {
      let zoneCount = this.aircon!.zones.length;

      var temps = new Array<number>();
      for (let i = 0; i < zoneCount; i++ ) {
        temps[i] = this.aircon!.zones[i].desiredTemperature;
      }
      this.log.debug("Zone temps: ");
      temps.map(x => this.log.debug("Temp: " + x));

      for (var j = 0; j < zoneCount; j++) {
        let diff = Math.abs(temps[j] - temperature);
        let incDec = -1;
        if (temps[j] < temperature) incDec = 1;

        for (var i = 0; i < diff; i++) {
          await this.sendZoneTemp(j,incDec);
        }
        this.log.debug("-- End Zone --");
      }
    } else {
      this.log.info("Cannot set temperature before air conditioner responds with status");
    }

    return temperature;
  }
  /*************************************************/


  /*
  * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
  * Typical this only ever happens at the pairing process.
  */
  identify(): void {
    this.log("Identify!");
  }

  /*
  * This method is called directly after creation of this instance.
  * It should return all services which should be added to the accessory.
  */
  getServices(): Service[] {
    let serviceArray = new Array<Service>();
    serviceArray.push(this.informationService);
    serviceArray.push(this.fanService);
    serviceArray.push(this.service);

    //Add zone switches..
    this.zoneSwitches.map(zone => serviceArray.push(zone.zoneSwitch));

    return serviceArray;
  }

  async connectToServer() : Promise<void> {

    this.log.info("Connecting to airtouch at : " + this.airtouchHost + ":" + this.airtouchPort);

    // this.promiseSocket.setTimeout(3000);
    try {
      await this.promiseSocket.connect(this.airtouchPort, this.airtouchHost)
    } catch (e) {
        this.log.info("Socket timeout: couldn't connect to " + this.airtouchHost + ":" + this.airtouchPort);
        this.log.info((<Error>e).message);//conversion to Error type
        this.connected = false;
        return;
    }

    this.log.info("Connected to airtouch at " + this.airtouchHost + ":" + this.airtouchPort);
    this.connected = true;

    this.socket.on('data', (data) => {
      this.log.debug('Received: ' + data.length);

      let messageResponseParser = new MessageResponseParser(new Int8Array(data.buffer), this.log);
      this.aircon = messageResponseParser.parse();
    });

    this.socket.on('close', async (e) => {
      this.log.debug("********** AirTouch3 disconnected, reconnecting..");
      this.connected = false;
    });

    //Timer to reconnect
    setInterval(async() => {
	if (this.connected == false) {
          this.log.info("Reconnecting to airtouch..");
          await this.promiseSocket.connect(this.airtouchPort, this.airtouchHost);
	} else {
	  this.log.debug("Connected to airtouch already");
	}


    }, 10000);

    //Timer to send init message
    setInterval(async () => {
        await this.sendInit();
    }, 60000);

    //Send an initial handshake
    await this.sendInit();

  }

  async sendInit() {
    this.log.debug("Sending init..");
    let bufferTest = new AirTouchMessage(this.log);
    bufferTest.getInitMsg();
    bufferTest.printHexCode();

    this.commandQueue.push(bufferTest);
  }

  async sendToggleAC() {
    this.log.info("Sending AC toggle..");
    let bufferTest = new AirTouchMessage(this.log);
    bufferTest.toggleAcOnOff(this.airConId);
    bufferTest.printHexCode();
    this.commandQueue.push(bufferTest);

  }

  async sendToggleZone(zoneId: number) {
    this.log.info("Sending Zone toggle..");
    let bufferTest = new AirTouchMessage(this.log);
    bufferTest.toggleZone(zoneId);
    bufferTest.printHexCode();
    this.commandQueue.push(bufferTest);

  }

  async sendZoneTemp(zoneId: number, incDec: number) {
    this.log.info("Sending temp change to zone..");
    let bufferTest = new AirTouchMessage(this.log);
    bufferTest.setFan(zoneId, incDec);
    bufferTest.printHexCode();
    bufferTest.isTemp = true;
    this.commandQueue.push(bufferTest);

  }

  async setMode(mode: number) {
    this.log.info("Sending AC mode to " + mode);
    let bufferTest = new AirTouchMessage(this.log);
    bufferTest.setMode(this.airConId, this.aircon!.brandId, mode);
    bufferTest.printHexCode();
    this.commandQueue.push(bufferTest);

  }

  async setFanSpeed(speed: number) {
    this.log.info("Sending AC fan speed to " + speed);

    let bufferTest = new AirTouchMessage(this.log);
    bufferTest.setFanSpeed(this.airConId, this.aircon!.brandId, speed);
    bufferTest.printHexCode();
    this.commandQueue.push(bufferTest);
  }

   stackTrace() {
    var err = new Error();
    return err.stack;
   }
}