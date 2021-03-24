import {
  Logging
} from "homebridge";

export class AirTouchMessage {
   buffer: Int8Array;
   sumByte: Int8Array;
   log: Logging;

   constructor(log: Logging) {
     this.buffer = new Int8Array(13);
     this.sumByte = new Int8Array(13);
     this.log = log;
   }

  resetMessage() {
      for (let i = 0; i< 13; i++) {
        this.buffer[i] = 0;
      }
      this.buffer[0] = 85;
      this.buffer[2] = 12;
   }

   printHexCode() {
       this.log.info(Array.apply([], Array.from(this.buffer)).join(","));
   }

   calcChecksum() : number {
      let reSum = 0;
      for (let i = 0; i <= this.sumByte.length - 1; i++)
      {
          this.sumByte[i] = this.buffer[i];
      }
      let reSum2 = 0;
      let i2 = 0;
      while (i2 <= this.sumByte.length - 2)
      {
          let b = this.sumByte[i2];
          if (b >= 0)
          {
              reSum = reSum2 + b;
          }
          else if (b == 0) //byte.minvalue
          {
              reSum = reSum2 + 128;
          }
          else
          {
              reSum = reSum2 + (b + 256);
          }
          i2++;
          reSum2 = reSum;
      }
      return reSum2;
   }

   getInitMsg() : Int8Array {
      this.resetMessage();
      this.buffer[1] = 1;
      this.buffer[12] = this.calcChecksum();

      return this.buffer;
   }

   toggleZone(zone: number) {
     this.resetMessage();
     this.buffer[1] = -127;
     this.buffer[3] = zone;
     this.buffer[4] = -128;
     this.buffer[12] = this.calcChecksum();

    return this.buffer;
   }

   toggleAcOnOff(acId: number)
   {
        this.resetMessage();
        this.buffer[1] = -122;
        this.buffer[3] = acId;
        this.buffer[4] = -128;
        this.buffer[12] = this.calcChecksum();

        return this.buffer;
    }

    setMode(acId: number, brandId: number, inMode: number) {
      this.resetMessage();

      let mode = 0;
      this.log.info("Air Conditioner brand id at mode select: " + brandId + " and mode " + mode);
      if (acId == 0 && acBrandId == 11)
            {
                switch (inMode)
                {
                    case 0:
                        mode = 0;
                        break;
                    case 1:
                        mode = 2;
                        break;
                    case 2:
                        mode = 3;
                        break;
                    case 3:
                        mode = 4;
                        break;
                    case 4:
                        mode = 1;
                        break;
                }
            }

            if (acId == 0 && acBrandId == 15)
            {
                switch (inMode)
                {
                    case 0:
                        mode = 5;
                        break;
                    case 1:
                        mode = 2;
                        break;
                    case 2:
                        mode = 3;
                        break;
                    case 3:
                        mode = 4;
                        break;
                    case 4:
                        mode = 1;
                        break;
                }
            }
            this.buffer[1] = -122;
            this.buffer[3] = acId;
            this.buffer[4] = -127;
            this.buffer[5] = mode;
            this.buffer[12] = this.calcChecksum();
    }
}
