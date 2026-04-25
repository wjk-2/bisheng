-- 智能体分类功能迁移脚本（幂等版）
-- 执行时间: 2026-02-27
-- 功能: 为 assistant 和 flow 表添加 category 字段
-- 幂等性保证:
--   - ADD COLUMN IF NOT EXISTS：列已存在时跳过，不报错
--   - DROP INDEX IF EXISTS + ADD INDEX：先删后建，保证索引状态一致
-- 注意: MySQL DDL (ALTER TABLE) 会触发隐式提交，无法被事务保护。
--       以下 DDL 步骤单独执行，失败后需手动重试。
--       数据迁移 (UPDATE) 步骤使用事务保护。

-- 1. 为 assistant 表添加 category 字段和索引（合并为单次 ALTER，减少 MDL 锁次数）
ALTER TABLE `assistant`
    ADD COLUMN IF NOT EXISTS `category` VARCHAR(32) DEFAULT '其他' COMMENT '分类：助教/助学/助研/助管/助评/其他',
    DROP INDEX IF EXISTS `idx_category`,
    ADD INDEX `idx_category` (`category`);

-- 2. 为 flow 表添加 category 字段和索引（合并为单次 ALTER，减少 MDL 锁次数）
ALTER TABLE `flow`
    ADD COLUMN IF NOT EXISTS `category` VARCHAR(32) DEFAULT '其他' COMMENT '分类：助教/助学/助研/助管/助评/其他',
    DROP INDEX IF EXISTS `idx_category`,
    ADD INDEX `idx_category` (`category`);

-- 3. 迁移现有标签数据到 category 字段（DML，事务保护）
START TRANSACTION;

UPDATE assistant a
JOIN (
    SELECT tl.resource_id, t.name as tag_name
    FROM tag_link tl
    JOIN tag t ON tl.tag_id = t.id
    WHERE tl.resource_type = 5  -- ASSISTANT
    ORDER BY tl.create_time ASC
) tags ON a.id = tags.resource_id
SET a.category = CASE
    WHEN tags.tag_name LIKE '%助教%' THEN '助教'
    WHEN tags.tag_name LIKE '%助学%' THEN '助学'
    WHEN tags.tag_name LIKE '%助研%' THEN '助研'
    WHEN tags.tag_name LIKE '%助管%' THEN '助管'
    WHEN tags.tag_name LIKE '%助评%' THEN '助评'
    ELSE '其他'
END
WHERE a.category = '其他' OR a.category IS NULL;

UPDATE flow f
JOIN (
    SELECT tl.resource_id, t.name as tag_name
    FROM tag_link tl
    JOIN tag t ON tl.tag_id = t.id
    WHERE tl.resource_type IN (1, 10)  -- FLOW, WORKFLOW
    ORDER BY tl.create_time ASC
) tags ON f.id = tags.resource_id
SET f.category = CASE
    WHEN tags.tag_name LIKE '%助教%' THEN '助教'
    WHEN tags.tag_name LIKE '%助学%' THEN '助学'
    WHEN tags.tag_name LIKE '%助研%' THEN '助研'
    WHEN tags.tag_name LIKE '%助管%' THEN '助管'
    WHEN tags.tag_name LIKE '%助评%' THEN '助评'
    ELSE '其他'
END
WHERE f.category = '其他' OR f.category IS NULL;

COMMIT;
