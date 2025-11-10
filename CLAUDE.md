# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

node-auto-launch 是一个跨平台的 Node.js 库，用于在系统启动时自动启动应用程序。支持 Windows、macOS、Linux 和 FreeBSD。

## 开发命令

```bash
# 运行测试
npm test

# 代码检查
npm run lint

# 自动修复代码风格问题
npm run lint:fix
```

## 代码架构

### 核心设计模式

项目使用**策略模式**实现跨平台支持：

1. **入口类** (`src/index.js`): `AutoLaunch` - 主要的公共 API 类
2. **平台选择器** (`src/library/autoLaunchHandler.js`): 根据 `process.platform` 选择对应的平台实现
3. **抽象基类** (`src/library/autoLaunchAPI/autoLaunchAPI.js`): `AutoLaunchAPI` - 定义统一接口
4. **平台实现**:
   - `autoLaunchAPIWindows.js` - Windows 注册表实现
   - `autoLaunchAPIMac.js` - macOS AppleScript 或 Launch Agent 实现
   - `autoLaunchAPILinux.js` - Linux Desktop Entry 实现

### 平台特定实现

- **Windows**: 通过修改注册表 `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`
- **macOS**:
  - 默认使用 AppleScript 添加登录项
  - 可选使用 Launch Agent (`.plist` 文件)
- **Linux/FreeBSD**: 在 `~/.config/autostart/` 创建 `.desktop` 文件

### 关键依赖

- `applescript`: macOS AppleScript 执行
- `winreg`: Windows 注册表操作
- `untildify`: 路径展开

## 代码风格

- 使用 ESLint (airbnb-base 配置)
- ES6 模块 (`.js` 文件必须包含 `.js` 扩展名)
- 2 空格缩进
- 最大行长度 128 字符
- 禁止使用 `var`，优先使用 `const`

## 测试

测试文件位于 `tests/test.js`，使用 Mocha 框架。pre-commit hook 会自动运行测试。
