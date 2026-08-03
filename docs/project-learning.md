# AI Bid Assistant 学习笔记


## 项目目标

帮助标书员管理项目，并利用AI分析招标文件。


## 当前技术

前端：
HTML + JavaScript

数据库：
Supabase


## 当前文件

index.html

页面结构


app.js

业务逻辑


supabase.sql

数据库

# index.html 页面结构


## 页面主要区域

### 1. 登录页面

作用：

用户登录系统。


### 2. Dashboard

作用：

显示项目概览。


### 3. 项目管理

作用：

新增、查看、编辑投标项目。

# app.js 学习笔记


## 程序运行流程

用户操作

↓

事件触发

↓

调用函数

↓

处理数据

↓

保存数据库


## 新增项目流程

按钮：

新增项目


调用：

addProject()


执行：

1. 获取输入内容

2. 写入Supabase

3. 刷新项目列表


## JavaScript关键词

function:

函数


const:

定义变量


await:

等待异步结果
