

import net from "net"
import {PromiseSocket, TimeoutError} from "promise-socket"
import PromiseWritable from "promise-writable"
import { AirTouchMessage } from "./messages/AirTouchMessage";
import { MessageResponseParser } from "./messages/MessageResponseParser"
import { Aircon } from "./messages/Aircon"
import { AcMode } from "./messages/enums/AcMode"
import { Logger, Logging } from "homebridge/lib/logger";

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

class ACTestHarness {
    airtouchHost = "10.200.5.20";
    airtouchPort : number = 8899;

    private antiFlap: boolean = false;
    private socket: net.Socket = new net.Socket();
    private promiseSocket: PromiseSocket<net.Socket> = new PromiseSocket(this.socket);
    private switchOn = false;
    private coolingTemperature = 24;
    private heatingTemperature = 15;
    private connected : boolean = false;
    private airConId = 0;
    private log : Logging = Logger.withPrefix("TEST: ");

    private aircon: Aircon | undefined;
    private commandQueue = new Queue<AirTouchMessage>();

    async connectToServer() : Promise<void> {

        this.log.debug
        console.log("Connecting to airtouch at : " + this.airtouchHost + ":" + this.airtouchPort);

        // this.promiseSocket.setTimeout(3000);
        try {
        await this.promiseSocket.connect(this.airtouchPort, this.airtouchHost)
        } catch (e) {
            console.log("Socket timeout: couldn't connect to " + this.airtouchHost + ":" + this.airtouchPort);
            console.log((<Error>e).message);//conversion to Error type
            this.connected = false;
            return;
        }

        console.log("Connected to airtouch at " + this.airtouchHost + ":" + this.airtouchPort);
        this.connected = true;

        this.socket.on('data', (data) => {
            console.log('Received: ' + data.length);

        let messageResponseParser = new MessageResponseParser(new Int8Array(data.buffer), this.log);
        this.aircon = messageResponseParser.parse();
        });

        this.socket.on('close', async (e) => {
            console.log("********** AirTouch3 disconnected, reconnecting..");
        this.connected = false;
        });

        //Timer to reconnect
        setInterval(async() => {
        if (this.connected == false) {
            console.log("Reconnecting to airtouch..");
            await this.promiseSocket.connect(this.airtouchPort, this.airtouchHost);
        } else {
            console.log("Connected to airtouch already");
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
    console.log("Sending init..");
    let bufferTest = new AirTouchMessage(this.log);
    bufferTest.getInitMsg();
    bufferTest.printHexCode();

    this.commandQueue.push(bufferTest);
  }

}

Logger.setDebugEnabled();
const harness = new ACTestHarness();
harness.connectToServer();