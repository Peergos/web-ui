#!/bin/bash

# install python package deps
pip install --user -r requirements.txt

# install  chrome
curl -o chrome.zip -L  https://download-chromium.appspot.com/dl/Linux_x64?type=snapshots
unzip chrome.zip

# add to path
export BINARY_LOCATION=$PWD/chrome-linux/chrome
