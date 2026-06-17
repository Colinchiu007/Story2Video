import React from 'react';
import { BookOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ApiHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ApiHelpDialog({ open, onOpenChange }: ApiHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-balance flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            自定义 API 配置指南
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2 text-sm text-foreground">
          <section className="space-y-2">
            <h3 className="font-semibold text-base">一、支持的服务商</h3>
            <p className="text-muted-foreground leading-relaxed">
              本工具支持使用 MiniMax、OpenAI 及任何兼容 OpenAI API 格式的大模型服务商。
              您需要自行准备对应平台的 API Key。
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">二、MiniMax 配置示例</h3>
            <div className="space-y-1.5 bg-muted/30 border border-border rounded-sm p-3">
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0">接口基础地址：</span>
                <code className="text-xs break-all bg-muted px-1 rounded">https://api.minimax.chat/v1</code>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0">鉴权密钥：</span>
                <code className="text-xs break-all bg-muted px-1 rounded">sk-xxxxxxxxxxxxxxxx</code>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0">模型名称：</span>
                <code className="text-xs bg-muted px-1 rounded">speech-02-turbo</code>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              1. 前往 <a href="https://www.minimaxi.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">MiniMax 官网</a> 注册账号
              <br />
              2. 进入「开发者中心」创建 API Key
              <br />
              3. 将上述信息填入对应字段即可
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">三、OpenAI 兼容 API 配置示例</h3>
            <div className="space-y-1.5 bg-muted/30 border border-border rounded-sm p-3">
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0">接口基础地址：</span>
                <code className="text-xs break-all bg-muted px-1 rounded">https://api.openai.com/v1</code>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0">鉴权密钥：</span>
                <code className="text-xs break-all bg-muted px-1 rounded">sk-xxxxxxxxxxxxxxxx</code>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0">模型名称：</span>
                <code className="text-xs bg-muted px-1 rounded">gpt-4o-mini</code>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              任何兼容 OpenAI API 格式的服务商均可使用，例如 Azure OpenAI、智谱 AI、Kimi 等。
              接口基础地址通常为以 <code className="bg-muted px-1 rounded text-xs">/v1</code> 结尾的 URL。
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">四、注意事项</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed">
              <li>API 密钥仅保存在您的本地设备和账户中，不会上传到第三方</li>
              <li>使用自定义 API 时，算力费用由您的 API 账户承担</li>
              <li>填写完成后建议点击「测试连通」验证配置是否正确</li>
              <li>请勿填写示例中的占位符地址（如 api.example.com）</li>
              <li>如不再需要自定义 API，可随时切换回「使用内置 AI」</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
