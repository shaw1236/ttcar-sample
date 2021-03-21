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
CC_SRC_PATH="../ttdata-sample/chaincode/ttdata/javascript/"

# clean out any old identites in the wallets
#rm -rf application/wallet/*

# launch network persistence; create channel and join peer to channel
pushd ../test-network
./networkNew.sh down
./networkNew.sh up createChannel -c ttchannel -ca -s couchdb
./networkNew.sh createChannel -c ttchannel2 -ca -s couchdb

./networkNew.sh deployCC -c ttchannel -ccn ttdata -ccv 1 -cci initLedger -ccl ${CC_SRC_LANGUAGE} -ccp ${CC_SRC_PATH}
./networkNew.sh deployCC -c ttchannel2 -ccn ttdata -ccv 1 -cci initLedger -ccl ${CC_SRC_LANGUAGE} -ccp ${CC_SRC_PATH}
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
