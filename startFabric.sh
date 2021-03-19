#!/bin/bash
#
# ttdata
#
# Exit on first error
set -e

# don't rewrite paths for Windows Git Bash users
export MSYS_NO_PATHCONV=1
starttime=$(date +%s)

CC_SRC_LANGUAGE=${1:-"javascript"}
CC_SRC_LANGUAGE=`echo "$CC_SRC_LANGUAGE" | tr [:upper:] [:lower:]`
CC_SRC_PATH="../ttcar-sample/chaincode/ttcar/javascript/"

# clean out any old identites in the wallets
rm -rf application/wallet/*

# launch network; create channel and join peer to channel
pushd ../test-network
./network.sh down
./network.sh up createChannel -c ttchannel -ca -s couchdb
./network.sh createChannel -c ttchannel2 -ca -s couchdb
#./network.sh createChannel -c ttchannel3 -ca -s couchdb

./network.sh deployCC -c ttchannel -ccn ttcar -ccv 1 -cci initLedger -ccl ${CC_SRC_LANGUAGE} -ccp ${CC_SRC_PATH}
#./network.sh deployCC -c ttchannel2 -ccn ttcar2 -ccv 1 -cci initLedger -ccl ${CC_SRC_LANGUAGE} -ccp ${CC_SRC_PATH}
#./network.sh deployCC -c ttchannel3 -ccn ttcar3 -ccv 1 -cci initLedger -ccl ${CC_SRC_LANGUAGE} -ccp ${CC_SRC_PATH}
popd

cat <<EOF

Total setup execution time : $(($(date +%s) - starttime)) secs ...

Next, use the ttCar applications to interact with the deployed ttcar contract.

  Start by changing into the "application" directory:
    cd application

  Next, install all required packages:
    npm install

    node FabricAppService
EOF
