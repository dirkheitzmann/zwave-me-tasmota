/*** Tasmota Z-Way HA module *******************************************

Version: 2.0.0
(c) CreativeIT.eu, 2018
-----------------------------------------------------------------------------
Author: Dirk Heitzmann (creativeit.eu)
Description:
	This module allows to switch any wifi plug running Tasmota firmware

******************************************************************************/

// ----------------------------------------------------------------------------
// --- Class definition, inheritance and setup
// ----------------------------------------------------------------------------


function Tasmota (id, controller) {
	// Call superconstructor first (AutomationModule)
	Tasmota.super_.call(this, id, controller);
}

inherits(Tasmota, AutomationModule);

_module = Tasmota;

// ----------------------------------------------------------------------------
// --- Module instance initialized
// ----------------------------------------------------------------------------

Tasmota.prototype.init = function (config) {
	Tasmota.super_.prototype.init.call(this, config);
		
		vDevId = 'Tasmota_' + this.id;

		if (config.password != '') {
			this.url = 'http://' + config.url + '/cm?user=admin&password=' + config.password + '&cmnd=Power';
		} else {
			this.url = 'http://' + config.url + '/cm?cmnd=Power';;
		}

		this.commands = {
			on: 	'%20on',
			off: 	'%20off',
			update: ''
		};

		var self = this;

		// Basic funtionality - Switch 
		this.vDev = this.controller.devices.create({
			deviceId: vDevId,
			defaults: {
				deviceType: 'switchBinary',
				customIcons: {},
				metrics: {
					icon: 'switch',
					level: 'off', 
					title: self.getInstanceTitle()
				},
			},
			overlay: {
				deviceType: 'switchBinary'
			},
			handler: function(command) {
				var commandurl = self.url + self.commands[command];				
				http.request({
					method: 'GET',
					url: commandurl,
					async: true,
					success: function(response) {
					    console.log(vDevId + ' - response.data.POWER is: ' + response.data.POWER); 
						self.vDev.set('metrics:level', response.data.POWER.toLowerCase());
					},
					error: function(response) {
						console.log(vDevId + ' - ERROR: ' + response.statusText); 
					} 
				});
			},
			moduleId: this.id
		});
		
		// Extended funtionality - Sensors 
		console.log(vDevId + ' - Sensor - Presence is: ' + config.sensorAvailable); 
		if (config.sensorAvailable) {
		
			// Prepare Url to fetch Sensor data
			sensorurl = this.url.replace('=Power','=Status%208');
			console.log(vDevId + ' - Sensor Init - Using Url: ' + sensorurl); 

			// Fetch Sensor data
			http.request({
				method: 'GET',
				url: sensorurl,
				async: true,
				success: function(response) {
				
					sensorType = Object.keys(response.data.StatusSNS)[1]
				    console.log(vDevId + ' - Sensor Init - Type is ' + sensorType ); 
				    console.log(vDevId + ' - Sensor Init - Measure Time: ' + response.data.StatusSNS.Time); 
					
					for (sensorKey in response.data.StatusSNS[sensorType]) {

						sensorUnit = self.getSensorUnit(sensorKey);
						
						console.log(vDevId + ' - Sensor Init - Key ' + sensorKey); 
						console.log(vDevId + ' - Sensor Init - Val ' + response.data.StatusSNS[sensorType][sensorKey]); 
							
						self.vDev[sensorKey]= self.controller.devices.create({
							deviceId: "Tasmota_"+self.id+"_"+sensorKey,
                            defaults: {
                                deviceType: "sensorMultilevel",
                                metrics: {
                                    icon: 'icon.png',
									level: response.data.StatusSNS[sensorType][sensorKey],
                                    title: "Tasmota ("+self.id+") - "+sensorKey
                                }
                            },
							overlay: {
								metrics: {
									scaleTitle: sensorUnit
								}
							},
                            moduleId: self.id
                        });
				    }
					
				},
				error: function(response) {
					console.log(vDevId + ' - Sensor Init - HttpRequest ERROR: ' + response.statusText); 
				} 
			});
			
		
			self.interval = setInterval(function() {
				self.updateSensor(self);
			}, 60*1000);

			self.updateSensor();

		}
		
};

Tasmota.prototype.stop = function () {

	if (this.vDev) {
		this.controller.devices.remove(this.vDev.id);
		this.vDev = null;
	}

	Tasmota.super_.prototype.stop.call(this);
};

Tasmota.prototype.updateSensor = function () {
    var self = this;
	
	console.log(vDevId + ' - Update Sensor'); 

	sensorurl = this.url.replace('=Power','=Status%208');
	console.log(vDevId + ' - Update Sensor - Using Url: ' + sensorurl); 

	// Fetch Sensor data
	http.request({
		method: 'GET',
		url: sensorurl,
		async: true,
		success: function(response) {
		
			sensorType = Object.keys(response.data.StatusSNS)[1]
		    console.log(vDevId + ' - Update Sensor - Measure Time ' + response.data.StatusSNS.Time); 
			
			for (sensorKey in response.data.StatusSNS[sensorType]) {

				console.log(vDevId + ' - Update Sensor - key: ' + sensorKey); 
				console.log(vDevId + ' - Update Sensor - val: ' + response.data.StatusSNS[sensorType][sensorKey]); 
				
				value = response.data.StatusSNS[sensorType][sensorKey];
				self.vDev[sensorKey].set("metrics:level", value);
				
		    }
			
		},
		error: function(response) {
			console.log(vDevId + ' - Update Sensor - HttpRequest ERROR: ' + response.statusText); 
		} 
	});

}

						
Tasmota.prototype.getSensorUnit = function (mySensorKey) {

	switch (mySensorKey) {
	// "AM2301":{"Temperature":21.9,"Humidity":49.5},"TempUnit":"C"}}
	case 'Temperature' :
		mySensorUnit = '°' + response.data.StatusSNS.TempUnit;
		//mySensorUnit = '°C';
		break;
	case 'Humidity' :
		mySensorUnit = '%';
		break;
	// "ENERGY":{"Total":0.000,"Yesterday":0.000,"Today":0.000,"Power":0,"Factor":0.00,"Voltage":230,"Current":0.000}}}
	case 'Total' :
		mySensorUnit = 'kWh';
		break;
	case 'Yesterday' :
		mySensorUnit = 'kWh';
		break;
	case 'Today' :
		mySensorUnit = 'kWh';
		break;
	case 'Power' :
		mySensorUnit = 'W';
		break;
	case 'Voltage' :
		mySensorUnit = 'V';
		break;
	case 'Current' :
		mySensorUnit = 'A';
		break;
	// unknown
	default:
		mySensorUnit = '?';
	}

	console.log('Tasmota_' + this.id + ' - Sensor Unit: ' + mySensorUnit); 
	return mySensorUnit;
	
}
