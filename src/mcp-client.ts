/**
 * KPC MCP 客户端连接器
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface MCPToolResult {
    content: Array<{
        type: string;
        text: string;
    }>;
}

export class KPCMCPClient {
    private client: Client;
    private transport: StdioClientTransport | null = null;
    private connected = false;
    private serverCommand: string;

    constructor(serverCommand = 'kpc-mcp-server') {
        // 如果是默认命令，尝试找到可用的路径
        if (serverCommand === 'kpc-mcp-server') {
            this.serverCommand = this.findServerCommand();
        } else {
            this.serverCommand = serverCommand;
        }
        this.client = new Client(
            {
                name: 'kpc-ai-assistant',
                version: '1.0.0',
            },
            {
                capabilities: {},
            }
        );
    }

    /**
     * 连接到MCP服务器
     */
    async connect(): Promise<void> {
        if (this.connected) return;

        try {
            console.log('🔌 正在连接到KPC MCP服务器...');

            // 解析命令和参数
            let command: string;
            let args: string[] = [];
            
            // 处理带有参数的命令（如 "node /path/to/server.js"）
            if (this.serverCommand.includes(' ')) {
                const parts = this.serverCommand.split(' ');
                command = parts[0];
                args = parts.slice(1);
            } else {
                command = this.serverCommand;
            }
            
            console.log(`🚀 启动MCP服务器: ${command} ${args.join(' ')}`);
            
            if (!command) {
                throw new Error('Server command is empty or undefined');
            }

            // 创建传输层 - SDK 会自动处理进程启动
            this.transport = new StdioClientTransport({
                command: command,
                args: args,
                stderr: 'pipe' // 允许捕获 stderr
            });

            // 监听 stderr 输出
            if (this.transport.stderr) {
                this.transport.stderr.on('data', (data) => {
                    const message = data.toString();
                    if (message.includes('已启动') || message.includes('等待请求')) {
                        console.log('📡 MCP服务器状态:', message.trim());
                    }
                });
            }

            // 连接到服务器 - 这会自动启动进程
            await this.client.connect(this.transport);
            this.connected = true;

            console.log('✅ 已连接到KPC MCP服务器');
        } catch (error) {
            console.error('❌ 连接MCP服务器失败:', error);
            throw error;
        }
    }

    /**
     * 断开连接
     */
    async disconnect(): Promise<void> {
        if (!this.connected) return;

        try {
            if (this.client) {
                await this.client.close();
            }
            // SDK 会自动处理进程清理
            this.connected = false;
            console.log('✅ 已断开MCP服务器连接');
        } catch (error) {
            console.error('❌ 断开连接失败:', error);
        }
    }

    /**
     * 确保已连接
     */
    private async ensureConnected(): Promise<void> {
        if (!this.connected) {
            await this.connect();
        }
    }

    /**
     * 获取组件信息
     */
    async getComponent(component: string): Promise<string> {
        await this.ensureConnected();

        try {
            const result = await this.client.callTool({
                name: 'get_kpc_component',
                arguments: { component },
            });

            return result.content[0]?.text || '未获取到结果';
        } catch (error) {
            console.error('获取组件信息失败:', error);
            throw error;
        }
    }

    /**
     * 搜索组件
     */
    async searchComponents(query: string, category?: string, fuzzy = false): Promise<string> {
        await this.ensureConnected();

        try {
            const result = await this.client.callTool({
                name: 'search_kpc_components',
                arguments: { query, category, fuzzy },
            });

            return result.content[0]?.text || '未找到匹配的组件';
        } catch (error) {
            console.error('搜索组件失败:', error);
            throw error;
        }
    }

    /**
     * 列出组件
     */
    async listComponents(category?: string, summary = false): Promise<string> {
        await this.ensureConnected();

        try {
            const result = await this.client.callTool({
                name: 'list_kpc_components',
                arguments: { category, summary },
            });

            return result.content[0]?.text || '未获取到组件列表';
        } catch (error) {
            console.error('获取组件列表失败:', error);
            throw error;
        }
    }

    /**
     * 验证组件使用
     */
    async validateUsage(component: string, props: any, context?: string): Promise<string> {
        await this.ensureConnected();

        try {
            const result = await this.client.callTool({
                name: 'validate_kpc_usage',
                arguments: { component, props, context },
            });

            return result.content[0]?.text || '验证失败';
        } catch (error) {
            console.error('验证组件使用失败:', error);
            throw error;
        }
    }

    /**
     * 获取使用示例
     */
    async getUsageExamples(component: string, scenario?: string, framework = 'vue3'): Promise<string> {
        await this.ensureConnected();

        try {
            const result = await this.client.callTool({
                name: 'get_kpc_usage_examples',
                arguments: { component, scenario, framework },
            });

            return result.content[0]?.text || '未获取到示例';
        } catch (error) {
            console.error('获取使用示例失败:', error);
            throw error;
        }
    }

    /**
     * 获取统计信息
     */
    async getStats(): Promise<string> {
        await this.ensureConnected();

        try {
            const result = await this.client.callTool({
                name: 'get_kpc_stats',
                arguments: {},
            });

            return result.content[0]?.text || '未获取到统计信息';
        } catch (error) {
            console.error('获取统计信息失败:', error);
            throw error;
        }
    }

    /**
     * 检查服务器是否已连接
     */
    isConnected(): boolean {
        return this.connected;
    }

    /**
     * 获取可用工具列表
     */
    async getAvailableTools(): Promise<any[]> {
        await this.ensureConnected();

        try {
            const result = await this.client.listTools();
            return result.tools;
        } catch (error) {
            console.error('获取工具列表失败:', error);
            return [];
        }
    }

    /**
     * 查找可用的服务器命令
     */
    private findServerCommand(): string {
        // 直接使用命令名，让系统在 PATH 中查找
        // spawn 会自动在 PATH 中查找可执行文件
        console.log(`✅ 使用MCP服务器: kpc-mcp-server`);
        return 'kpc-mcp-server';
    }
}