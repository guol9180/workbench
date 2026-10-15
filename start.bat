@echo off
chcp 65001 >nul
title Workbench Dev

echo ============================================
echo   工作台本地开发启动
echo   后端: http://localhost:8080
echo   前端: http://localhost:5173 (API 自动代理到后端)
echo ============================================
echo.

rem 仅本窗口生效：本项目使用 JDK 25，不影响系统与其他项目的 JDK 21
set "JAVA_HOME=D:\dev\environment\jdk-25.0.4.1+1"
start "workbench-backend" cmd /k "cd /d %~dp0backend && set JAVA_HOME=D:\dev\environment\jdk-25.0.4.1+1 && mvn spring-boot:run -pl workbench-server -am"
start "workbench-frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo 已在两个新窗口中启动后端与前端，关闭对应窗口即停止服务。
pause
