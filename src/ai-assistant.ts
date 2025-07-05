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

export class KPCAIAssistant {
    private mcpClient: KPCMCPClient;
    private ollamaHost: string;
    private model: string;

    constructor(ollamaHost = 'http://localhost:11434', model = 'qwen3:8b', mcpServerCommand = 'kpc-mcp-server') {
        this.ollamaHost = ollamaHost;
        this.model = model;
        this.mcpClient = new KPCMCPClient(mcpServerCommand);
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
            const toolAction = this.detectToolNeeded(userMessage);
            
            if (toolAction) {
                console.log(`🔧 检测到需要工具: ${toolAction.name}`);
                
                // 执行工具调用
                const toolResult = await this.executeTool(toolAction);
                
                // 如果Ollama可用，让AI生成自然语言回答
                if (await this.checkOllamaService()) {
                    return await this.generateFinalAnswer(userMessage, toolResult);
                } else {
                    // 直接返回工具结果
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
     * 检测是否需要工具调用（基于规则）
     */
    private detectToolNeeded(message: string): FunctionCall | null {
        const msg = message.toLowerCase();
        
        // 从MCP服务器获取组件列表的占位符
        // 注意：这里简化处理，实际可以缓存组件列表
        const commonComponents = ['button', 'form', 'table', 'input', 'select', 'dialog', 'message', 'tooltip'];
        const mentionedComponent = commonComponents.find(name => msg.includes(name));
        
        // 1. 明确询问组件属性/API
        if ((msg.includes('属性') || msg.includes('props') || msg.includes('api') || msg.includes('参数')) && mentionedComponent) {
            return {
                name: 'get_kpc_component',
                arguments: { component: this.capitalizeFirst(mentionedComponent) }
            };
        }
        
        // 2. 询问使用方法/示例
        if ((msg.includes('如何使用') || msg.includes('怎么用') || msg.includes('示例') || msg.includes('例子') || msg.includes('用法')) && mentionedComponent) {
            const scenario = this.extractScenario(message);
            return {
                name: 'get_kpc_usage_examples',
                arguments: { 
                    component: this.capitalizeFirst(mentionedComponent),
                    scenario: scenario
                }
            };
        }
        
        // 3. 验证配置
        if ((msg.includes('验证') || msg.includes('检查') || msg.includes('正确') || msg.includes('配置')) && mentionedComponent) {
            const props = this.extractPropsFromMessage(message);
            return {
                name: 'validate_kpc_usage',
                arguments: {
                    component: this.capitalizeFirst(mentionedComponent),
                    props: props
                }
            };
        }
        
        // 4. 搜索组件
        if (msg.includes('搜索') || msg.includes('查找') || msg.includes('找') || msg.includes('相关组件')) {
            const query = this.extractSearchQuery(message);
            return {
                name: 'search_kpc_components',
                arguments: { query: query }
            };
        }
        
        // 5. 统计信息
        if (msg.includes('多少个') || msg.includes('总共') || msg.includes('统计') || msg.includes('数量')) {
            return {
                name: 'get_kpc_stats',
                arguments: {}
            };
        }
        
        // 6. 如果提到了组件名但没有明确意图，获取组件信息
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
     * 提取使用场景
     */
    private extractScenario(message: string): string | undefined {
        const scenarios = ['基础用法', '表单验证', '高级配置', '事件处理', '自定义样式', '分页', '排序', '筛选'];
        
        for (const scenario of scenarios) {
            if (message.includes(scenario)) {
                return scenario;
            }
        }
        
        if (message.includes('分页')) return '分页';
        if (message.includes('验证')) return '表单验证';
        if (message.includes('事件')) return '事件处理';
        
        return undefined;
    }

    /**
     * 从消息中提取属性配置
     */
    private extractPropsFromMessage(message: string): any {
        try {
            // 尝试提取JSON对象
            const jsonMatch = message.match(/\{[^}]+\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            // 忽略解析错误
        }
        
        // 简单的属性提取
        const props: any = {};
        
        if (message.includes('type')) {
            const typeMatch = message.match(/type[：:]\s*["']?(\w+)["']?/);
            if (typeMatch) props.type = typeMatch[1];
        }
        
        if (message.includes('size')) {
            const sizeMatch = message.match(/size[：:]\s*["']?(\w+)["']?/);
            if (sizeMatch) props.size = sizeMatch[1];
        }
        
        return props;
    }

    /**
     * 提取搜索关键词
     */
    private extractSearchQuery(message: string): string {
        return message
            .replace(/搜索|查找|找|相关组件|的组件|组件/g, '')
            .trim();
    }

    /**
     * 执行工具调用
     */
    private async executeTool(toolCall: FunctionCall): Promise<string> {
        const { name, arguments: args } = toolCall;

        try {
            switch (name) {
                case 'get_kpc_component':
                    return await this.mcpClient.getComponent(args.component);
                
                case 'search_kpc_components':
                    return await this.mcpClient.searchComponents(args.query, args.category, args.fuzzy);
                
                case 'get_kpc_usage_examples':
                    return await this.mcpClient.getUsageExamples(args.component, args.scenario, args.framework);
                
                case 'validate_kpc_usage':
                    return await this.mcpClient.validateUsage(args.component, args.props, args.context);
                
                case 'get_kpc_stats':
                    return await this.mcpClient.getStats();
                
                default:
                    return `未知工具：${name}`;
            }
        } catch (error) {
            return `工具执行失败：${error}`;
        }
    }

    /**
     * 直接回答（无需工具）
     */
    private async directAnswer(userMessage: string): Promise<string> {
        if (await this.checkOllamaService()) {
            const prompt = `你是一个专业的前端开发助手，特别擅长Vue组件开发。

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
            const toolAction = this.detectToolNeeded(userMessage);
            
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