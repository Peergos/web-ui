#!/bin/bash

# install python package deps
pip install --user -r requirements.txt

# install  chrome
curl -o chrome.zip -L  https://download-chromium.appspot.com/dl/Linux_x64?type=snapshots
unzip chrome.zip

# add to path
export PATH=$PATH:$PWD/chrome-linux
