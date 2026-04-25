import { useState, memo } from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import type { NavLink } from '~/common';
import { Accordion, AccordionItem, AccordionContent } from '~/components/ui/Accordion';
import { Button } from '~/components';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface AccordionNavProps {
  links: NavLink[];
}

/**
 * 左侧导航栏的手风琴组件
 * 用于展示 Prompts、Bookmarks、Parameters 等可折叠面板
 */
function AccordionNav({ links }: AccordionNavProps) {
  const localize = useLocalize();
  const [active, setActive] = useState<string | undefined>(
    localStorage.getItem('nav:active-panel') || undefined
  );

  const setActivePanel = (id: string) => {
    localStorage.setItem('nav:active-panel', id);
    setActive(id);
  };

  if (links.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border-light px-2 py-2">
      <Accordion type="single" value={active} onValueChange={setActivePanel} collapsible>
        {links.map((link) => (
          <AccordionItem key={link.id} value={link.id} className="border-none">
            <AccordionPrimitive.Header asChild>
              <AccordionPrimitive.Trigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-text-secondary hover:text-text-primary"
                >
                  <link.icon className="mr-2 h-4 w-4" />
                  {localize(link.title)}
                </Button>
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>
            <AccordionContent className="text-text-primary max-h-[300px] overflow-y-auto">
              {link.Component && <link.Component />}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export default memo(AccordionNav);
