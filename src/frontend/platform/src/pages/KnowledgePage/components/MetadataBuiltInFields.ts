/** 内置元数据字段公共常量（B2 抽离，消除 MetadataManagementDialog 与 MetadataFilter 硬编码口径不一）。
 *
 * 12 项内置字段：document_id/document_name/upload_time/update_time/uploader/updater
 * + abstract/chunk_index/bbox/page/knowledge_id/user_metadata。
 * MetadataFilter 原硬编码仅前 6 项，检索过滤看不到后 6 项；统一引用本常量。
 */

export type BuiltInMetadataType = "String" | "Number" | "Time";

export interface BuiltInMetadataField {
  name: string;
  type: BuiltInMetadataType;
}

export const BUILT_IN_METADATA_FIELDS: BuiltInMetadataField[] = [
  { name: "document_id", type: "Number" },
  { name: "document_name", type: "String" },
  { name: "upload_time", type: "Time" },
  { name: "update_time", type: "Time" },
  { name: "uploader", type: "String" },
  { name: "updater", type: "String" },
  { name: "abstract", type: "String" },
  { name: "chunk_index", type: "Number" },
  { name: "bbox", type: "String" },
  { name: "page", type: "Number" },
  { name: "knowledge_id", type: "Number" },
  { name: "user_metadata", type: "String" },
];

/** 检索过滤默认展示前 6 项（与原 MetadataFilter 硬编码一致，可扩展全 12 项） */
export const DEFAULT_FILTER_METADATA_FIELDS = BUILT_IN_METADATA_FIELDS.slice(0, 6);

export const BUILT_IN_METADATA_NAMES = BUILT_IN_METADATA_FIELDS.map((f) => f.name);
