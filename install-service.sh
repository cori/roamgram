#!/bin/bash
sudo cp roamgram.service /etc/systemd/system
sudo ln -fs $(which node) /usr/local/bin/node
sudo ln -fs $(which npm) /usr/local/bin/npm
sudo systemctl daemon-reload
sudo systemctl enable roamgram
sudo systemctl start roamgram