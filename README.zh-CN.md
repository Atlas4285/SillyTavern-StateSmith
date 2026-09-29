# SillyTavern StateSmith

[English](README.md) | **简体中文**

StateSmith 是一个第三方 [SillyTavern](https://github.com/SillyTavern/SillyTavern) 扩展，用于追踪聊天中的当前状态。你可以在扩展设置中定义字段，在聊天界面查看或直接修改数值，也可以让模型在剧情变化时通过函数工具更新状态。

状态更新使用 Function Calling，不依赖模型在正文中输出特殊标签或正则匹配。

## 功能

- 支持数字、进度条、文本、开关、标签和下拉框六种字段。
- 每个会话只保存一份最新状态，并保留该会话选用的配置。
- 在聊天界面显示紧凑的状态面板；手动编辑的值会自动保存。
- 每次生成时提供当前状态，并注册一个根据字段动态生成的 `update_state` 工具；一次调用可以修改多个字段。
- 每次导入或导出一份 JSON 配置；同名导入时先确认是否覆盖。
- 通过总开关停用面板、模型提示词和工具，而不删除已保存的数据。
- 提供英文界面和简体中文本地化。

## 安装

### 通过 SillyTavern 安装

1. 打开 SillyTavern 的 **扩展（Extensions）** 面板，选择 **安装扩展（Install Extension）**。
2. 输入仓库地址：

    ```text
    https://github.com/Atlas4285/SillyTavern-StateSmith
    ```

3. 完成安装。如果扩展没有立即出现，请刷新 SillyTavern 页面。

请只安装来自可信来源的第三方扩展。

### 手动安装

将仓库克隆到 SillyTavern 的第三方扩展目录：

```bash
cd /path/to/SillyTavern/public/scripts/extensions/third-party
git clone https://github.com/Atlas4285/SillyTavern-StateSmith.git
```

如果仓库中没有构建好的 `dist/index.js`，先执行：

```bash
cd SillyTavern-StateSmith
npm install
npm run build
```

然后刷新 SillyTavern。

## 快速开始

1. 打开 **扩展 → State Smith**，保持 **启用 State Smith** 开启。
2. 点击 **新建**，添加字段并保存配置。每个字段都需要唯一的 `name`、供模型参考的描述，以及符合字段类型的默认值。显示名称可以留空，此时会使用字段名称。
3. 在列表中选择已保存的配置进行编辑，然后点击**设为当前配置**。在桌面端也可以双击配置完成切换。
4. 打开一个会话。消息输入框上方会显示状态面板。点击编辑按钮可手动修改状态，修改后自动保存；另一个按钮用于收起或展开面板。
5. 如果 SillyTavern 当前的连接与模型支持 Function Calling，扩展还会在生成时发送当前状态。模型可在状态发生变化时调用 `update_state`。

全局的“当前配置”是没有会话专属配置时的默认选择。切换到已经保存配置的会话时，优先使用该会话自己的配置。将其他配置设为当前配置时，也会将它绑定到打开的会话。

## 字段类型

| 类型   | 配置项                 | 状态值             |
| ------ | ---------------------- | ------------------ |
| 数字   | 默认值、最小值、最大值 | 范围内的数字       |
| 进度条 | 默认值、最小值、最大值 | 以进度条显示的数字 |
| 文本   | 默认值、最大长度       | 字符串             |
| 开关   | 默认开关状态           | 布尔值             |
| 标签   | 默认值、选项列表       | 选项中的一个字符串 |
| 下拉框 | 默认值、选项列表       | 选项中的一个字符串 |

标签和下拉框都只保存**一个**选项，不是多选字段。修改字段定义后，旧值只有在仍符合新类型及限制时才会保留；否则该字段恢复为默认值。

## 配置 JSON

设置界面每次只导入或导出**一个配置**。导入与现有配置同名的文件时，会先询问是否覆盖。导入导出不包含任何会话的当前状态。

下面是一份包含两个字段的最小示例：

```json
{
    "$schema": "https://raw.githubusercontent.com/Atlas4285/SillyTavern-StateSmith/main/schema/statesmith-config.schema.json",
    "name": "Adventure",
    "fields": [
        {
            "name": "health",
            "label": "Health",
            "description": "The character's current health.",
            "type": "progress",
            "config": { "defaultValue": 100, "min": 0, "max": 100 }
        },
        {
            "name": "mood",
            "label": "",
            "description": "The character's current mood.",
            "type": "select",
            "config": { "defaultValue": "calm", "options": ["calm", "tense"] }
        }
    ]
}
```

`$schema` 指向[配置校验文件](schema/statesmith-config.schema.json)，方便 JSON 编辑器检查格式；它不是字段值，也不是会话状态的版本号。

## 模型对接与数据保存

默认状态提示词和工具描述会随界面语言本地化，也可以在单个配置中覆盖：

- 状态提示词：`{{state}}` 插入当前状态的 JSON；`{{toolName}}` 插入工具名称。
- 工具描述：`{{fields}}` 插入字段名称、类型、显示名称和描述。

工具参数直接由当前字段生成。模型可以只提交发生变化的字段，也可以在一次调用中提交多个字段。关闭扩展、没有当前配置，或者当前配置没有字段时，扩展不会添加状态提示词或工具。工具调用依赖所选的 SillyTavern API 和模型支持 Function Calling；扩展无法强制不支持的连接使用工具。

配置与总开关保存在 SillyTavern 扩展设置中。当前状态和会话选用的配置保存在该会话的元数据中，只保留最新快照，不记录每次更新的历史。导出的配置 JSON 不会备份会话状态。

## 开发

本扩展使用 TypeScript 编写，并通过 Webpack 打包。在扩展目录中执行：

```bash
npm install
npm run dev               # 监听源码并重新构建
npm run build             # 在 dist/ 生成生产版本
npm run lint              # ESLint 检查
npx tsc --noEmit          # TypeScript 检查
```

开发监听器只会重新构建 bundle，不会热重载 SillyTavern；修改后请刷新浏览器页面。

### 项目结构

```text
src/
├── index.ts               扩展初始化
├── application/           活动配置、状态协调和模型上下文
├── domain/                字段与状态类型、配置校验
├── infrastructure/        SillyTavern 设置、会话元数据和工具对接
└── ui/
    ├── chat/              聊天状态面板
    └── settings/          配置与字段编辑器
schema/                    配置的 JSON Schema
i18n/                      简体中文界面文案
dist/                      构建后的扩展 bundle
```

`manifest.json` 声明的生产入口文件为 `dist/index.js`。

## 许可证

本项目采用 [GNU Affero General Public License v3.0](LICENSE) 许可证。
