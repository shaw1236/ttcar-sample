
// Purpose : Hyperledger-fabric service and samples, all in one
// Author  : Simon Li
// Date    : March 16, 2019

// https://hyperledger-fabric.readthedocs.io/en/release-2.2/test_network.html
// https://hyperledger-fabric.readthedocs.io/ml/latest/developapps/smartcontract.html
// https://github.com/hyperledger/fabric-samples

'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const assert = require('assert');

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');

class FabricAppService {
    static mspOrg1         = 'Org1MSP';
    static org1UserId      = 'appUser';
    static mspOrg2         = 'Org2MSP';
    static org2UserId      = 'appUser';
    static adminUserId     = 'admin';
    static adminUserPasswd = 'adminpw';

    static walletPath      = path.join(__dirname, 'wallet');

    // Network folder
    static getNetworkDir() {
        return path.join(__dirname, '..', '..', 'test-network');
    }

    constructor() {
        this._gateway = null;
        this._networks = [];
        this._contracts = [];
        this.isConnected = false;
    }

    async setGateway(channelName = "", chaincode = "", contractName = "") {
        try {
            if (!this._gateway) {
                // load the network configuration
                const ccpPath = path.resolve(FabricAppService.getNetworkDir(), 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
                console.log({ ccpPath });
                const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

                const wallet = await Wallets.newFileSystemWallet(FabricAppService.walletPath);
                console.log({ walletPath: FabricAppService.walletPath });

                // Check to see if we've already enrolled the user.
                let appUser = FabricAppService.org1UserId;
                const identity = await wallet.get(appUser);
                if (!identity) {
                    const message = `An identity for the user ${appUser} does not exist in the wallet`;
                    console.log(message);
                    throw message;
                }    
                // Create a new gateway for connecting to our peer node.
                this._gateway = new Gateway();

                await this._gateway.connect(ccp, { wallet, identity: FabricAppService.org1UserId, discovery: { enabled: true, asLocalhost: true } })
                this.isConnected = true;
                console.log("Gateway connected");
            }

            if (channelName) {
                await this.setNetwork(channelName);
                if (chaincode)
                    await this.setContract(chaincode, contractName);
            }
        }
        catch (error) {
            console.error(error);
            process.exit(1);
        }
    }

    // Get the network (channel) our contract is deployed to.
    async setNetwork(channel = 'ttchannel') {
        if (!this.isConnected) throw 'Not connected!';

        let network = this._networks.find(nk => nk.channel === channel);
        if (!network) {
            let instance = await this._gateway.getNetwork(channel);
            network = { channel, instance };
            this._networks.push(network);
        }
        //console.log({ network });

        return network.instance;
    }

    getNetwork(networkIndex = 0) {
        let network = this._networks[networkIndex];
        return network && network.instance;
    }

    async setContract(chaincode = 'ttcar', contractName = "", allInOne = 0) {
        if (!this.isConnected) throw new Error('Not connected!');
        if (!this._networks.length) throw new Error("No network available!");

        let contract = this._contracts.find(ct => ct.chaincode === chaincode && ct.contractName === contractName);
        if (!contract) {
            let network = null;
            //console.log(allInOne, typeof allInOne, isNaN(allInOne));
            if (typeof allInOne === 'object') { // network
                network = allInOne;
            }
            else if (typeof allInOne === 'string' && isNaN(allInOne)) { // Channel name
                let findNetwork = null;
                if (allInOne === 'latest') {
                    findNetwork = this._networks[this._networks.length - 1];
                } 
                else {    
                    findNetwork = this._networks.find(nk => nk.channel === allInOne);
                }
                network = findNetwork.instance;
            }
            else { // index
                let networkIndex = Number(allInOne);
                network = this._networks[networkIndex].instance;
            }
            assert.ok(network);

            // Get the contract from the network.
            let instance = null;
            if (contractName)
                instance = await network.getContract(chaincode, contractName);
            else // first contract in the chaincode
                instance = await network.getContract(chaincode);
            contract = { chaincode, contractName, instance };
            this._contracts.push(contract);
        }
        return contract.instance;
    };

    getContract(indexOrLatest = 0) {
        let contract = null;
        if (typeof indexOrLatest === 'number')
            contract = this._contracts[indexOrLatest];
        else
            contract = this._contracts[this._contracts - 1]; 
        return contract && contract.instance || null;
    }

    async queryTrans(transFunc = 'queryCar', args = [], contractIndex = 0) {
        if (!this._contracts.length) throw new Error("No contract set yet!");

        const callArgs = [ transFunc, ...args ];
        //console.log("callArgs: ", callArgs);
        const contract = this.getContract(contractIndex);
        //console.log(contract);
        let result = await contract.evaluateTransaction(...callArgs);
        //const result = await contract.evaluateTransaction('queryAllCars');
        return result;
    }

    async muteTrans(transFunc = 'queryCar', args = []) {
        if (!this._contracts.length) throw new Error("No contract set yet!");

        const callArgs = [ transFunc, ...args ];
        let result = await this.getContract(0).submitTransaction(...callArgs);
        return result;
    }

    // Disconnect from the gateway.
    async disconnect() {
        this._contracts.length = 0;
        this._networks.length = 0;
        await this._gateway.disconnect();
        this._gateway = null;
        this.isConnected = false;
    }

    //
    // Static method
    //
    /**
    *
    * @param {*} FabricCAServices
    * @param {*} ccp
    */
    static buildCAClient(FabricCAServices, ccp, caHostName) {
	    // Create a new CA client for interacting with the CA.
	    const caInfo = ccp.certificateAuthorities[caHostName]; //lookup CA details from config
	    const caTLSCACerts = caInfo.tlsCACerts.pem;
	    const caClient = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

	    console.log(`Built a CA Client named ${caInfo.caName}`);
	    return caClient;
    };

    static async enrollAdmin(caClient, wallet, orgMspId) {
	    try {
		    // Check to see if we've already enrolled the admin user.
		    const identity = await wallet.get(FabricAppService.adminUserId);
		    if (identity) {
			    console.log('An identity for the admin user already exists in the wallet');
			    return;
		    }

		    // Enroll the admin user, and import the new identity into the wallet.
		    const enrollment = await caClient.enroll({ enrollmentID: FabricAppService.adminUserId,
                                                       enrollmentSecret: FabricAppService.adminUserPasswd });
		    const x509Identity = {
			    credentials: {
				    certificate: enrollment.certificate,
				    privateKey: enrollment.key.toBytes(),
			    },
			    mspId: orgMspId,
			    type: 'X.509',
		    };
		    await wallet.put(FabricAppService.adminUserId, x509Identity);
		    console.log('Successfully enrolled admin user and imported it into the wallet');
	    }
        catch (error) {
		    console.error(`Failed to enroll admin user : ${error}`);
	    }
    };

    static async registerAndEnrollUser(caClient, wallet, orgMspId, userId, affiliation) {
	    console.log({ task: "registerAndEnrollUser" });
        try {
		    // Check to see if we've already enrolled the user
		    const userIdentity = await wallet.get(userId);
		    if (userIdentity) {
			    console.log(`An identity for the user ${userId} already exists in the wallet`);
			    return;
		    }

		    // Must use an admin to register a new user
		    const adminIdentity = await wallet.get(FabricAppService.adminUserId);
		    if (!adminIdentity) {
			    console.log('An identity for the admin user does not exist in the wallet');
			    throw new Error('Enroll the admin user before retrying');
    		}

		    // build a user object for authenticating with the CA
		    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
		    const adminUser = await provider.getUserContext(adminIdentity, FabricAppService.adminUserId);

		    // Register the user, enroll the user, and import the new identity into the wallet.
		    // if affiliation is specified by client, the affiliation value must be configured in CA
		    const secret = await caClient.register({
			    affiliation: affiliation,
			    enrollmentID: userId,
			    role: 'client'
		    }, adminUser);
		    const enrollment = await caClient.enroll({
			    enrollmentID: userId,
			    enrollmentSecret: secret
		    });
		    const x509Identity = {
			    credentials: {
				    certificate: enrollment.certificate,
				    privateKey: enrollment.key.toBytes(),
			    },
			    mspId: orgMspId,
			    type: 'X.509',
		    };
		    await wallet.put(userId, x509Identity);
		    console.log(`Successfully registered and enrolled user ${userId} and imported it into the wallet`);
	    }
        catch (error) {
		    console.error(`Failed to register user : ${error}`);
            //throw new Error('Failed in registerAndEnrollUser()');
	    }
    };

    static buildCCPOrgN(N = 1) {
        // load the common connection configuration file
        const ccpPath = path.resolve(FabricAppService.getNetworkDir(), 'organizations',
            'peerOrganizations', `org${N}.example.com`, `connection-org${N}.json`);
        const fileExists = fs.existsSync(ccpPath);
        if (!fileExists) {
            throw new Error(`no such file or directory: ${ccpPath}`);
        }
        const contents = fs.readFileSync(ccpPath, 'utf8');

        // build a JSON object from the file contents
        const ccp = JSON.parse(contents);

        console.log(`Loaded the network configuration located at ${ccpPath}`);
        return ccp;
    };

    static async buildWallet(Wallets, walletPath) {
        // Create a new  wallet : Note that wallet is for managing identities.
        console.log({ walletPath });
        let wallet;
        if (walletPath) {
            wallet = await Wallets.newFileSystemWallet(walletPath);
            console.log(`Built a file system wallet at ${walletPath}`);
        }
        else {
            wallet = await Wallets.newInMemoryWallet();
            console.log('Built an in memory wallet');
        }

        return wallet;
    };

    static prettyJSONString(inputString, num = 2) {
        if (!inputString)
            return inputString;

        try {
            return JSON.stringify(JSON.parse(inputString), null, num);
        }
        catch(ex) {
            return inputString;
        }
    }

    static async start() {
        // Check whether user "appuser" is already existing
        const walletQuery = await Wallets.newFileSystemWallet(FabricAppService.walletPath);
       
        // Check to see if we've already enrolled the user.
        let appUser = FabricAppService.org1UserId;
        const identity = await walletQuery.get(appUser);
        if (identity) { // exists
            const message = `An identity for the user ${appUser} exists in the wallet`;
            console.log(message);
            return true;
        }

        // build an in memory object with the network configuration (also known as a connection profile)
        console.log(chalk.green("buildCCPOrg1 starts"));
        const ccp = FabricAppService.buildCCPOrgN(1);
        console.log(chalk.green("buildCCPOrg1 is done"));
        console.log();
        
        // build an instance of the fabric ca services client based on
        // the information in the network configuration
        console.log(chalk.green("buildCAClient start"));
        const caClient = FabricAppService.buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');
        console.log(chalk.green("buildCAClient is done"));
        console.log();

        // setup the wallet to hold the credentials of the application user
        console.log(chalk.green("buildWallet starts"));
        const wallet = await FabricAppService.buildWallet(Wallets, FabricAppService.walletPath);
        console.log(chalk.green("buildWallet is done"));
        console.log();
        
        // in a real application this would be done on an administrative flow, and only once
        console.log(chalk.green("enrollAdmin starts"));
        await FabricAppService.enrollAdmin(caClient, wallet, FabricAppService.mspOrg1);
        console.log(chalk.green("enrollAdmin is done"));
        console.log();
        
        // in a real application this would be done only when a new user was required to be added
        // and would be part of an administrative flow
        console.log(chalk.green("registerAndEnrollUser starts"));
        await FabricAppService.registerAndEnrollUser(caClient, wallet, FabricAppService.mspOrg1, FabricAppService.org1UserId, 'org1.department1');
        console.log(chalk.green("registerAndEnrollUser is done"));
        console.log();

        return true;
    }

    // This is a wrapper for an entry point
    static async application(channelName = 'ttchannel', chaincode = 'ttcar', contractName = '') {
        try {
            const fabricApp = new FabricAppService();

            // Build connection profile and ca services client
            // Setup a wallet
            // Enroll Admin and register app user
            await FabricAppService.start();

            // 1. Gateway
            // set up gateway and connect
            console.log(chalk.green("setGatway starts"));
            await fabricApp.setGateway();
            console.log(chalk.green("setGatway is done"));
            console.log();

            // 2. Network - channel, peer
            // Get the network (channel) our contract is deployed to.
            console.log(chalk.green("setNetWork starts"));
            const network = await fabricApp.setNetwork(channelName); // set up the network
            console.log(chalk.green("setNetWork is done"));
            console.log();

            // 3. Smart contract in chaincode container
            // Get the contract from the network.
            console.log(chalk.green("setContract starts"));
            const contract = await fabricApp.setContract(chaincode, contractName);  // set up the contract
            console.log(chalk.green("setContract is done"));
            console.log();

            //console.log({ fabricApp, network, contract });
            return { fabricApp, network, contract };
        }
        catch (error) {
            console.error(`Error: ${error}`);
            process.exit(1);
        }
    }

    // all in one
    static async applicationOne(channelName = 'ttchannel', chaincode = 'ttcar', contractName = '') {
        try {
            const fabricApp = new FabricAppService();
            await FabricAppService.start();
            // Gateway, network, contract
            await fabricApp.setGateway(channelName, chaincode, contractName);
            return { fabricApp, network: fabricApp.getNetwork(0), contract: fabricApp.getContract(0) };
        }
        catch (error) {
            console.error(`Error: ${error}`);
            process.exit(1);
        }
    }

    static async sampleApp1() {
        console.log(chalk.green("sampleApp1 starts"));
        try {
            //const app = await FabricAppService.application('ttchannel', 'ttcar');
            const app = await FabricAppService.applicationOne('ttchannel', 'ttcar');
            //const app = await FabricAppService.applicationOne('ttchannel2', 'ttcar2');

            // Evaluate the specified transaction.
            // queryCar transaction - requires 1 argument, ex: ('queryCar', 'CAR4')
            // queryAllCars transaction - requires no arguments, ex: ('queryAllCars')
            let result = await app.fabricApp.queryTrans('queryCar', [ 'CAR4' ]);
            console.log('Query CAR4: ', JSON.parse(result));
            result = await app.fabricApp.queryTrans('queryAllCars', []);
            let objCars = JSON.parse(result);
            console.log('Query all cars: ', objCars);
            console.log("Toatl cars: ", objCars.length);
            // Disconnect from the gateway.
            await app.fabricApp.disconnect();
        }
        catch (error) {
            console.error(`Error: ${error}`);
            throw error;
        }
        finally {
            console.log(chalk.green("sampleApp1 is done"));
        }
    }

    static async sampleApp2() {
        console.log(chalk.green("sampleApp2 starts"));
        try {
            const app = await FabricAppService.application('ttchannel', 'ttcar');
            //const app = FabricAppService.applicationOne('ttchannel', 'ttcar');


            // Submit the specified transaction.
            // createCar transaction - requires 5 argument, ex: ('createCar', 'CAR12', 'Honda', 'Accord', 'Black', 'Tom')
            // changeCarOwner transaction - requires 2 args , ex: ('changeCarOwner', 'CAR12', 'Dave')
            let car = 'CAR12';
            await app.fabricApp.muteTrans('createCar', [car, 'Honda', 'Accord', 'Black', 'Tom']);
            console.log('Transaction has been submitted - create a car');
            let result = await app.fabricApp.queryTrans('queryCar', [ car ]);
            console.log(`Query ${car}: `, JSON.parse(result));
            await app.fabricApp.muteTrans('changeCarOwner', [car, 'Simon']);
            console.log('Transaction has been submitted - change car owner');
            result = await app.fabricApp.queryTrans('queryCar', [ car ]);
            console.log(`Query ${car}: `, JSON.parse(result));
            
            result = await app.fabricApp.queryTrans('queryAllCars', []);
            console.log('Query all cars: ', JSON.parse(result));


            // Disconnect from the gateway.
            await app.fabricApp.disconnect();
        }
        catch (error) {
            console.error(`Error: ${error}`);
            throw error;
        }
        finally {
            console.log(chalk.green("sampleApp2 is done"));
        }
    }

    static async sampleApp3() {
        console.log(chalk.green("sampleApp3 starts"));
        try {
            let app = await FabricAppService.applicationOne('ttchannel2', 'tttask', 'org.ttdata.assettask');
            let result = await app.fabricApp.muteTrans('CreateTask', ['Task-12', 'Test Task', 'Test', false, 'Simon']);
            console.log("Add one task");
            result = await app.fabricApp.queryTrans('ReadTask', [ 'Task-12' ]);
            let obj = JSON.parse(result);
            console.log('Task query result: ', obj);

            //app = await FabricAppService.applicationOne('ttchannel', 'ttcar', 'org.ttdata.ttcar');
            let network = await app.fabricApp.setNetwork('ttchannel');
            await app.fabricApp.setContract('ttcar', 'org.ttdata.ttcar', network); // 'latest', 'ttchannel', 1;
            result = await app.fabricApp.queryTrans('queryCar', [ 'CAR4' ], 1); // second contract
            console.log('Car query result: ', JSON.parse(result));

            await app.fabricApp.disconnect();
        }
        catch (error) {
            console.error(`Error: ${error}`);
            throw error;
        }
        finally {
            console.log(chalk.green("sampleApp3 is done"));
        }
    }
}

module.exports = { FabricAppService }

if (require.main === module) {
    //FabricAppService.sampleApp1()
    FabricAppService.sampleApp2()
    //FabricAppService.sampleApp3()

    .then()
    .catch(console.error)
    .finally(() => console.log("done"))
}