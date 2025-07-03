#!/bin/bash
cd /home/kavia/workspace/code-generation/docquery-hub-88947-88417/react_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

