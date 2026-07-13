import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Phone, MessageSquare, Eye, EyeOff, ArrowLeft, Check, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import UserAgreementDialog from '@/components/UserAgreementDialog';
import WechatConfigDialog from '@/components/WechatConfigDialog';

/** 将 Supabase Auth 的英文错误消息映射为中文 */
function localizeAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('user already registered')) return '该账号已注册，请直接登录';
  if (lower.includes('invalid login credentials')) return '用户名或密码错误';
  if (lower.includes('email not confirmed')) return '账号未验证，请检查邮箱';
  if (lower.includes('phone not confirmed')) return '手机号未验证';
  if (lower.includes('token has expired') || lower.includes('token is invalid')) return '验证码已过期或无效，请重新获取';
  if (lower.includes('signup disabled')) return '注册功能已关闭';
  if (lower.includes('user not found')) return '用户不存在';
  if (lower.includes('password should be at least')) return '密码至少需要6位';
  if (lower.includes('unable to validate invalid phone')) return '手机号格式不正确';
  if (lower.includes('rate limit')) return '操作过于频繁，请稍后再试';
  if (lower.includes('identity already exists')) return '该账号已绑定其他登录方式';
  if (lower.includes('for security purposes')) return '出于安全考虑，请稍后再试';
  return msg;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'phone' | 'username'>('phone');

  // Phone login state
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Username login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Shared state
  const [agreed, setAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [showWechatHelp, setShowWechatHelp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Phone OTP first-time login: show agreement after OTP verification for new users
  const [phoneFirstTime, setPhoneFirstTime] = useState(false);

  // Check if already logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
        navigate(from, { replace: true });
      }
    });
  }, [navigate, location.state]);

  // OTP countdown
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => setOtpCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  const sendOtp = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast.error('请输入正确的手机号');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: '+86' + phone });
      if (error) throw error;
      setOtpSent(true);
      setOtpCountdown(60);
      toast.success('验证码已发送');
    } catch (err) {
      const msg = err instanceof Error ? localizeAuthError(err.message) : '发送失败';
      toast.error(`发送失败: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otpCode)) {
      toast.error('请输入6位验证码');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: '+86' + phone,
        token: otpCode,
        type: 'sms',
      });
      if (error) throw error;

      // Check if this is a first-time login (auto-registration)
      const authResult = await supabase.auth.getUser();
  const user = authResult?.data?.user ?? null;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();
        if (!profile) {
          // New user: show agreement before proceeding
          setPhoneFirstTime(true);
          setShowAgreement(true);
          setIsLoading(false);
          return;
        }
      }

      toast.success('登录成功');
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? localizeAuthError(err.message) : '验证失败';
      toast.error(`验证失败: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsernameLogin = async () => {
    if (!username.trim()) { toast.error('请输入用户名'); return; }
    if (!password) { toast.error('请输入密码'); return; }

    setIsLoading(true);
    try {
      const email = `${username.trim()}@miaoda.com`;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('登录成功');
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? localizeAuthError(err.message) : '登录失败';
      toast.error(`登录失败: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsernameSignup = async () => {
    if (!username.trim()) { toast.error('请输入用户名'); return; }
    if (!password || password.length < 6) { toast.error('密码至少6位'); return; }
    if (!agreed) { toast.error('请先阅读并同意用户注册协议'); return; }

    setIsLoading(true);
    try {
      const email = `${username.trim()}@miaoda.com`;
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      toast.success('注册成功，已自动登录');
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? localizeAuthError(err.message) : '注册失败';
      toast.error(`注册失败: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWechatLogin = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        // @ts-ignore - wechat provider may not be in type definitions
        provider: 'wechat',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('微信登录配置异常');
      }
    } catch (err) {
      const msg = err instanceof Error ? localizeAuthError(err.message) : '登录失败';
      toast.error(`微信登录失败: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </button>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">欢迎使用</h1>
          <p className="text-sm text-muted-foreground">登录后即可使用全部 AI 视频创作功能</p>
        </div>

        {/* Mode Toggle */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-sm">
          <button
            type="button"
            className={`flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-sm transition-colors ${
              mode === 'phone'
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => { setMode('phone'); setOtpSent(false); }}
          >
            <Phone className="h-4 w-4" />
            手机验证码
          </button>
          <button
            type="button"
            className={`flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-sm transition-colors ${
              mode === 'username'
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setMode('username')}
          >
            <MessageSquare className="h-4 w-4" />
            用户名密码
          </button>
        </div>

        {/* Phone Mode */}
        {mode === 'phone' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>手机号</Label>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-3 text-sm border border-border rounded-sm bg-muted/20 shrink-0">+86</span>
                <Input
                  type="tel"
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className="bg-background border-border"
                />
              </div>
            </div>

            {otpSent && (
              <div className="space-y-2">
                <Label>验证码</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="6位验证码"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="bg-background border-border"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={otpCountdown > 0 || isLoading}
                    onClick={sendOtp}
                    className="shrink-0"
                  >
                    {otpCountdown > 0 ? `${otpCountdown}s` : '重新发送'}
                  </Button>
                </div>
              </div>
            )}

            {!otpSent ? (
              <Button
                onClick={sendOtp}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? '发送中...' : '获取验证码'}
              </Button>
            ) : (
              <Button
                onClick={verifyOtp}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? '登录中...' : '登录 / 注册'}
              </Button>
            )}
          </div>
        )}

        {/* Username Mode */}
        {mode === 'username' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input
                placeholder="仅支持字母、数字和下划线"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>密码</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="至少6位字符"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background border-border pr-10"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleUsernameLogin}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? '登录中...' : '登录'}
              </Button>
              <Button
                onClick={handleUsernameSignup}
                disabled={isLoading || !agreed}
                variant="outline"
                className="flex-1"
              >
                注册
              </Button>
            </div>

            {/* Agreement — only shown for username signup */}
            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="agreement"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5 shrink-0"
              />
              <label htmlFor="agreement" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                我已阅读并同意
                <button
                  type="button"
                  className="text-primary hover:underline inline"
                  onClick={(e) => { e.preventDefault(); setShowAgreement(true); }}
                >
                  《用户注册协议》
                </button>
                ，包括但不限于服务条款、隐私政策、用户行为规范、知识产权声明及免责声明。
              </label>
            </div>
          </div>
        )}

        {/* WeChat Login */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">或</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleWechatLogin}
            disabled={isLoading}
            variant="outline"
            className="flex-1"
          >
            <MessageSquare className="h-4 w-4 mr-2 text-green-500" />
            微信快捷登录
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setShowWechatHelp(true)}
            title="微信登录配置说明"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>

      </div>

      <UserAgreementDialog
        open={showAgreement}
        onOpenChange={setShowAgreement}
        onAgree={() => {
          setAgreed(true);
          setShowAgreement(false);
          if (phoneFirstTime) {
            setPhoneFirstTime(false);
            toast.success('注册成功');
            navigate('/', { replace: true });
          }
        }}
      />

      <WechatConfigDialog
        open={showWechatHelp}
        onOpenChange={setShowWechatHelp}
      />
    </div>
  );
}
