#!/bin/bash
set -euf -o pipefail

venv_dir=${1:-$(mktemp | xargs basename | xargs echo)}

function get_chrome_major_version() {
    ${CHROMIUM:-google-chrome} --version | awk '{print $3}' | awk 'BEGIN {FS="."} {print $1}'
}

function get_and_check_chromedriver() {
    url=$1
    md5=$2
    download_path=$(mktemp)
    echo "Downloading chromedriver $url"
    curl -o $download_path $url
    # compare checksum
    chk=$(md5sum $download_path | awk '{print $1}')
    if [[ "$chk" != "$md5" ]];
    then
        echo "ERROR: Specified url $url has md5 $chk, expected $md5"
        return 1
    fi
    # unzip chromedriver
    unzip $download_path -d $PWD
}

function get_chromedriver() {
    VERSION=$(get_chrome_major_version)
    if [[ $VERSION == "84" ]]; 
    then
        get_and_check_chromedriver https://chromedriver.storage.googleapis.com/84.0.4147.30/chromedriver_linux64.zip beffb1bca07d8f4fd23213b292ef963b
    elif [[ $VERSION == "85" ]]; 
    then
        get_and_check_chromedriver https://chromedriver.storage.googleapis.com/85.0.4183.38/chromedriver_linux64.zip 856c69ea0e6c71b04119167e1b72e4bf
    else
        echo "ERROR: Unsupported chrome version $VERSION"
        return 1
    fi
}

function ensure_chromedriver() {
    if ! test -f "chromedriver";
    then
        echo "Downloading chromedriver for the installed version of chrome"
        get_chromedriver
    else
        echo "Using available ./chromedriver"
    fi
}

ensure_chromedriver
#
# setup python v-venv
#
echo "Creating venv $venv_dir"
python3 -m venv "$venv_dir"
. "$venv_dir/bin/activate"
pip3 install -r requirements.txt

