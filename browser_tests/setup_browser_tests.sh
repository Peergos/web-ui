#!/bin/bash
set -euf -o pipefail

venv_dir=${1:-$(mktemp | xargs basename | xargs echo)}

function get_chrome_major_version() {
    ${CHROMIUM:-google-chrome} --version | awk '{print $3}' | awk 'BEGIN {FS="."} {print $1}'
}

function get_chrome_version() {
    ${CHROMIUM:-google-chrome} --version | awk '{print $3}' | awk 'BEGIN {FS="."} {print $1"."$2"."$3}'
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

function download_chromedriver() {
    version=$1
    echo "Downloading chromedriver version $version"
    
    driver=$(curl https://chromedriver.storage.googleapis.com/LATEST_RELEASE_$VERSION)
    url=https://chromedriver.storage.googleapis.com/$driver/chromedriver_linux64.zip
    download_path=$(mktemp)
    echo "Downloading chromedriver $url"
    curl -o $download_path $url
    # unzip chromedriver
    unzip $download_path -d $PWD
}

function get_chromedriver() {
    VERSION=$(get_chrome_version)
    download_chromedriver $VERSION
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

