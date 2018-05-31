/*** Tasmota Z-Way HA module *******************************************

Version: 1.0.0
(c) Z-Wave.Me, 2017
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

		if (this.user != '') {
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
					    console.log('Tasmota - response.data.POWER is: ' + response.data.POWER); 
						self.vDev.set('metrics:level', response.data.POWER.toLowerCase());
					},
					error: function(response) {
						console.log('Tasmota - ERROR: ' + response.statusText); 
					} 
				});
			},
			moduleId: this.id
		});
};

Tasmota.prototype.stop = function () {

	if (this.vDev) {
		this.controller.devices.remove(this.vDev.id);
		this.vDev = null;
	}

	Tasmota.super_.prototype.stop.call(this);
};
