#!/bin/bash

# 进入项目目录
cd /Users/hsu/Documents/application/crypto-firebase/crypto-tracker

# 建置專案
npm run build

cd ..

# 部署到 Firebase Hosting
firebase deploy --only hosting