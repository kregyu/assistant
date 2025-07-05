# KPC AI助手

基于MCP架构的智能KPC组件库助手，通过MCP客户端连接到kpc-mcp-server，结合Ollama本地AI模型提供智能问答服务。

## 架构设计

```
┌─────────────────┐    MCP协议    ┌─────────────────┐
│   AI Assistant  │◄─────────────►│  kpc-mcp-server │
│                 │               │                 │
│ • Ollama集成    │               │ • KPC数据       │
│ • 智能路由      │               │ • 工具API      │
│ • 自然语言生成   │               │ • 数据验证      │
└─────────────────┘               └─────────────────┘
```

## 功能特性

- 🤖 **智能对话**: 基于Ollama本地AI模型
- 🔧 **工具调用**: 自动检测并调用合适的KPC工具
- 📡 **MCP架构**: 与kpc-mcp-server解耦，通过MCP协议通信
- 🚀 **多种接口**: 命令行、API服务器、编程接口
- ⚡ **流式响应**: 支持实时流式回答
- 🔄 **自动重连**: MCP连接自动管理

## 安装依赖

```bash
cd assistant
npm install
# 或
yarn install
```

## 前置条件

### 1. 安装并启动 kpc-mcp-server

```bash
# 在mcp项目中
cd ../mcp
npm run build
npm link

# 验证安装
kpc-mcp-server --help
```

### 2. 安装并启动 Ollama

```bash
# macOS
brew install ollama

# 启动服务
ollama serve

# 下载模型
ollama pull qwen3:8b
```

## 使用方式

### 1. 命令行聊天

```bash
npm run chat
```

### 2. 演示脚本

```bash
npm run demo
```

### 3. API服务器

```bash
npm run api
```

然后访问 http://localhost:3000

### 4. 编程接口

```typescript
import { KPCAIAssistant } from './src/ai-assistant.js';

const assistant = new KPCAIAssistant();
await assistant.initialize();

const answer = await assistant.chat('Button组件有哪些属性？');
console.log(answer);

await assistant.cleanup();
```

## API接口

### 聊天接口

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Button组件有哪些属性？"}'
```

### 流式聊天

```bash
curl -X POST http://localhost:3000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "如何使用Form组件？"}'
```

### 直接工具调用

```bash
# 获取组件信息
curl -X POST http://localhost:3000/mcp/component \
  -H "Content-Type: application/json" \
  -d '{"component": "Button"}'

# 搜索组件
curl -X POST http://localhost:3000/mcp/search \
  -H "Content-Type: application/json" \
  -d '{"query": "表单"}'

# 验证配置
curl -X POST http://localhost:3000/mcp/validate \
  -H "Content-Type: application/json" \
  -d '{"component": "Button", "props": {"type": "primary"}}'
```

### 健康检查

```bash
curl http://localhost:3000/health
```

## 配置选项

### 构造函数参数

```typescript
const assistant = new KPCAIAssistant(
  'http://localhost:11434',  // Ollama服务地址
  'qwen3:8b',               // AI模型名称
  'kpc-mcp-server'          // MCP服务器命令
);
```

### 环境变量

```bash
PORT=3000                 # API服务器端口
OLLAMA_HOST=localhost:11434  # Ollama服务地址
OLLAMA_MODEL=qwen3:8b       # AI模型
MCP_SERVER_CMD=kpc-mcp-server  # MCP服务器命令
```

## 智能功能

### 自动工具检测

助手会自动分析用户问题并调用合适的工具：

- **组件查询**: "Button组件有哪些属性？" → `get_kpc_component`
- **使用示例**: "如何使用Form组件？" → `get_kpc_usage_examples`
- **搜索功能**: "搜索表单组件" → `search_kpc_components`
- **配置验证**: "验证Button配置" → `validate_kpc_usage`
- **统计信息**: "总共多少组件？" → `get_kpc_stats`

### 双模式运行

1. **完整模式**: Ollama + MCP（AI生成自然语言回答）
2. **工具模式**: 仅MCP（直接返回结构化数据）

## 故障排除

### MCP连接失败

```bash
# 检查kpc-mcp-server是否安装
which kpc-mcp-server

# 手动测试MCP服务器
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | kpc-mcp-server
```

### Ollama连接失败

```bash
# 检查Ollama服务
curl http://localhost:11434/api/tags

# 检查模型
ollama list
```

### 端口占用

```bash
# 更换端口
PORT=3001 npm run api
```

## 开发

### 构建

```bash
npm run build
```

### 开发模式

```bash
npm run dev
```

### 测试

```bash
# 测试MCP连接
npm run demo

# 测试聊天功能
npm run chat
```

## 项目结构

```
assistant/
├── src/
│   ├── ai-assistant.ts    # 主助手类
│   ├── mcp-client.ts      # MCP客户端
│   └── api-server.ts      # API服务器
├── examples/
│   ├── demo.ts           # 演示脚本
│   └── cli.ts            # 命令行工具
├── package.json
├── tsconfig.json
└── README.md
```

## 许可证

MIT License