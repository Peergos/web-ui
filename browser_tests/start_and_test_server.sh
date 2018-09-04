#!/bin/bash
set -e

export PEERGOS_URL=${PEERGOS_URL:-http://localhost:8000}
export RUN_HEADLESS=${RUN_HEADLESS:-1} # change to 0 run show window

function start_peergos() {
    ant  -buildfile ../build.xml run &
}

function get_peergos_pid() {
    ps aux |grep PeergosServer.jar | awk '{print $2}';
}

function kill_peergos_server() {
    get_peergos_pid | xargs kill -9;
}

# start peergos server in bkg
start_peergos

# define teardown at exit
trap kill_peergos_server EXIT INT

# run  tests
pytest -sv tests -x 
