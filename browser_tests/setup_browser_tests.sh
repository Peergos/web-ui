#!/bin/bash
set -euf -o pipefail

venv_dir=${1:-$(mktemp | xargs basename | xargs echo)}

function get_chrome_major_version() {
    ${CHROMIUM:-google-chrome} --version | awk '{print $3}' | awk 'BEGIN {FS="."} {print $1}'
}

function get_and_check_chromedriver() {
    url=$1
    sha256=$2
    download_path=$(mktemp)
    echo "Downloading chromedriver $url"
    curl -o $download_path $url
    # compare checksum
    chk=$(sha256sum $download_path | awk '{print $1}')
    if [[ "$chk" != "$sha256" ]];
    then
        echo "ERROR: Specified url $url has sha256 $chk, expected $sha256"
        return 1
    fi
    # unzip chromedriver
    unzip $download_path -d $PWD
}

function get_chromedriver() {
    VERSION=$(get_chrome_major_version)
    if [[ $VERSION == "84" ]]; 
    then
        get_and_check_chromedriver https://chromedriver.storage.googleapis.com/84.0.4147.30/chromedriver_linux64.zip 160531e8f98f13b486411cd6445ec0e3c56cd4d4b2839e3e9a0fda09a279797a 
    elif [[ $VERSION == "85" ]]; 
    then
        get_and_check_chromedriver https://chromedriver.storage.googleapis.com/85.0.4183.38/chromedriver_linux64.zip cd4e08b4a7ddd0f8b60126051c64f64de7edf07350294965a98bfd984d429eed
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

