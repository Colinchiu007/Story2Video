import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UserAgreementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree?: () => void;
}

export default function UserAgreementDialog({ open, onOpenChange, onAgree }: UserAgreementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-balance">用户注册协议</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60dvh] pr-4">
          <div className="space-y-5 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">一、服务条款</h3>
              <p className="text-pretty">
                欢迎使用 AI 视频创作工具（以下简称"本服务"）。本服务由平台运营方提供，旨在为用户提供基于人工智能技术的视频生成、语音合成及相关辅助功能。使用本服务即表示您同意遵守本协议的全部条款。如您不同意本协议任何条款，请立即停止使用本服务。
              </p>
              <p className="text-pretty mt-2">
                平台有权根据业务发展需要随时修改本协议内容，修改后的协议将在平台上公示，公示后即生效。如您继续使用本服务，视为您接受修改后的协议。
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">二、隐私政策</h3>
              <p className="text-pretty">
                我们重视您的个人信息保护。在您使用本服务过程中，我们可能会收集您的手机号、设备信息、使用日志等数据，用于账户管理、服务优化及安全保障。
              </p>
              <p className="text-pretty mt-2">
                我们承诺：未经您明确同意，不会向任何第三方共享、转让或公开披露您的个人信息，除非法律法规另有规定。您的内容生成数据将严格保密，平台不会将您的生成内容用于商业训练或其他未经授权的用途。
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">三、用户行为规范</h3>
              <p className="text-pretty">
                您在使用本服务时，应当遵守中华人民共和国法律法规，不得利用本服务从事以下行为：
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>生成、传播含有违法违规内容（包括但不限于暴力、色情、赌博、恐怖主义等）的视频或音频</li>
                <li>侵犯他人知识产权、肖像权、名誉权等合法权益</li>
                <li>冒充他人身份或伪造、篡改他人声音、形象</li>
                <li>利用本服务进行诈骗、虚假宣传或其他欺诈行为</li>
                <li>逆向工程、破解、攻击平台系统或干扰服务正常运行</li>
                <li>批量注册账号、使用自动化工具滥用平台资源</li>
              </ul>
              <p className="text-pretty mt-2">
                如您违反上述规定，平台有权采取删除内容、限制功能、封禁账号等措施，并保留追究法律责任的权利。
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">四、知识产权声明</h3>
              <p className="text-pretty">
                平台提供的软件、界面设计、技术方案及相关内容的知识产权归平台所有。您通过本服务生成的视频、音频等内容，其著作权归您所有，但您授予平台非独占的、免费的、全球性的许可，用于平台的技术改进、服务优化及必要的展示用途。
              </p>
              <p className="text-pretty mt-2">
                您应确保您输入的文本、上传的图片或视频不侵犯任何第三方的知识产权或其他合法权益。因您输入内容引发的任何纠纷或法律责任，由您自行承担。
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">五、免责声明</h3>
              <p className="text-pretty">
                本服务基于人工智能技术生成内容，平台不对生成内容的准确性、完整性、合法性或适用性做任何明示或暗示的保证。生成内容仅供参考，请勿将其作为专业建议、法律依据或医疗诊断的依据。
              </p>
              <p className="text-pretty mt-2">
                因不可抗力（包括但不限于自然灾害、政府行为、网络攻击、第三方服务中断等）导致服务中断或数据损失的，平台不承担责任，但会尽力恢复服务并协助用户减少损失。
              </p>
              <p className="text-pretty mt-2">
                因用户自身原因（如密码泄露、设备丢失、违反本协议等）导致的损失，平台不承担责任。
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">六、协议终止与争议解决</h3>
              <p className="text-pretty">
                如您违反本协议，平台有权随时终止向您提供服务并注销您的账户。您也可以随时停止使用本服务并申请注销账户。
              </p>
              <p className="text-pretty mt-2">
                本协议的订立、执行和解释及争议的解决均适用中华人民共和国法律。如双方就本协议内容或其执行发生任何争议，应友好协商解决；协商不成时，任何一方均可向平台所在地有管辖权的人民法院提起诉讼。
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">七、其他</h3>
              <p className="text-pretty">
                本协议构成您与平台之间关于本服务的完整协议，取代此前双方就本服务达成的任何口头或书面约定。如本协议任何条款被认定为无效或不可执行，该条款应在必要限度内修改以使其可执行，其余条款继续有效。
              </p>
              <p className="text-pretty mt-2">
                如有任何问题，请联系平台客服或发送邮件至 support@example.com。
              </p>
            </section>
          </div>
        </ScrollArea>
        {onAgree && (
          <div className="pt-2 border-t border-border">
            <Button onClick={onAgree} className="w-full">
              我已阅读并同意协议
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
