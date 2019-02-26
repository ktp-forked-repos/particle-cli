import ParticleApi from './api';
import { getDevice, openUsbDevice } from './device-util';
import { formatDeviceInfo } from './formatting';

import { getDevices as getUsbDevices } from 'particle-usb';
import when from 'when';
import sequence from 'when/sequence';

export class UsbCommand {
	constructor(settings) {
		this._auth = settings.access_token;
		this._api = new ParticleApi(settings.apiUrl, { accessToken: this._auth }).api;
	}

	list(args) {
		// Enumerate USB devices
		return getUsbDevices().then(usbDevices => {
			if (usbDevices.length == 0) {
				return [];
			}
			// Get device info
			return sequence(usbDevices.map(usbDevice => () => {
				return usbDevice.open().then(() => {
					return getDevice({ id: usbDevice.id, api: this._api, auth: this._auth, dontThrow: true })
				})
				.then(device => ({
					id: usbDevice.id,
					type: usbDevice.type,
					name: (device && device.name) ? device.name : ''
				}))
				.finally(() => usbDevice.close());
			}));
		})
		.then(devices => {
			if (devices.length == 0) {
				console.log('No devices found.');
			} else {
				devices = devices.sort((a, b) => a.name.localeCompare(b.name)); // Sort devices by name
				devices.forEach(device => {
					console.log(formatDeviceInfo(device));
				});
			}
		});
	}

	dfu(args) {
		return when.resolve().then(() => {
			if (args.params.device) {
				return openUsbDevice({ id: args.params.device, dfuMode: true, api: this._api, auth: this._auth });
			}
			// Device ID is optional if there's a single device attached to the host
			return getUsbDevices().then(usbDevices => {
				if (usbDevices.length > 1) {
					throw new Error('Device ID or name is missing');
				} else if (usbDevices.length == 0) {
					throw new Error('No devices found');
				}
				return usbDevices[0].open();
			})
		})
		.then(usbDevice => {
			let p = when.resolve();
			if (!usbDevice.isInDfuMode) {
				p = p.then(() => usbDevice.enterDfuMode());
			}
			return p.finally(() => usbDevice.close());
		})
		.then(() => {
			console.log('Done.');
		});
	}
}
