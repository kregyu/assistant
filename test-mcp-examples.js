#!/usr/bin/env node

/**
 * 测试MCP服务的get_kpc_usage_examples功能
 */

import { KPCAIAssistant } from './dist/src/ai-assistant.js';

async function testMCPExamples() {
  console.log('🧪 测试MCP服务的get_kpc_usage_examples功能...\n');
  
  const assistant = new KPCAIAssistant();
  await assistant.initialize();
  
  const mcpClient = assistant.getMCPClient();
  
  // 测试几个不同的组件
  const testComponents = ['Button', 'Input', 'Form', 'Table'];
  
  for (const componentName of testComponents) {
    console.log(`\n📦 测试 ${componentName} 组件示例:`);
    console.log('='.repeat(50));
    
    try {
      const examples = await mcpClient.getUsageExamples(componentName);
      
      if (examples && examples.trim()) {
        console.log(examples);
      } else {
        console.log('❌ 没有返回示例内容');
      }
    } catch (error) {
      console.error(`❌ 获取 ${componentName} 示例失败:`, error.message);
    }
    
    console.log('\n' + '-'.repeat(50));
  }
  
  // 测试特定场景
  console.log('\n🎯 测试特定场景示例:');
  console.log('='.repeat(50));
  
  try {
    const formExample = await mcpClient.getUsageExamples('Input', '表单验证');
    console.log('Input 表单验证示例:');
    console.log(formExample);
  } catch (error) {
    console.error('❌ 获取表单验证示例失败:', error.message);
  }
  
  await assistant.cleanup();
}

testMCPExamples().catch(console.error);