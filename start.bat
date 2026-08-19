@echo off
chcp 65001 >nul
title Workbench Dev

echo ============================================
echo   工作台本地开发启动
echo   后端: http://localhost:8080
echo   前端: http://localhost:5173 (API 自动代理到后端)
echo ============================================
echo.

start "workbench-backend" cmd /k "cd /d %~dp0backend && mvn spring-boot:run -pl workbench-server -am"
start "workbench-frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo 已在两个新窗口中启动后端与前端，关闭对应窗口即停止服务。
pause
