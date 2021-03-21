/*
 * ttdata
 *
 */

'use strict';

const TTCar = require('./lib/ttcar');
const AssetTask = require('./lib/assetTask'); 
const TTMedData = require('./lib/ttMedData');

module.exports.TTCar = TTCar;
module.exports.AssetTask = AssetTask;
module.exports.TTMedData = TTMedData;

module.exports.contracts = [ TTCar, AssetTask, TTMedData ];
