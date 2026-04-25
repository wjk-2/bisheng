import React from 'react';
import UserMsgMarkdownSwitch from './UserMsgMarkdownSwitch';
import AutoScrollSwitch from './AutoScrollSwitch';

function General() {
  return (
    <div className="flex flex-col gap-3 p-1 text-sm text-text-primary">
      <div className="pb-3">
        <UserMsgMarkdownSwitch />
      </div>
      <div className="pb-3">
        <AutoScrollSwitch />
      </div>
    </div>
  );
}

export default React.memo(General);
