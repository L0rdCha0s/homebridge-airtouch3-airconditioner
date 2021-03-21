import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";

import axios, { AxiosRequestConfig, AxiosResponse, AxiosPromise } from 'axios';

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("homebridge-airtouch3-airconditioner", Airtouch3Airconditioner);
};

class Zone {
  public zoneId: number;
  public zoneName: string;
  public zoneSwitch: Service.Switch;

}

class Airtouch3Airconditioner implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private readonly apiRoot: string
  private zoneSwitches: Array<Zone>
  private switchOn = false;
  private coolingTemperature = 24;
  private heatingTemperature = 15;
  private airConId = 0;

  private readonly service: Service;
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;
    this.apiRoot = config.apiRoot;
    if (config.airConId) {
        this.log.debug("Selecting override airconditioner ID: " + config.airConId);
	      this.airConId = config.airConId;
    }


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

    //zones
    //Get zone list via API first, then create one switch per zone
   config.zones.map(zone => {
      let objZone = new Zone;
      objZone.zoneId = zone.zoneId;
      objZone.zoneName = zone.zoneName;
      objZone.zoneSwitch = new hap.Service.Switch(objZone.zoneName);

      objZone.zoneSwitch.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("Current state of the switch was returned: ");
        callback(undefined, true);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        log.info("Switch state was set to: " );
        callback();
      });

      this.zones.push(objZone);
   })


    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "AirTouch")
      .setCharacteristic(hap.Characteristic.Model, "v3");

    log.info("Switch finished initializing!");
  }


   /**
   * Handle requests to get the current value of the "Active" characteristic
   */
  handleActiveGet(callback: Function) : void {
    this.log.debug('Triggered GET Active');

    const url = this.apiRoot + "/api/aircons";
    this.log.debug("Getting values from: "  + url);

    axios.get(url)
        .then((response: AxiosResponse) => {
            const activeState = response.data.aircons[this.airConId].powerStatus;
            if (activeState == "1") {
	    	callback(undefined, hap.Characteristic.Active.ACTIVE);
	    } else {
	        callback(undefined, hap.Characteristic.Active.INACTIVE);
	    }
        });
  }

  /**
   * Handle requests to set the "Active" characteristic
   */
  async handleActiveSet(callback: Function, value: string) : Promise<void> {
    this.log.debug('Triggered SET Active:' + value);
    if (value == "1") {
	this.log.debug("Enabled air conditioner");
	await axios.post(this.apiRoot + "/api/aircons/" + this.airConId + "/switch/1")
    } else {
	const url = this.apiRoot + "/api/aircons/" + this.airConId + "/switch/0";
	this.log.debug("Disabled air conditioner, URL is " + url);
	await axios.post(url)
    }
    callback(undefined);
  }

  /**
   * Handle requests to get the current value of the "Current Heater-Cooler State" characteristic
   */
  handleCurrentHeaterCoolerStateGet(callback: Function) : void {
    this.log.debug('Triggered GET CurrentHeaterCoolerState');

    // set this to a valid value for CurrentHeaterCoolerState
    const currentValue = hap.Characteristic.CurrentHeaterCoolerState.COOLING;

    callback(undefined, currentValue);
  }


  /**
   * Handle requests to get the current value of the "Target Heater-Cooler State" characteristic
   */
  handleTargetHeaterCoolerStateGet(callback: Function) : void {
    this.log.debug('Triggered GET TargetHeaterCoolerState');

    // set this to a valid value for TargetHeaterCoolerState
    const currentValue = hap.Characteristic.TargetHeaterCoolerState.COOL;

    callback(undefined, currentValue);
  }

  /**
   * Handle requests to set the "Target Heater-Cooler State" characteristic
   */
  handleTargetHeaterCoolerStateSet(callback: Function, value: string) : void {
    this.log.debug('Triggered SET TargetHeaterCoolerState:' + value);
    callback(undefined);
  }

  /**
   * Handle requests to get the current value of the "Current Temperature" characteristic
   */
  handleCurrentTemperatureGet(callback: Function) : void {
    this.log.debug('Triggered GET CurrentTemperature');
    const url = this.apiRoot + "/api/aircons";
    this.log.debug("Getting values from: "  + url);

    axios.get(url)
        .then((response: AxiosResponse) => {
	    const temp = response.data.aircons[this.airConId].roomTemperature;
	    this.log.debug("Current room temperature is: " + temp);
            callback(undefined, Number(temp));
        });

  }




  handleCoolingTemperatureGet(callback: Function) : void {
    this.log.debug('Triggered GET CoolingTemperature');

    const url = this.apiRoot + "/api/aircons";
    axios.get(url)
        .then((response: AxiosResponse) => {
            const temp = response.data.aircons[this.airConId].desiredTemperature;
            this.log.debug("Current room temperature is: " + temp);
            callback(undefined, Number(temp));
        });

  }

  handleHeatingTemperatureGet(callback: Function) : void {
    this.log.debug('Triggered GET HeatingTemperature');

    const url = this.apiRoot + "/api/aircons";
    axios.get(url)
        .then((response: AxiosResponse) => {
            const temp = response.data.aircons[this.airConId].desiredTemperature;
            this.log.debug("Current room temperature is: " + temp);
            callback(undefined, Number(temp));
        });
  }

  handleCoolingTemperatureSet(callback: Function, value: string) : void {
    this.log.debug('Triggered SET TargetCoolingTemperatureSET:' + value);
    this.coolingTemperature = Number(value);
    this.setTargetTemperature(this.coolingTemperature, callback);
  }

  handleHeatingTemperatureSet(callback: Function, value: string) : void {
    this.log.debug('Triggered SET HeatingTemperature:' + value);
    this.heatingTemperature = Number(value);
    this.setTargetTemperature(this.heatingTemperature, callback);
  }


  /***************** Helper functions ***************/
  async getAPIState() : Promise<any> {
	const url = this.apiRoot + "/api/aircons";
    	const response = await axios.get(url);
        return response.data;
  }

  async setTargetTemperature(temperature: number, callback: Function) : Promise<number> {
        this.log.debug('Setting target temperature: ' + temperature);
        const apiRes = await this.getAPIState();
        const temp = apiRes.aircons[this.airConId].desiredTemperature;
        this.log("Current target temp: " + temp);
        this.log("New targetTemperature: " + temperature);

        //Callback before working on it, because it may take a while and hit homekit's response time limit
        callback(undefined);

        //First get current zone temps
        let zoneCount = apiRes.aircons[this.airConId].zones.length;

        var temps = [];
        for (let i = 0; i < zoneCount; i++ ) {
        	temps[i] = apiRes.aircons[this.airConId].zones[i].desiredTemperature;
	}
        this.log.debug("Zone temps: ");
        temps.map(x => this.log.debug("Temp: " + x));

        await new Promise(resolve => setTimeout(resolve, 1000));
        for (var j = 0; j < zoneCount; j++) {
                        let diff = Math.abs(temps[j] - temperature);
                        let incDec = -1;
                        if (temps[j] < temperature) incDec = 1;

                        for (var i = 0; i < diff; i++) {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                const callStr = this.apiRoot + "/api/aircons/" + this.airConId + "/zones/" + j + "/temperature/" + incDec;
                                this.log.debug("Calling zone temp: " + callStr);
                                const resp2 = await axios.post(callStr);
                        }
			this.log.debug("-- End Zone --");
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
    serviceArray.push(this.service);

    //Add zone switches..
    this.zoneSwitches.map(zone => serviceArray.push(zone));

    return serviceArray;
  }

}
