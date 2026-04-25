import { memo } from 'react';
import MaximizeChatSpace from './MaximizeChatSpace';
import FontSizeSelector from './FontSizeSelector';
import SendMessageKeyEnter from './EnterToSend';
import ShowThinking from './ShowThinking';
import LaTeXParsing from './LaTeXParsing';
import ScrollButton from './ScrollButton';
import SaveDraft from './SaveDraft';

function Chat() {
  return (
    <div className="flex flex-col gap-3 p-1 text-sm text-text-primary">
      <div className="pb-3">
        <FontSizeSelector />
      </div>
      <div className="pb-3">
        <SendMessageKeyEnter />
      </div>
      <div className="pb-3">
        <MaximizeChatSpace />
      </div>
      <div className="pb-3">
        <SaveDraft />
      </div>
      <div className="pb-3">
        <ScrollButton />
      </div>
      <div className="pb-3">
        <LaTeXParsing />
      </div>
      <div className="pb-3">
        <ShowThinking />
      </div>
    </div>
  );
}

export default memo(Chat);
