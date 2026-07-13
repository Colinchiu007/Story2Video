import React from 'react';
import { LayoutTemplate } from 'lucide-react';
import VideoTemplatePicker, { TemplateSelectButton } from '@/components/VideoTemplatePicker';
import { getTemplateById } from '@/lib/template-library';
import type { VideoTemplate } from '@/types/template';

interface TemplateSectionProps {
  selectedTemplateId: string | undefined;
  templateOpen: boolean;
  setTemplateOpen: (v: boolean) => void;
  handleTemplateSelect: (templateId: string | undefined) => void;
}

export default function TemplateSection({
  selectedTemplateId, templateOpen, setTemplateOpen, handleTemplateSelect,
}: TemplateSectionProps) {
  return (
    <div className="flex items-center justify-between rounded-sm border border-border p-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <LayoutTemplate className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          {selectedTemplateId
            ? getTemplateById(selectedTemplateId)?.name ?? '已选模板'
            : '视频模板'}
        </span>
      </div>
      <TemplateSelectButton
        onClick={() => setTemplateOpen(true)}
        hasSelection={!!selectedTemplateId}
      />
      <VideoTemplatePicker
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        selectedId={selectedTemplateId}
        onSelect={(template: VideoTemplate) => handleTemplateSelect(template.id)}
      />
    </div>
  );
}
