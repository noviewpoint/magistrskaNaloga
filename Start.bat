@echo off
start Generator.exe
start node Streznik/server.js
start chrome http://localhost:3468 --incognito
exit