#!/usr/bin/env node
/**
 * KPC AI助手命令行聊天工具
 */
import readline from 'readline';
import { KPCAIAssistant } from '../src/ai-assistant.js';

class KPCChatCLI {
    private assistant: KPCAIAssistant;
    private rl: readline.Interface;

    constructor() {
        this.assistant = new KPCAIAssistant();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '🤖 KPC助手> '
        });
    }

    async start() {
        console.log('🚀 KPC AI助手启动中...');
        
        try {
            await this.assistant.initialize();
            console.log('✅ 助手初始化完成！');
            console.log('💡 您可以问我关于KPC组件的任何问题');
            console.log('💡 输入 "exit" 或 "quit" 退出');
            console.log('💡 输入 "help" 查看帮助\n');
            
            this.showPrompt();
            this.setupEventHandlers();
        } catch (error) {
            console.error('❌ 初始化失败:', error);
            console.log('\n请确保：');
            console.log('1. kpc-mcp-server 已安装: npm install -g kpc-mcp-server');
            console.log('2. 或者从mcp项目目录运行: npm link');
            process.exit(1);
        }
    }

    private showPrompt() {
        this.rl.prompt();
    }

    private setupEventHandlers() {
        this.rl.on('line', async (input) => {
            const question = input.trim();
            
            if (!question) {
                this.showPrompt();
                return;
            }

            if (question.toLowerCase() === 'exit' || question.toLowerCase() === 'quit') {
                console.log('👋 再见！');
                await this.cleanup();
                return;
            }

            if (question.toLowerCase() === 'help') {
                this.showHelp();
                this.showPrompt();
                return;
            }

            if (question.toLowerCase() === 'stream') {
                console.log('🔄 切换到流式模式，请输入问题：');
                this.rl.question('问题> ', async (streamQuestion) => {
                    console.log('🤔 思考中...\n');
                    
                    try {
                        await this.assistant.chatStream(streamQuestion, (chunk) => {
                            process.stdout.write(chunk);
                        });
                        console.log('\n');
                    } catch (error) {
                        console.log(`❌ 回答失败: ${error}\n`);
                    }
                    
                    this.showPrompt();
                });
                return;
            }

            console.log('🤔 思考中...');
            
            try {
                const answer = await this.assistant.chat(question);
                console.log('\n💡 回答:');
                console.log(answer);
                console.log();
            } catch (error) {
                console.log(`❌ 回答失败: ${error}\n`);
            }

            this.showPrompt();
        });

        this.rl.on('close', async () => {
            console.log('\n👋 感谢使用KPC AI助手！');
            await this.cleanup();
        });

        // 处理Ctrl+C
        this.rl.on('SIGINT', async () => {
            console.log('\n👋 再见！');
            await this.cleanup();
        });
    }

    private async cleanup() {
        await this.assistant.cleanup();
        this.rl.close();
        process.exit(0);
    }

    private showHelp() {
        console.log(`
📚 KPC AI助手使用帮助:

🔍 问题示例:
  • "Button组件有哪些属性？"
  • "如何使用Form组件？"
  • "搜索表单相关组件"
  • "Table组件的分页怎么实现？"
  • "验证这个配置：{type: 'primary'}"

⌨️  命令:
  • help - 显示帮助
  • stream - 切换到流式回答模式
  • exit/quit - 退出程序
  • Ctrl+C - 强制退出

🔧 技术栈:
  • MCP客户端连接到kpc-mcp-server
  • Ollama本地AI模型
  • 智能工具调用
`);
    }
}

// 启动CLI
const cli = new KPCChatCLI();
cli.start().catch(console.error);