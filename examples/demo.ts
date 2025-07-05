/**
 * KPC AI助手演示
 */
import { KPCAIAssistant } from '../src/ai-assistant.js';

async function main() {
    console.log('🚀 启动KPC AI助手演示...\n');

    // 创建助手实例
    const assistant = new KPCAIAssistant(
        'http://localhost:11434',  // Ollama服务地址
        'qwen3:8b',               // 使用的模型
        'kpc-mcp-server'          // MCP服务命令
    );

    // 初始化
    try {
        await assistant.initialize();
    } catch (error) {
        console.error('❌ 初始化失败:', error);
        console.log('请确保：');
        console.log('1. kpc-mcp-server 已安装并可全局访问');
        console.log('2. 或者将完整路径传递给构造函数');
        return;
    }

    // 测试问题列表
    const questions = [
        'Button组件有哪些属性？',
        '如何使用Form组件进行表单验证？',
        '搜索所有表单相关的组件',
        'Table组件如何实现分页？',
        '验证这个Button配置是否正确：{type: "primary", size: "large"}',
        'KPC组件库总共有多少个组件？',
        '你好，请介绍一下你自己'  // 测试一般对话
    ];

    console.log('📝 开始问答测试:\n');

    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        console.log(`❓ 问题 ${i + 1}: ${question}`);
        console.log('🤔 思考中...\n');

        try {
            const answer = await assistant.chat(question);
            console.log(`💡 回答:`);
            console.log(answer);
        } catch (error) {
            console.log(`❌ 回答失败: ${error}`);
        }

        console.log('\n' + '='.repeat(80) + '\n');

        // 间隔一下，避免请求过快
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✅ 演示完成！');
    
    // 清理资源
    await assistant.cleanup();
}

// 处理Ctrl+C
process.on('SIGINT', async () => {
    console.log('\n👋 正在退出...');
    process.exit(0);
});

// 运行演示
main().catch(console.error);