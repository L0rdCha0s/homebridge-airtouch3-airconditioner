# homebridge-airtouch3-airconditioner

This Homebridge plugin builds on the excellent work of [ozczecho](https://github.com/ozczecho), and connects a Polyaire Airtouch 3 air conditioner to Homekit via Homebridge.

Configuration is as follows:

```
    {
          "accessory": "homebridge-airtouch3-airconditioner",
          "name": "Air Conditioner",
          "airtouchHost": "<ip of your airtouch 3 unit>",
          "zones": [
              {
                  "zoneId": 0,
                  "name": "Upstairs Bedroom Zone"
              },
              {
                  "zoneId": 1,
                  "name": "Upstairs Lounge Zone"
              },
              {
                  "zoneId": 2,
                  "name": "Kitchen Zone"
              },
              {
                  "zoneId": 3,
                  "name": "Downstairs Bedroom Zone"
              }
          ]
      }
```

*Notes*:

1. You'll need one zone entry in the configuration file per zone you want to expose to Homekit.  Zone IDs are 0-indexed.  If you visit http://vzduch-dotek-api:port/api/aircons , you'll see a list of your zones in the returned JSON.
2. Temperature setting is currently *global* - all zones will be set to the temperature you select in HomeKit


# Contact

If you have issues configuring or running this plugin, please raise an issue in Github and I'll get to it as soon as possible.
