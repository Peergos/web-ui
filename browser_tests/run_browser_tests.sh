#!/bin/bash
set -euf -o pipefail

#
# define teardown peergos
#
function ensure_no_peergos_server_running() {
   ps aux |grep Peergos.jar  | grep -v grep | awk '{print $2}' | xargs kill -9 || true;
   rm -rf  ../server/.peergos;
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
ant -buildfile ../build.xml run || true &
sleep 10

#
# run the tests
# headless by default
RUN_HEADLESS=${1:-1} pytest -sv "$@" tests --junit-xml=$PWD/test_report.xml 
