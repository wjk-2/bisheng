import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_METADATA_FIELDS,
  DEFAULT_FILTER_METADATA_FIELDS,
  BUILT_IN_METADATA_NAMES,
} from '../MetadataBuiltInFields';

describe('B2 元数据内置字段公共常量', () => {
  it('BUILT_IN_METADATA_FIELDS 含 12 项含后 6 项', () => {
    expect(BUILT_IN_METADATA_FIELDS.length).toBe(12);
    for (const name of ['abstract', 'chunk_index', 'bbox', 'page', 'knowledge_id', 'user_metadata']) {
      expect(BUILT_IN_METADATA_NAMES).toContain(name);
    }
  });

  it('DEFAULT_FILTER_METADATA_FIELDS 为前 6 项（与原硬编码一致）', () => {
    expect(DEFAULT_FILTER_METADATA_FIELDS.length).toBe(6);
    expect(DEFAULT_FILTER_METADATA_FIELDS.map((f) => f.name)).toEqual([
      'document_id', 'document_name', 'upload_time', 'update_time', 'uploader', 'updater',
    ]);
  });

  it('每项含 name 与 type', () => {
    for (const f of BUILT_IN_METADATA_FIELDS) {
      expect(typeof f.name).toBe('string');
      expect(['String', 'Number', 'Time']).toContain(f.type);
    }
  });
});
