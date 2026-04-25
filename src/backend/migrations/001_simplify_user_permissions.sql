-- E-Agent v2 用户权限系统简化 - 数据库迁移脚本
-- 由于只有admin账号，无需复杂的数据迁移逻辑
-- 执行时间：2024-02
-- 作者：E-Agent Team

-- ========================================
-- 1. User表添加单一角色和组字段
-- ========================================
ALTER TABLE `user`
  ADD COLUMN `role_id` INT DEFAULT 2 COMMENT '角色ID(外键)',
  ADD COLUMN `group_id` INT DEFAULT 2 COMMENT '用户组ID(外键)',
  ADD INDEX `idx_role_id` (`role_id`),
  ADD INDEX `idx_group_id` (`group_id`);

-- 设置admin账号的角色和组（admin是唯一的账号）
UPDATE `user` SET `role_id` = 1, `group_id` = 1 WHERE `user_name` = 'admin';

-- ========================================
-- 2. Role表添加权限范围字段
-- ========================================
ALTER TABLE `role`
  ADD COLUMN `role_code` VARCHAR(50) COMMENT '角色代码',
  ADD COLUMN `scope_type` TINYINT DEFAULT 0 COMMENT '权限范围: 0全局 1院系 2组 3自己',
  ADD INDEX `idx_role_code` (`role_code`);

-- 更新内置角色的代码和权限范围
UPDATE `role` SET `role_code` = 'admin', `scope_type` = 0 WHERE `id` = 1;  -- 超级管理员
UPDATE `role` SET `role_code` = 'user', `scope_type` = 3 WHERE `id` = 2;   -- 普通用户

-- 插入新的角色类型（为未来准备）
INSERT INTO `role` (`id`, `role_name`, `role_code`, `scope_type`, `remark`, `create_time`)
VALUES
  (3, '教师', 'teacher', 2, '管理本用户组资源', NOW()),
  (4, '院系管理员', 'dept_admin', 1, '管理本院系资源', NOW())
ON DUPLICATE KEY UPDATE
  `role_code` = VALUES(`role_code`),
  `scope_type` = VALUES(`scope_type`);

-- ========================================
-- 3. Group表添加分类字段
-- ========================================
ALTER TABLE `group`
  ADD COLUMN `group_type` TINYINT DEFAULT 1 COMMENT '类型: 1班级 2教研室 3其他',
  ADD COLUMN `dept_id` INT COMMENT '所属院系ID',
  ADD INDEX `idx_dept_id` (`dept_id`);

-- ========================================
-- 4. 验证迁移结果
-- ========================================
-- 查看admin账号的新字段
SELECT `user_id`, `user_name`, `role_id`, `group_id` FROM `user` WHERE `user_name` = 'admin';

-- 查看角色的新字段
SELECT `id`, `role_name`, `role_code`, `scope_type` FROM `role` ORDER BY `id`;

-- ========================================
-- 回滚脚本（如果需要）
-- ========================================
-- ALTER TABLE `user` DROP COLUMN `role_id`, DROP COLUMN `group_id`;
-- ALTER TABLE `role` DROP COLUMN `role_code`, DROP COLUMN `scope_type`;
-- ALTER TABLE `group` DROP COLUMN `group_type`, DROP COLUMN `dept_id`;
-- DELETE FROM `role` WHERE `id` IN (3, 4);