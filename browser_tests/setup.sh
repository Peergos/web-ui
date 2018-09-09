#!/bin/bash

# 
# This is meant for a CI server agent, not development 
#
virtualenv venv
source venv/bin/activate

# install python package deps
pip install -r requirements.txt

# install  chrome
#curl -o chrome.zip -L  https://download-chromium.appspot.com/dl/Linux_x64?type=snapshots
#unzip chrome.zip
