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
		
		this.config = config;

		this.vvvlog('config.title          : ' + config.title); 
		this.vvvlog('config.url            : ' + config.url); 
		this.vvvlog('config.password       : ' + config.password); 
		this.vvvlog('config.sensorAvailable: ' + config.sensorAvailable); 
		this.vvvlog('config.sensorInterval : ' + config.sensorInterval); 
		this.vvvlog('config.loglevel       : ' + config.loglevel); 
		
		if (undefined === config.password) {
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
		vDevId = 'Tasmota_' + this.id;

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
					    self.log('response.data.POWER is: ' + response.data.POWER); 
						self.vDev.set('metrics:level', response.data.POWER.toLowerCase());
					},
					error: function(response) {
						self.error(vDevId + ' - ERROR: ' + response.statusText); 
					} 
				});
			},
			moduleId: this.id
		});
		
		// Extended funtionality - Sensors 
		self.log('Sensor - Presence is: ' + config.sensorAvailable); 
		if (config.sensorAvailable) {
		
			// Prepare Url to fetch Sensor data
			sensorurl = this.url.replace('=Power','=Status%208');
			self.vvlog('Sensor Init - Using Url: ' + sensorurl); 

			// Fetch Sensor data
			http.request({
				method: 'GET',
				url: sensorurl,
				async: true,
				success: function(response) {
				
					sensorType = Object.keys(response.data.StatusSNS)[1]
				    self.log('Sensor Init - SensorType is ' + sensorType ); 
				    self.log('Sensor Init - Measure Time: ' + response.data.StatusSNS.Time); 
					
					for (sensorKey in response.data.StatusSNS[sensorType]) {

						sensorUnit = self.getSensorUnit(sensorKey, response);
						sensorIcon = self.getSensorIcon(sensorKey, response);
						
						self.log('Sensor Init - Key: ' + sensorKey); 
						self.log('Sensor Init - Val: ' + response.data.StatusSNS[sensorType][sensorKey]); 
							
						self.vDev[sensorKey]= self.controller.devices.create({
							deviceId: "Tasmota_"+self.id+"_"+sensorKey,
                            defaults: {
                                deviceType: "sensorMultilevel",
                                metrics: {
                                    icon: sensorIcon,
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
					self.error('Sensor Init - HttpRequest ERROR: ' + response.statusText); 
				} 
			});
			
		
			self.log('Sensor Init - Update Interval given: ' + config.sensorInterval); 
			if (undefined === config.sensorInterval) {
				updateInterval = 60*1000;
			} else {
				updateInterval = config.sensorInterval*1000;
			}
			self.log('Sensor Init - Update Interval using:  ' + updateInterval); 
			self.interval = setInterval(function() {
				self.updateSensor(self);
			}, updateInterval);

			//self.updateSensor();

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
	
	self.log('Updating Sensor values'); 

	sensorurl = this.url.replace('=Power','=Status%208');
	self.vvlog('Update Sensor - Using Url: ' + sensorurl); 

	// Fetch Sensor data
	http.request({
		method: 'GET',
		url: sensorurl,
		async: true,
		success: function(response) {
		
			sensorType = Object.keys(response.data.StatusSNS)[1]
		    self.vlog('Update Sensor - Measure Time ' + response.data.StatusSNS.Time); 
			
			for (sensorKey in response.data.StatusSNS[sensorType]) {

				self.vlog('Update Sensor - key: ' + sensorKey); 
				self.vlog('Update Sensor - val: ' + response.data.StatusSNS[sensorType][sensorKey]); 
				
				value = response.data.StatusSNS[sensorType][sensorKey];
				self.vDev[sensorKey].set("metrics:level", value);
				
		    }
			
		},
		error: function(response) {
			self.error('Update Sensor - HttpRequest ERROR: ' + response.statusText); 
		} 
	});

}

Tasmota.prototype.getSensorUnit = function (mySensorKey, myResponse) {
    var self = this;
	
	switch (mySensorKey) {
	// "AM2301":{"Temperature":21.9,"Humidity":49.5},"TempUnit":"C"}}
	case 'Temperature' :
		mySensorUnit = '°' + myResponse.data.StatusSNS.TempUnit;
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
	case 'Factor' :
		mySensorUnit = 'x';
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

	self.log('Sensor Unit: ' + mySensorUnit); 
	return mySensorUnit;
	
}

Tasmota.prototype.getSensorIcon = function (mySensorKey, myResponse) {
    var self = this;

	// .../smarthome/storage/img/icons/switch-on.png
	// .../smarthome/storage/img/icons/temperature.png
	// .../smarthome/storage/img/icons/humidity.png
	// .../smarthome/storage/img/icons/meter.png
	// .../smarthome/storage/img/icons/energy.png

	switch (mySensorKey) {
	// "AM2301":{"Temperature":21.9,"Humidity":49.5},"TempUnit":"C"}}
	case 'Temperature' :
		mySensorIcon = 'temperature.png';
		break;
	case 'Humidity' :
		mySensorIcon = 'humidity.png';
		break;
	// "ENERGY":{"Total":0.000,"Yesterday":0.000,"Today":0.000,"Power":0,"Factor":0.00,"Voltage":230,"Current":0.000}}}
	case 'Total' :
		mySensorIcon = 'energy.png';
		break;
	case 'Yesterday' :
		mySensorIcon = 'energy.png';
		break;
	case 'Today' :
		mySensorIcon = 'energy.png';
		break;
	case 'Power' :
		mySensorIcon = 'meter.png';
		break;
	case 'Factor' :
		mySensorIcon = 'meter.png';
		break;
	case 'Voltage' :
		mySensorIcon = 'meter.png';
		break;
	case 'Current' :
		mySensorIcon = 'meter.png';
		break;
	// unknown
	default:
		mySensorIcon = '';
	}

	self.log('Sensor Icon: ' + mySensorIcon); 
	return mySensorIcon;
	
}

/* Log helper functions */

Tasmota.prototype.log = function(message) {
    if (undefined === message) return;
    console.log('['+this.constructor.name+'_'+this.id+'] '+message);
};

Tasmota.prototype.vlog = function(message) {
    if (undefined === message) return;
    if (this.config.loglevel > 0) {
		console.log('['+this.constructor.name+'_'+this.id+']_1 '+message);
	}
};

Tasmota.prototype.vvlog = function(message) {
    if (undefined === message) return;
    if (this.config.loglevel > 1) {
		console.log('['+this.constructor.name+'_'+this.id+']_2 '+message);
	}
};

Tasmota.prototype.vvvlog = function(message) {
    if (undefined === message) return;
    if (this.config.loglevel > 2) {
		console.log('['+this.constructor.name+'_'+this.id+']_3 '+message);
	}
};

Tasmota.prototype.error = function(message) {
    if (undefined === message) message = 'An unknown error occured';
    var error = new Error(message);
    console.error('['+this.constructor.name+'_'+this.id+'] '+error.stack);
};

