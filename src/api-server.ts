/**
 * KPC AI助手API服务器
 */
import express from 'express';
import cors from 'cors';
import { KPCAIAssistant } from './ai-assistant.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let assistant: KPCAIAssistant;

/**
 * 初始化助手
 */
async function initializeAssistant() {
    console.log('🚀 正在初始化KPC AI助手API服务器...');
    assistant = new KPCAIAssistant();
    await assistant.initialize();
    console.log('✅ KPC AI助手初始化完成');
}

/**
 * 健康检查
 */
app.get('/health', async (req, res) => {
    const mcpConnected = assistant?.getMCPClient().isConnected() || false;
    const ollamaAvailable = assistant ? await assistant.checkOllamaService() : false;
    
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'KPC AI助手',
        mcp_connected: mcpConnected,
        ollama_available: ollamaAvailable
    });
});

/**
 * 问答接口
 */
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ 
                error: '缺少message参数' 
            });
        }

        console.log(`📨 收到问题: ${message}`);
        
        const response = await assistant.chat(message);
        
        console.log(`✅ 回答完成`);
        
        res.json({
            success: true,
            response,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 处理聊天请求失败:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});

/**
 * 流式问答接口
 */
app.post('/chat/stream', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ 
                error: '缺少message参数' 
            });
        }

        // 设置SSE头
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });

        console.log(`📨 收到流式问题: ${message}`);

        await assistant.chatStream(message, (chunk) => {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        });

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        
    } catch (error) {
        console.error('❌ 处理流式聊天请求失败:', error);
        res.write(`data: ${JSON.stringify({ 
            error: error instanceof Error ? error.message : '未知错误' 
        })}\n\n`);
        res.end();
    }
});

/**
 * 直接MCP工具调用接口
 */
app.post('/mcp/:toolName', async (req, res) => {
    try {
        const { toolName } = req.params;
        const args = req.body;
        
        const mcpClient = assistant.getMCPClient();
        let result: string;

        switch (toolName) {
            case 'component':
                result = await mcpClient.getComponent(args.component);
                break;
            case 'search':
                result = await mcpClient.searchComponents(args.query, args.category, args.fuzzy);
                break;
            case 'examples':
                result = await mcpClient.getUsageExamples(args.component, args.scenario, args.framework);
                break;
            case 'validate':
                result = await mcpClient.validateUsage(args.component, args.props, args.context);
                break;
            case 'stats':
                result = await mcpClient.getStats();
                break;
            default:
                return res.status(400).json({ error: `未知工具: ${toolName}` });
        }
        
        res.json({
            success: true,
            tool: toolName,
            result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ MCP工具调用失败:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});

/**
 * 获取可用工具列表
 */
app.get('/tools', async (req, res) => {
    try {
        const tools = await assistant.getMCPClient().getAvailableTools();
        
        res.json({
            success: true,
            tools,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 获取工具列表失败:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});

/**
 * 简单的Web界面
 */
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>KPC AI助手</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .title { color: #333; text-align: center; margin-bottom: 30px; }
        .input-group { margin: 20px 0; }
        .input-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
        .input-group input, .input-group textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; }
        .btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; margin: 5px; }
        .btn:hover { background: #0056b3; }
        .response { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-top: 20px; border-left: 4px solid #007bff; }
        .api-docs { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
        .endpoint { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; font-family: monospace; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .status.ok { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="title">🤖 KPC AI助手</h1>
        <p style="text-align: center;">基于MCP架构的智能组件库助手</p>
        
        <div id="status" class="status">正在检查服务状态...</div>
        
        <div class="input-group">
            <label for="question">问题：</label>
            <textarea id="question" rows="3" placeholder="请输入您关于KPC组件的问题，例如：&#10;- Button组件有哪些属性？&#10;- 如何使用Form组件进行表单验证？&#10;- 搜索所有表单相关的组件"></textarea>
        </div>
        
        <button class="btn" onclick="askQuestion()">普通回答</button>
        <button class="btn" onclick="askQuestionStream()">流式回答</button>
        
        <div id="response" class="response" style="display:none;">
            <h3>回答：</h3>
            <div id="answer"></div>
        </div>

        <div class="api-docs">
            <h2>API接口</h2>
            <div class="endpoint">POST /chat<br>{"message": "您的问题"}</div>
            <div class="endpoint">POST /chat/stream<br>流式响应</div>
            <div class="endpoint">POST /mcp/component<br>{"component": "Button"}</div>
            <div class="endpoint">POST /mcp/search<br>{"query": "表单"}</div>
            <div class="endpoint">GET /tools<br>获取可用工具</div>
            <div class="endpoint">GET /health<br>服务健康状态</div>
        </div>
    </div>

    <script>
        // 检查服务状态
        async function checkStatus() {
            try {
                const response = await fetch('/health');
                const data = await response.json();
                const statusDiv = document.getElementById('status');
                
                if (data.mcp_connected && data.ollama_available) {
                    statusDiv.className = 'status ok';
                    statusDiv.innerHTML = '✅ 服务正常 - MCP已连接，Ollama可用';
                } else if (data.mcp_connected) {
                    statusDiv.className = 'status ok';
                    statusDiv.innerHTML = '⚠️ MCP已连接，但Ollama不可用（仍可查询组件信息）';
                } else {
                    statusDiv.className = 'status error';
                    statusDiv.innerHTML = '❌ MCP服务未连接';
                }
            } catch (error) {
                const statusDiv = document.getElementById('status');
                statusDiv.className = 'status error';
                statusDiv.innerHTML = '❌ 无法连接到服务器';
            }
        }

        async function askQuestion() {
            const question = document.getElementById('question').value.trim();
            if (!question) {
                alert('请输入问题');
                return;
            }

            const responseDiv = document.getElementById('response');
            const answerDiv = document.getElementById('answer');
            
            responseDiv.style.display = 'block';
            answerDiv.innerHTML = '正在思考中...';

            try {
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: question })
                });

                const data = await response.json();
                
                if (data.success) {
                    answerDiv.innerHTML = '<pre>' + data.response + '</pre>';
                } else {
                    answerDiv.innerHTML = '错误：' + data.error;
                }
            } catch (error) {
                answerDiv.innerHTML = '请求失败：' + error.message;
            }
        }

        async function askQuestionStream() {
            const question = document.getElementById('question').value.trim();
            if (!question) {
                alert('请输入问题');
                return;
            }

            const responseDiv = document.getElementById('response');
            const answerDiv = document.getElementById('answer');
            
            responseDiv.style.display = 'block';
            answerDiv.innerHTML = '';

            try {
                const response = await fetch('/chat/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: question })
                });

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\\n').filter(line => line.startsWith('data: '));
                    
                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.chunk) {
                                answerDiv.innerHTML += data.chunk;
                            } else if (data.done) {
                                // 流结束
                            } else if (data.error) {
                                answerDiv.innerHTML += '\\n\\n错误：' + data.error;
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            } catch (error) {
                answerDiv.innerHTML = '流式请求失败：' + error.message;
            }
        }

        // 页面加载时检查状态
        checkStatus();
    </script>
</body>
</html>
    `);
});

/**
 * 启动服务器
 */
async function startServer() {
    try {
        await initializeAssistant();
        
        app.listen(port, () => {
            console.log(`🌟 KPC AI助手API服务器启动成功`);
            console.log(`📡 服务地址: http://localhost:${port}`);
            console.log(`📚 Web界面: http://localhost:${port}`);
            console.log(`🏥 健康检查: http://localhost:${port}/health`);
            console.log(`💬 聊天接口: POST http://localhost:${port}/chat`);
            console.log(`🔧 工具列表: GET http://localhost:${port}/tools`);
        });
    } catch (error) {
        console.error('❌ 启动服务器失败:', error);
        console.log('\n请确保：');
        console.log('1. kpc-mcp-server 已安装并可全局访问');
        console.log('2. MCP服务器可以正常启动');
        process.exit(1);
    }
}

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('\n👋 正在关闭服务器...');
    if (assistant) {
        await assistant.cleanup();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n👋 正在关闭服务器...');
    if (assistant) {
        await assistant.cleanup();
    }
    process.exit(0);
});

startServer();