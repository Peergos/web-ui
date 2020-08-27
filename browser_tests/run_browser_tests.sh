#!/bin/bash
set -euf -o pipefail

#
# define teardown peergos
#
function ensure_no_peergos_server_running() {
   ps aux |grep Peergos.jar  | grep -v grep | awk '{print $2}' | xargs kill -9 || true;
}

function start_peergos_async() {
    (cd ../server
    JAR_PATH="Peergos.jar"
    PEERGOS_PATH=".peergos"
    LOG_TO_CONSOLE="false"

    rm -fr "$PEERGOS_PATH"
    #
    # hold on
    #
    java -jar "$JAR_PATH" pki-init  -logToConsole "$LOG_TO_CONSOLE" -useIPFS false -webroot webroot -webcache false -max-users 100 peergos.password testpassword pki.keygen.password testpkipassword pki.keyfile.password testpkifilepassword mutable-pointers-file mutable.sql social-sql-file social.sql default-quota 157286400 PEERGOS_PATH "$PEERGOS_PATH" -admin-usernames peergos -collect-metrics true -enable-wait-list true -max-daily-signups 10000 || true &
    )
}
#
#  set teardown
#
trap ensure_no_peergos_server_running EXIT INT

#
# kill any peergos
#
ensure_no_peergos_server_running

#
# start local peergos server, wait for startup
#
start_peergos_async
sleep 10

#
# run the tests
# headless by default
RUN_HEADLESS=${1:-1} pytest -sv "$@" tests --junit-xml=$PWD/test_report.xml 
