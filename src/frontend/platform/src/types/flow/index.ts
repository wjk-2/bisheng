import { Edge, Node, ReactFlowJsonObject, Viewport, XYPosition } from "@xyflow/react";
import { APIClassType } from "../api/index";

export const enum OnlineState {
  OffLine = 1,
  OnLine = 2
}

/** 流程 */
export type FlowState = {
  edges: {
    source: string;
    target: string;
    /** 来源节点内部的唯一ID，目前只有condition节点需要 */
    source_internal_id
  }[];
  views: FlowNode[];
  viewport: Viewport;
}

/** 流程节点 */
interface FlowNode {
  id: string;
  name: string;
  type: string;
  inputVariable: Record<string, unknown>;
  outputVariable: Record<string, unknown>;
  data?: {
    edges: {
      source: string;
      target: string;
    }[];
    nodes: unknown[];
    viewport: Viewport;
  }
}


export type FlowType = {
  name: string;
  id: string;
  data: ReactFlowJsonObject | null;
  description: string;
  status: number;
  style?: FlowStyleType;
  user_name?: string;
  write: boolean;
  guide_word: string
  is_component?: boolean;
  parent?: string;
  date_created?: string;
  updated_at?: string;
  last_tested_version?: string;
  logo?: string;
};
export type NodeType = {
  id: string;
  type?: string;
  position: XYPosition;
  data: NodeDataType;
  selected?: boolean;
};

export type NodeDataType = {
  showNode?: boolean;
  type: string;
  node?: APIClassType;
  id: string;
  output_types?: string[];
};
// FlowStyleType is the type of the style object that is used to style the
// Flow card with an emoji and a color.
export type FlowStyleType = {
  emoji: string;
  color: string;
  flow_id: string;
};

export type TweaksType = Array<
  {
    [key: string]: {
      output_key?: string;
    };
  } & FlowStyleType
>;

// right side
export type sourceHandleType = {
  dataType: string;
  id: string;
  baseClasses: string[];
};
//left side
export type targetHandleType = {
  inputTypes?: string[];
  type: string;
  fieldName: string;
  id: string;
  proxy?: { field: string; id: string };
};


export type FlowVersionItem = {
  create_time: string;
  data: Record<string, unknown> | null;
  description: string | null;
  flow_id: string;
  id: number;
  is_current: number;
  is_delete: number;
  name: string;
  update_time: string;
  user_id: string | null;
};

export interface WorkFlow {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  // status: number;
  // style?: FlowStyleType;
  // user_name?: string;
  // write: boolean;
  // guide_word: string;
  // is_component?: boolean;
  // parent?: string;
}

export interface WorkflowNode {
  /** node id */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Node type, */
  type: string; // 'start' | 'output' | 'code' | 'llm' | 'rag' | 'qa_retriever' | 'agent' | 'end' | 'condition' | 'input' | 'report' | 'tool';
  group_params: {
    /** group name */
    name?: string;
    /** group parameters */
    params: WorkflowNodeParam[];
  }[];

  /** tab */
  tab?: {
    /** Current value */
    value: string;
    /** options */
    options: {
      /** Display label */
      label: string;
      /** Unique key */
      key: string;
      /** help text */
      help?: string;
    }[];
  };

  /**  tool id */
  tool_id?: string;
}

/** 工作流节点参数值类型 - 动态业务数据 */
export type WorkflowParamValue = string | number | boolean | null | unknown[] | Record<string, unknown>;

/** 工作流节点选项类型 */
export interface WorkflowNodeOption {
  /** Display label */
  label: string;
  /** Unique key */
  key: string;
  /** help text */
  help?: string;
}

export interface WorkflowNodeParam {
  /** Unique key */
  key: string;
  /** Optional display */
  label?: string;
  /** type */
  type: string;
  /** value - 动态业务数据 */
  value: WorkflowParamValue;
  /** placeholder */
  placeholder?: string;
  /** help text */
  help?: string;
  /** tab */
  tab?: string;
  /** required*/
  required?: boolean;
  /**  multiple value */
  multi?: boolean;
  /** Array of options */
  options?: WorkflowNodeOption[];
  test?: string,
  hidden?: boolean;
}

/** 工作流消息文件类型 - 后端 Output/Report 节点生成 */
export interface WorkflowMessageFile {
  /** 文件下载/预览链接 */
  path: string;
  /** 文件名称 */
  name: string;
}

/** 工作流消息结构 */
export interface WorkflowMessage {
  category: string;
  node_id?: string;
  flow_id: string;
  chat_id: string | null;
  message_id: string | null;
  files: WorkflowMessageFile[];
  is_bot: boolean;
  liked?: boolean;
  message: string | Record<string, unknown> | unknown[];
  receiver: Record<string, unknown> | null;
  sender: string | null;
  source: number;
  user_id: number;
  end: boolean;
  update_time: string;
  reasoning_log?: string;
  extra?: string;
}