@echo off

REM 设置命令行编码为UTF-8，解决中文乱码问题
chcp 65001 >nul

REM 检查MongoDB服务是否运行
sc query MongoDB | find "RUNNING" >nul
if %ERRORLEVEL% NEQ 0 (
    echo MongoDB服务未运行，正在启动...
    net start MongoDB
    if %ERRORLEVEL% NEQ 0 (
        echo 启动MongoDB服务失败，请检查服务是否存在
        pause
        exit /b 1
    )
    echo MongoDB服务已启动
) else (
    echo MongoDB服务已运行
)

REM 检查node进程是否运行
tasklist | find "node.exe" >nul
if %ERRORLEVEL% EQU 0 (
    echo Node进程正在运行，正在关闭...
    taskkill /f /im node.exe
    if %ERRORLEVEL% NEQ 0 (
        echo 关闭Node进程失败
        pause
        exit /b 1
    )
    echo Node进程已关闭
) else (
    echo Node进程未运行
)

REM 运行npm start
echo 正在启动应用...
cd /d "%~dp0"
npm start

pause
