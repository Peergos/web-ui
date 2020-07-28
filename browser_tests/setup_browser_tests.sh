#!/bin/bash
set -euf -o pipefail

venv_dir=${1:-$(mktemp | xargs basename | xargs echo)}

#
# setup python v-venv
#
echo "Creating venv $venv_dir"
python3 -m venv "$venv_dir"
. "$venv_dir/bin/activate"
pip3 install -r requirements.txt

