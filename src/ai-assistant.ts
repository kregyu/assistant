/**
 * KPC AI助手 - 基于Ollama + MCP客户端
 */
import { KPCMCPClient } from './mcp-client.js';

export interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
    eval_count?: number;
    eval_duration?: number;
}

export interface FunctionCall {
    name: string;
    arguments: Record<string, any>;
}

export interface ToolDescription {
    name: string;
    description: string;
    parameters: Record<string, string>;
    examples?: string[];
}

export class KPCAIAssistant {
    private mcpClient: KPCMCPClient;
    private ollamaHost: string;
    private model: string;
    private toolDescriptions: ToolDescription[];

    constructor(ollamaHost = 'http://localhost:11434', model = 'qwen3:8b', mcpServerCommand = 'kpc-mcp-server') {
        this.ollamaHost = ollamaHost;
        this.model = model;
        this.mcpClient = new KPCMCPClient(mcpServerCommand);
        this.toolDescriptions = this.initializeToolDescriptions();
    }

    /**
     * 初始化助手
     */
    async initialize(): Promise<void> {
        console.log('🚀 正在初始化KPC AI助手...');
        
        // 连接MCP服务器
        await this.mcpClient.connect();
        
        // 检查Ollama服务
        const ollamaAvailable = await this.checkOllamaService();
        if (!ollamaAvailable) {
            console.warn('⚠️  Ollama服务不可用，将使用纯工具模式');
        }

        console.log('✅ KPC AI助手初始化完成');
    }

    /**
     * 初始化工具描述配置
     */
    private initializeToolDescriptions(): ToolDescription[] {
        return [
            {
                name: 'get_kpc_component',
                description: '获取KPC组件的详细信息、属性列表、API文档和使用说明',
                parameters: {
                    component: 'string - 组件名称，如Button、Table等'
                },
                examples: [
                    '用户询问Button组件的属性',
                    '想了解Table组件的API',
                    '需要查看具体组件的文档'
                ]
            },
            {
                name: 'search_kpc_components',
                description: '根据关键词搜索相关的KPC组件，支持模糊搜索和分类搜索',
                parameters: {
                    query: 'string - 搜索关键词',
                    category: 'string - 可选，组件分类',
                    fuzzy: 'boolean - 可选，是否模糊搜索'
                },
                examples: [
                    '用户想找表单相关的组件',
                    '搜索按钮类型的组件',
                    '查找数据展示相关组件'
                ]
            },
            {
                name: 'get_kpc_usage_examples',
                description: '获取KPC组件的使用示例和代码演示，包含不同场景的用法',
                parameters: {
                    component: 'string - 组件名称',
                    scenario: 'string - 可选，使用场景如基础用法、表单验证等',
                    framework: 'string - 可选，框架类型'
                },
                examples: [
                    '用户想看Button组件的使用示例',
                    '需要Table组件的分页示例',
                    '想了解Form组件的验证用法'
                ]
            },
            {
                name: 'validate_kpc_usage',
                description: '验证KPC组件的配置是否正确，检查属性值和用法',
                parameters: {
                    component: 'string - 组件名称',
                    props: 'object - 组件属性配置',
                    context: 'string - 可选，使用上下文'
                },
                examples: [
                    '用户提供了组件配置想验证是否正确',
                    '检查属性设置是否有问题',
                    '确认组件用法是否规范'
                ]
            },
            {
                name: 'get_kpc_stats',
                description: '获取KPC组件库的统计信息，如组件数量、分类等',
                parameters: {},
                examples: [
                    '用户询问组件库有多少个组件',
                    '想了解组件分类统计',
                    '查看组件库的整体信息'
                ]
            }
        ];
    }

    /**
     * 清理资源
     */
    async cleanup(): Promise<void> {
        await this.mcpClient.disconnect();
    }

    /**
     * 智能问答主入口
     */
    async chat(userMessage: string): Promise<string> {
        try {
            // 检测是否需要工具调用
            const toolAction = await this.detectToolNeeded(userMessage);
            
            if (toolAction) {
                console.log(`🔧 检测到需要工具: ${toolAction.name}`);
                
                // 执行工具调用
                console.log('🔄 正在查询KPC组件信息...');
                const toolResult = await this.executeTool(toolAction);
                console.log('✅ 组件信息查询完成');
                
                // 如果Ollama可用，让AI生成自然语言回答
                console.log('🤖 检查AI服务状态...');
                if (await this.checkOllamaService()) {
                    console.log('💡 AI服务可用，正在生成智能回答...');
                    const finalAnswer = await this.generateFinalAnswer(userMessage, toolResult);
                    console.log('✅ AI回答生成完成');
                    return finalAnswer;
                } else {
                    console.log('⚠️ AI服务不可用，返回原始查询结果');
                    return toolResult;
                }
            } else {
                // 直接AI回答
                return await this.directAnswer(userMessage);
            }
        } catch (error) {
            console.error('Chat error:', error);
            return `抱歉，处理您的问题时出现错误：${error}`;
        }
    }

    /**
     * 检测是否需要工具调用（基于AI智能决策）
     */
    private async detectToolNeeded(message: string): Promise<FunctionCall | null> {
        // 检查Ollama服务是否可用
        if (!await this.checkOllamaService()) {
            console.log('⚠️ Ollama服务不可用，使用后备规则检测');
            return this.fallbackToolDetection(message);
        }

        const toolsInfo = this.toolDescriptions.map(tool => 
            `${tool.name}: ${tool.description}\n参数: ${Object.entries(tool.parameters).map(([key, desc]) => `${key} (${desc})`).join(', ')}`
        ).join('\n\n');

        const systemPrompt = `你是一个工具调用判断器。分析用户问题，判断是否需要调用工具。

可用工具：
${toolsInfo}

用户问题：${message}

工具选择原则：
1. 询问组件属性、API、参数 → 使用 get_kpc_component
2. 询问如何使用、示例、用法 → 优先使用 get_kpc_component（包含使用示例）
3. 搜索组件 → 使用 search_kpc_components
4. 验证配置 → 使用 validate_kpc_usage
5. 统计信息 → 使用 get_kpc_stats

严格按照以下格式返回，不要添加任何解释：
- 需要工具时返回：{"name": "工具名", "arguments": {参数对象}}
- 不需要工具时返回：null

例如：
- "Button组件有哪些属性？"→ {"name": "get_kpc_component", "arguments": {"component": "Button"}}
- "Table组件如何使用？"→ {"name": "get_kpc_component", "arguments": {"component": "Table"}}
- "你好"→ null

只返回JSON，不要其他内容。`;

        try {
            console.log('🤖 AI正在分析是否需要工具调用...');
            const response = await this.callOllama(systemPrompt);
            return this.parseToolCallResponse(response);
        } catch (error) {
            console.error('AI工具检测失败，使用后备规则:', error);
            return this.fallbackToolDetection(message);
        }
    }

    /**
     * 解析工具调用响应
     */
    private parseToolCallResponse(response: string): FunctionCall | null {
        try {
            // 清理响应，移除可能的标签和格式
            let cleanResponse = response.trim();
            
            // 移除thinking标签
            cleanResponse = cleanResponse.replace(/<think>[\s\S]*?<\/think>/g, '');
            
            // 移除markdown代码块
            if (cleanResponse.includes('```json')) {
                const jsonMatch = cleanResponse.match(/```json\n?([\s\S]*?)```/);
                if (jsonMatch) {
                    cleanResponse = jsonMatch[1];
                }
            } else if (cleanResponse.includes('```')) {
                const codeMatch = cleanResponse.match(/```\n?([\s\S]*?)```/);
                if (codeMatch) {
                    cleanResponse = codeMatch[1];
                }
            }
            
            // 尝试提取JSON对象
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanResponse = jsonMatch[0];
            }
            
            // 清理多余的空白字符
            cleanResponse = cleanResponse.trim();
            
            // 检查是否为null
            if (cleanResponse.toLowerCase() === 'null' || cleanResponse === '') {
                return null;
            }
            
            // 尝试解析JSON
            const parsed = JSON.parse(cleanResponse);
            
            // 验证解析结果
            if (parsed && typeof parsed === 'object' && parsed.name) {
                // 验证工具名称是否有效
                const validTool = this.toolDescriptions.find(tool => tool.name === parsed.name);
                if (validTool) {
                    return parsed as FunctionCall;
                }
            }
            
            return null;
        } catch (error) {
            console.error('解析工具调用响应失败:', error);
            console.error('原始响应:', response);
            return null;
        }
    }

    /**
     * 后备工具检测（基于规则）
     */
    private fallbackToolDetection(message: string): FunctionCall | null {
        const msg = message.toLowerCase();
        
        // 常见组件列表
        const commonComponents = ['button', 'form', 'table', 'input', 'select', 'dialog', 'tooltip', 'datepicker', 'upload', 'pagination', 'switch', 'radio', 'tab', 'checkbox', 'dropdown'];
        const mentionedComponent = commonComponents.find(name => msg.includes(name));
        
        // 统计信息
        if (msg.includes('多少个') || msg.includes('总共') || msg.includes('统计') || msg.includes('数量')) {
            return { name: 'get_kpc_stats', arguments: {} };
        }
        
        // 搜索组件
        if (msg.includes('搜索') || msg.includes('查找') || msg.includes('找') || msg.includes('相关组件')) {
            const query = message.replace(/搜索|查找|找|相关组件|的组件|组件/g, '').trim();
            return { name: 'search_kpc_components', arguments: { query } };
        }
        
        // 组件相关问题 - 统一使用 get_kpc_component
        if (mentionedComponent) {
            return {
                name: 'get_kpc_component',
                arguments: { component: this.capitalizeFirst(mentionedComponent) }
            };
        }
        
        return null;
    }

    /**
     * 首字母大写
     */
    private capitalizeFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }


    /**
     * 执行工具调用
     */
    private async executeTool(toolCall: FunctionCall): Promise<string> {
        const { name, arguments: args } = toolCall;

        try {
            let result: string;
            
            switch (name) {
                case 'get_kpc_component':
                    result = await this.mcpClient.getComponent(args.component);
                    break;
                
                case 'search_kpc_components':
                    result = await this.mcpClient.searchComponents(args.query, args.category, args.fuzzy);
                    break;
                
                case 'get_kpc_usage_examples':
                    result = await this.mcpClient.getUsageExamples(args.component, args.scenario, args.framework);
                    break;
                
                case 'validate_kpc_usage':
                    result = await this.mcpClient.validateUsage(args.component, args.props, args.context);
                    break;
                
                case 'get_kpc_stats':
                    result = await this.mcpClient.getStats();
                    break;
                
                default:
                    return `未知工具：${name}`;
            }
            
            // 检查结果有效性
            if (!result || result.trim() === '' || result === 'undefined') {
                console.warn(`工具 ${name} 返回空结果，参数:`, args);
                return `工具 ${name} 未返回有效结果。请检查参数或稍后重试。`;
            }
            
            return result;
        } catch (error) {
            console.error(`工具 ${name} 执行失败:`, error);
            return `工具执行失败：${error}`;
        }
    }

    /**
     * 直接回答（无需工具）
     */
    private async directAnswer(userMessage: string): Promise<string> {
        if (await this.checkOllamaService()) {
            const prompt = `你是一个专业的前端开发助手，特别擅长Kpc组件开发,你的回答要结合Kpc组件库的文档和示例代码。

用户问题：${userMessage}

请用友好、专业的语调回答用户的问题。如果问题与KPC组件库相关但你需要更具体的信息，请引导用户提供更多细节。`;

            console.log('💭 AI正在思考回答...');
            return await this.callOllama(prompt);
        } else {
            return `您好！我是KPC组件库助手。您的问题"${userMessage}"需要AI回答，但Ollama服务当前不可用。

请确保：
1. Ollama服务正在运行: ollama serve
2. 模型已下载: ollama pull ${this.model}
3. 服务地址正确: ${this.ollamaHost}

或者您可以询问具体的KPC组件问题，我可以为您查询准确的组件信息。`;
        }
    }

    /**
     * 生成最终答案
     */
    private async generateFinalAnswer(userMessage: string, toolResult: string): Promise<string> {
        const prompt = `你是KPC组件库专家，基于以下信息回答用户问题：

用户问题：${userMessage}

工具查询结果：
${toolResult}

请根据查询结果，用友好、专业的语调回答用户问题：
1. 直接回答用户的问题
2. 提供实用的建议和代码示例
3. 如果合适，补充相关的最佳实践
4. 保持回答简洁明了`;

        console.log('💡 AI正在生成最终回答...');
        return await this.callOllama(prompt);
    }

    /**
     * 调用Ollama API
     */
    private async callOllama(prompt: string): Promise<string> {
        try {
            const response = await fetch(`${this.ollamaHost}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.1,
                        top_p: 0.9,
                        num_predict: 2048
                    }
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data: OllamaResponse = await response.json();
            return data.response;
        } catch (error) {
            console.error('❌ Ollama连接失败，请确保：');
            console.error('   1. Ollama服务正在运行: ollama serve');
            console.error(`   2. 模型已下载: ollama pull ${this.model}`);
            console.error(`   3. 服务地址正确: ${this.ollamaHost}`);
            throw new Error(`无法连接到Ollama服务: ${error}`);
        }
    }

    /**
     * 检查Ollama服务是否可用
     */
    async checkOllamaService(): Promise<boolean> {
        try {
            const response = await fetch(`${this.ollamaHost}/api/tags`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * 流式聊天（实时响应）
     */
    async chatStream(userMessage: string, onChunk: (chunk: string) => void): Promise<void> {
        try {
            // 检测工具需求
            const toolAction = await this.detectToolNeeded(userMessage);
            
            if (toolAction) {
                onChunk(`🔧 正在查询${toolAction.name}...\n\n`);
                
                // 执行工具调用
                const toolResult = await this.executeTool(toolAction);
                
                if (await this.checkOllamaService()) {
                    // 流式生成最终回答
                    await this.streamFinalAnswer(userMessage, toolResult, onChunk);
                } else {
                    onChunk(toolResult);
                }
            } else {
                // 直接流式回答
                await this.streamDirectAnswer(userMessage, onChunk);
            }
        } catch (error) {
            console.error('Stream chat error:', error);
            onChunk(`抱歉，处理您的问题时出现错误：${error}`);
        }
    }

    /**
     * 流式生成最终答案
     */
    private async streamFinalAnswer(userMessage: string, toolResult: string, onChunk: (chunk: string) => void): Promise<void> {
        const prompt = `你是KPC组件库专家，基于以下信息回答用户问题：

用户问题：${userMessage}

工具查询结果：
${toolResult}

请根据查询结果，用友好、专业的语调回答用户问题。`;

        await this.streamOllama(prompt, onChunk);
    }

    /**
     * 流式直接回答
     */
    private async streamDirectAnswer(userMessage: string, onChunk: (chunk: string) => void): Promise<void> {
        if (await this.checkOllamaService()) {
            const prompt = `你是一个专业的前端开发助手，特别擅长Vue组件开发。

用户问题：${userMessage}

请用友好、专业的语调回答用户的问题。`;

            await this.streamOllama(prompt, onChunk);
        } else {
            onChunk(`您好！我是KPC组件库助手。您的问题需要AI回答，但Ollama服务当前不可用。

请询问具体的KPC组件问题，我可以为您查询准确的组件信息。`);
        }
    }

    /**
     * 流式调用Ollama
     */
    private async streamOllama(prompt: string, onChunk: (chunk: string) => void): Promise<void> {
        try {
            const response = await fetch(`${this.ollamaHost}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    stream: true,
                    options: {
                        temperature: 0.1,
                        top_p: 0.9,
                    }
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Failed to get response reader');
            }

            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    try {
                        const data: OllamaResponse = JSON.parse(line);
                        if (data.response) {
                            onChunk(data.response);
                        }
                    } catch (e) {
                        // 忽略JSON解析错误
                    }
                }
            }
        } catch (error) {
            console.error('Stream Ollama error:', error);
            onChunk(`流式响应失败：${error}`);
        }
    }

    /**
     * 获取MCP客户端（用于高级操作）
     */
    getMCPClient(): KPCMCPClient {
        return this.mcpClient;
    }
}