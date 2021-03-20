'use strict';

const { Contract } = require('fabric-contract-api');

class AssetTask extends Contract {
    constructor() {
        // Unique namespace when multiple contracts per chaincode file
        super('org.ttdata.assettask');
    }

    async InitTask(ctx) {
        const tasks = [
            {
                ID:          'Task-1',
                Title:       'Buy groceries',
                Description: 'Milk, Cheese, Pizza, Fruit, Tylenol',
                Owner:       'Worker 1', 
                Done:        false
            },
            {
                ID:          'Task-2',
                Title:       'Learn Python',
                Description: 'Need to find a good Python tutorial on the web', 
                Owner:       'Worker 1', 
                Done:        false
            },
            {
                ID:          'Task-3',
                Title:       'Use flask',
                Description: 'Use flask to build RESTful service',
                Owner:       'Worker 1', 
                Done:         false
            }
        ];

        for (const task of tasks) {
            task.docType = 'assert';
            await ctx.stub.putState(task.ID, Buffer.from(JSON.stringify(task)));
            console.info(`Assert task ${task.ID} initialized`);
        }
    }

    // CreateTask issues a new asset to the world state with given details.
    async CreateTask(ctx, id, title, description, done, owner) {
        const task = {
            ID: id,
            Title: title,
            Description: description,
            Done: done,
            Owner: owner,
            docType: 'assert',
        };
        ctx.stub.putState(task.ID, Buffer.from(JSON.stringify(task)));
        return JSON.stringify(task);
    }

    async InsertTask(ctx, id, title, description, done, owner) {
        return await CreateTask(ctx, id, title, description, done, owner);
    }

    // ReadTask returns the asset stored in the world state with given id.
    async ReadTask(ctx, id) {
        const taskJSON = await ctx.stub.getState(id); // get the asset from chaincode state
        if (!taskJSON || taskJSON.length === 0) {
            throw new Error(`The asset task ${id} does not exist`);
        }
        return taskJSON.toString();
    }

    // UpdateTask updates an existing asset in the world state with provided parameters.
    async UpdateTask(ctx, id, title, description, done, owner) {
        const exists = await this.TaskExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset task ${id} does not exist`);
        }

        // overwriting original asset with new asset
        const updatedTask = {
            ID: id,
            Title: title,
            Description: description,
            Done: done,
            Owner: owner,
        };
        return ctx.stub.putState(id, Buffer.from(JSON.stringify(updatedTask)));
    }

    // DeleteTask deletes an given asset from the world state.
    async DeleteTask(ctx, id) {
        const exists = await this.TaskExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset task ${id} does not exist`);
        }
        return ctx.stub.deleteState(id);
    }

    // TaskExists returns true when asset with given ID exists in world state.
    async TaskExists(ctx, id) {
        const taskJSON = await ctx.stub.getState(id);
        return taskJSON && taskJSON.length > 0;
    }

    // TransferTask updates the owner field of asset with given id in the world state.
    async TransferTask(ctx, id, newOwner) {
        const taskString = await this.ReadTask(ctx, id);
        const task = JSON.parse(taskString);
        task.Owner = newOwner;
        return ctx.stub.putState(id, Buffer.from(JSON.stringify(task)));
    }

    // GetAllAssets returns all assets found in the world state.
    async GetAllTasks(ctx) {
        const allResults = [];
        // range query with empty string for startKey and endKey does an open-ended query of all assets in the chaincode namespace.
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push({ Key: result.value.key, Record: record });
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }
}

module.exports = AssetTask;
