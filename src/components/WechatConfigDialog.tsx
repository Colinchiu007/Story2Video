import React from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface WechatConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WechatConfigDialog({ open, onOpenChange }: WechatConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-balance flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            微信登录配置指南
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2 text-sm text-foreground">
          <section className="space-y-2">
            <h3 className="font-semibold text-base">一、准备工作</h3>
            <p className="text-muted-foreground leading-relaxed">
              微信快捷登录需要在 Supabase 控制台中配置微信 OAuth 应用信息。
              您需要先在微信公众平台申请一个网站应用，获取 AppID 和 AppSecret。
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">二、申请微信网站应用</h3>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground leading-relaxed">
              <li>登录 <a href="https://open.weixin.qq.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">微信开放平台</a></li>
              <li>进入「管理中心」→「网站应用」→「创建网站应用」</li>
              <li>填写应用名称、简介、官网等信息并提交审核</li>
              <li>审核通过后，在应用详情页获取 AppID 和 AppSecret</li>
              <li>在「接口权限」中确认已开通「微信登录」权限</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">三、配置回调域名</h3>
            <p className="text-muted-foreground leading-relaxed">
              在微信开放平台的应用设置中，将您的网站域名添加到「授权回调域」中。
              例如：如果您的应用部署在 <code className="bg-muted px-1 rounded text-xs">https://your-app.com</code>，
              则需要将 <code className="bg-muted px-1 rounded text-xs">your-app.com</code> 添加到回调域白名单。
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">四、在 Supabase 中配置</h3>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground leading-relaxed">
              <li>登录 Supabase Dashboard，进入您的项目</li>
              <li>点击左侧「Authentication」→「Providers」</li>
              <li>找到「WeChat」Provider 并启用</li>
              <li>填入微信开放平台的 AppID 和 AppSecret</li>
              <li>保存配置后即可使用微信快捷登录</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">五、常见问题</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed">
              <li>如果点击微信登录无反应，请检查 AppID 和 AppSecret 是否填写正确</li>
              <li>如果出现「redirect_uri 参数错误」，请检查回调域配置</li>
              <li>微信网站应用审核通常需要 1-3 个工作日</li>
              <li>个人开发者也可申请，但需完成微信实名认证</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
