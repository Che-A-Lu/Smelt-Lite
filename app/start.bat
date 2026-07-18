@echo off
cd /d "%~dp0"
chcp 65001 >nul
title Smelt
echo.
echo   Smelt — .card format reference implementation
echo.
echo   Installing dependencies (first time only)...
call npm install
echo.
echo   Starting Smelt...
start http://localhost:5173
npx vite
pause
