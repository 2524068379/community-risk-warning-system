import { Card } from 'antd';
import type { PropsWithChildren, ReactNode } from 'react';

interface SectionCardProps extends PropsWithChildren {
  title: string;
  extra?: ReactNode;
  className?: string;
}

export function SectionCard({ title, extra, children, className }: SectionCardProps) {
  return (
    <Card
      className={className}
      title={<span className="section-title">{title}</span>}
      extra={extra}
      variant="borderless"
    >
      {children}
    </Card>
  );
}
