-- E-Agent v2.3.0 智能体公开发布功能 - 数据库迁移脚本
-- 创建日期: 2026-02-27
-- 功能: 添加 is_public 字段，支持应用公开到广场
-- 更新日期: 2026-03-21
-- 说明: is_public 定义更新为 (0=仅自己, 1=组内, 2=全部)

-- ========================================
-- 1. Assistant 表添加公开字段
-- ========================================
ALTER TABLE `assistant`
  ADD COLUMN `is_public` TINYINT(1) DEFAULT 0 COMMENT '可见范围 (0=仅自己, 1=组内, 2=全部)' AFTER `status`;

-- 为 is_public 字段添加索引，优化查询性能
ALTER TABLE `assistant`
  ADD INDEX `idx_status_public` (`status`, `is_public`);

-- ========================================
-- 2. Flow 表添加公开字段
-- ========================================
ALTER TABLE `flow`
  ADD COLUMN `is_public` TINYINT(1) DEFAULT 0 COMMENT '可见范围 (0=仅自己, 1=组内, 2=全部)' AFTER `status`;

-- 为 is_public 字段添加索引，优化查询性能
ALTER TABLE `flow`
  ADD INDEX `idx_status_public` (`status`, `is_public`);

-- ========================================
-- 3. 验证迁移结果
-- ========================================
-- 查看 assistant 表结构
-- DESCRIBE `assistant`;

-- 查看 flow 表结构
-- DESCRIBE `flow`;

-- ========================================
-- 4. 可选：将现有已上线应用设置为公开
-- ========================================
-- 如果希望现有已上线的应用默认公开，取消下面的注释
-- UPDATE `assistant` SET `is_public` = 1 WHERE `status` = 2;
-- UPDATE `flow` SET `is_public` = 1 WHERE `status` = 2;

-- ========================================
-- 回滚脚本（如果需要）
-- ========================================
-- ALTER TABLE `assistant` DROP COLUMN `is_public`, DROP INDEX `idx_status_public`;
-- ALTER TABLE `flow` DROP COLUMN `is_public`, DROP INDEX `idx_status_public`;