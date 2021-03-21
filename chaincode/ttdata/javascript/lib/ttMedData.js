'use strict';

const { Contract } = require('fabric-contract-api');

// Contract: org.ttdata.meddata
class TTMedData extends Contract {
    constructor() {
        // Unique namespace when multiple contracts per chaincode file
        super('org.ttdata.meddata');
    }

    async InitLedger(ctx) {
    }

    // ===============================================
    // register - register new device
    // ===============================================
    async register(ctx, key) { 
        if (!key) 
            throw new Error('DeviceId is required!');
    
        // ==== Input sanitation ====
        console.info('--- start register device ---')
        let keyState = await ctx.stub.getState(key);
        if (keyState) {
            keyState = keyState.toString();
            let device = JSON.parse(keyState)
            let jsonResp = {
                result: `This key already exists`,
                appkey: device.hash
            };
            return Buffer.from(JSON.stringify(jsonResp));
        }

        // ==== Create device object and marshal to JSON ====
        let cAppkey = ctx.stub.getTxID();
        let device = {
            key,
            subKey:    '0000',
            hash:      cAppkey,
            timestamp: Date.now()
        }
        // === Save marble to state ===
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(device)));

        let jsonResp = {
            appkey: cAppkey,
            result: "Success"
        }

        return Buffer.from(JSON.stringify(jsonResp));
    }

    // ===========================================================
    // upload a data
    // ===========================================================
    async uploadData(ctx, key, subKey, dataType, hash) {
        if (!key) 
            throw new Error('key is required!');
    
        if (!subKey)
            throw new Error('subKey is required!');
    
        if (!dataType) 
            throw new Error('dataType is required!');

        if (!hash) 
            throw new Error('hash is required!');

        console.info('- start upload data ', key, subKey);
        let deviceData = {
            key,
            subKey,
            index: 'Subkey',
            dataType,
            timestamp: Date.now(),
            hash
        };

        // put subkey into state
        let cSONasBytes = Buffer.from(JSON.stringify(deviceData));
        let indexName = 'key~subkey'
        let cIndexKey = await ctx.stub.createCompositeKey(indexName, [ key, subKey ]);
        console.info('Index Key: ' + cIndexKey);
        //  Save index entry to state.
        let resp = await ctx.stub.putState(cIndexKey, cSONasBytes);

        console.info('- end upload data (success)'+ resp);
        let jsonResp = {
            result: true,
            message: `uploadData - key= ${key} - ${subKey} : Successful`
        };

        return Buffer.from(JSON.stringify(jsonResp));
    }

    // ===============================================
    // queryKey - read a device data from chaincode state
    // ===============================================
    async queryKey(ctx, key) {
        if (!key) 
            throw new Error('key is required!');
    
        let keyState = await ctx.stub.getState(key);
        if (!keyState) 
            throw new Error(`key does not exist: ${key}`)
        
        let device = JSON.parse(keyState.toString())        
        return Buffer.from("" + device.hash);
    }

    async queryBySubkey(ctx, key, subKey) {
        if (!key) 
            throw new Error('key is required!');
    
        if (!subKey)
            throw new Error('subKey is required!');

        let indexName = 'key~subkey'
        let cIndexKey = await ctx.stub.createCompositeKey(indexName, [ key, subKey ]);
        console.info('Index Key: ' + cIndexKey);
        let dataAsbytes = await ctx.stub.getState(cIndexKey); //get the data from chaincode state
        if (!dataAsbytes) 
            throw new Error(`key/subKey does not exist: ${cIndexKey}`);

        dataAsbytes = dataAsbytes.toString();
        console.info('=======================================');
        console.log(dataAsbytes);
        console.info('=======================================');
        return dataAsbytes;
    }

    async checkBySubkey(ctx, key, subKey) {
        if (!key) 
            throw new Error('key is required!');
    
        if (!subKey)
            throw new Error('subKey is required!');

        let indexName = 'key~subkey'
        let cIndexKey = await ctx.stub.createCompositeKey(indexName, [key, subKey ]);
        console.info('Index Key:' + cIndexKey);
        
        let jsonResp = { result: false };
        let dataAsbytes = await ctx.stub.getState(cIndexKey); //get the data from chaincode state
        if (dataAsbytes) {
            let deviceData = JSON.parse(dataAsbytes.toString());
            jsonResp = {
                result: true,
                hash: deviceData.hash
            }
        }
        return Buffer.from(JSON.stringify(jsonResp));
    }

    async queryData(ctx, selection) {
        // 'queryString'
        if (!selection) 
            throw new Error('selection must not be empty');
    
        let queryResults = await ctx.stub.getQueryResultForQueryString(selection);
        return queryResults.toString();
    }

    // ==================================================
    // delete - remove a device key/value pair from state
    // ==================================================
    async delete(ctx, key) {
        if (!key) 
            throw new Error('key is required!');
    
        let error = "";
        // to maintain the subkey index, we need to read the data first and get its subkey
        let deviceStringified = await ctx.stub.getState(key); //get the data from chaincode state
        if (!deviceStringified) 
            throw new Error(`device does not exist: ${deviceId}`);

        let device = JSON.parse(deviceStringified.toString());
        if (device.key !== key)
            throw new Error(`device was wrong: <${key}, ${device.key}>`);

        await ctx.stub.deleteState(key); //remove the key from chaincode state
        return Buffer.from(`{ result: true }`);
    }

    async requestShare(ctx, key, Owner, Viewer, dataType, ShareFields) {
        if (!key) 
            throw new Error('key is required!');

        if (!Owner) 
            throw new Error('Owner is required!');

        if (!Viewer) 
            throw new Error('Viewer is required!');

        if (!dataType) 
            throw new Error('dataType is required!');

        console.info('============= START : Request For Share ===========');

        let deviceData = {
            Owner,
            timestamp: Date.now(),
            Viewer,
            dataType,
            ShareFields
        };

        let JSONasBytes = Buffer.from(JSON.stringify(deviceData));
        await ctx.stub.putState(key, JSONasBytes); //rewrite the Data
        console.info('============= END : Request For Share ===========');
    }

    async queryDataWithPagination(ctx, selection, pageSize, bookMark) {
        const queryString = selection;
        const pageSize = parseInt(pageSize, 10);
    
        const { iterator, metadata } = await ctx.stub.getQueryResultWithPagination(queryString, pageSize, bookMark);
        const results = await this.getAllResults(iterator, false);
    
        let jsonResp = {
            result: results,
            bookmark: metadata.bookmark
        };
        return Buffer.from(JSON.stringify(jsonResp));
    }

    async getAllResults(iterator, isHistory) {
        let allResults = [];
        while (true) {
            let res = await iterator.next();
            if (!res) break;

            if (res.value && res.value.value.toString()) {
                let jsonRes = {};
                console.log(res.value.value.toString('utf8'));

                if (isHistory && isHistory === true) {
                    jsonRes.TxId = res.value.tx_id;
                    jsonRes.Timestamp = res.value.timestamp;
                    jsonRes.IsDelete = res.value.is_delete.toString();
                    try {
                        jsonRes.Value = JSON.parse(res.value.value.toString('utf8'));
                    } 
                    catch (err) {
                        console.log(err);
                        jsonRes.Value = res.value.value.toString('utf8');
                    }
                } 
                else {
                    jsonRes.Key = res.value.key;
                    try {
                        jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
                    } 
                    catch (err) {
                        console.log(err);
                        jsonRes.Record = res.value.value.toString('utf8');
                    }
                }
            }
            allResults.push(jsonRes);
        }
        
        if (res.done) {
            console.log('end of data');
            await iterator.close();
            console.info(allResults);
            return allResults;
        }
    }

    async getQueryResultForQueryString(ctx, queryString) {
        console.info('- getQueryResultForQueryString queryString:\n' + queryString);
        let resultsIterator = await ctx.stub.getQueryResult(queryString);
        console.info('~~Result:'+resultsIterator);
        
        let results = await this.getAllResults(resultsIterator, false);
        return Buffer.from(JSON.stringify(results));
    }

    async getHistory(ctx, key) {
        if (!key) 
            throw new Error('key is required');
    
        console.info('- start getHistory: %s\n', key);
        let resultsIterator = await ctx.stub.getStateByPartialCompositeKey('key~subkey',[ key ]);
        let results = await this.getAllResults(resultsIterator, false);

        return Buffer.from(JSON.stringify(results));
    }

    async getHistoryByDataType(ctx, key, dataType) {
    let queryString = '{\"selector\":{\"key\":\"'+ key + '\",\"index\":\"Subkey\",\"dataType\":\"' + dataType + '\"}}'

    let queryResults = await ctx.stub.getQueryResultForQueryString(queryString);
    return queryResults;
    }

    async getDataByRangeWithPagination(ctx, startKey, endKey, pageSize, bookmark) {
        const pageSize = parseInt(pageSize, 10);

        const { iterator, metadata } = await ctx.stub.getStateByRangeWithPagination(startKey, endKey, pageSize, bookmark);
        const results = await this.getAllResults(iterator, false);
        // use RecordsCount and Bookmark to keep consistency with the go sample
        results.ResponseMetadata = {
            RecordsCount: metadata.fetched_records_count,
            Bookmark: metadata.bookmark
        };
        return Buffer.from(JSON.stringify(results));
    }
}

module.exports = TTMedData; // ttData
