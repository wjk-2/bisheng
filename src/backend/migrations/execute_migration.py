#!/usr/bin/env python3
"""
执行数据库迁移脚本 - 简化用户权限系统
由于只有admin账号，直接执行SQL迁移
"""

import pymysql
from typing import Optional
import sys
import os

# 数据库配置
DB_CONFIG = {
    'host': 'localhost',  # 或者使用容器IP
    'port': 3306,
    'user': 'root',
    'password': '1234',
    'database': 'eagent',
    'charset': 'utf8mb4'
}

def execute_migration(connection: Optional[pymysql.Connection] = None) -> bool:
    """执行数据库迁移"""
    close_conn = False
    if connection is None:
        connection = pymysql.connect(**DB_CONFIG)
        close_conn = True

    try:
        with connection.cursor() as cursor:
            print("开始执行数据库迁移...")

            # 1. User表添加新字段
            print("1. 为user表添加role_id和group_id字段...")
            try:
                cursor.execute("""
                    ALTER TABLE `user`
                    ADD COLUMN `role_id` INT DEFAULT 2 COMMENT '角色ID(外键)',
                    ADD COLUMN `group_id` INT DEFAULT 2 COMMENT '用户组ID(外键)',
                    ADD INDEX `idx_role_id` (`role_id`),
                    ADD INDEX `idx_group_id` (`group_id`)
                """)
                print("   ✓ 字段添加成功")
            except Exception as e:
                if "Duplicate column name" in str(e):
                    print("   - 字段已存在，跳过")
                else:
                    raise

            # 2. 更新admin账号
            print("2. 更新admin账号的role_id和group_id...")
            cursor.execute("""
                UPDATE `user` SET `role_id` = 1, `group_id` = 1
                WHERE `user_name` = 'admin'
            """)
            print(f"   ✓ 更新了 {cursor.rowcount} 条记录")

            # 3. Role表添加新字段
            print("3. 为role表添加role_code和scope_type字段...")
            try:
                cursor.execute("""
                    ALTER TABLE `role`
                    ADD COLUMN `role_code` VARCHAR(50) COMMENT '角色代码',
                    ADD COLUMN `scope_type` TINYINT DEFAULT 0 COMMENT '权限范围',
                    ADD INDEX `idx_role_code` (`role_code`)
                """)
                print("   ✓ 字段添加成功")
            except Exception as e:
                if "Duplicate column name" in str(e):
                    print("   - 字段已存在，跳过")
                else:
                    raise

            # 4. 更新内置角色
            print("4. 更新内置角色的role_code和scope_type...")
            cursor.execute("UPDATE `role` SET `role_code` = 'admin', `scope_type` = 0 WHERE `id` = 1")
            cursor.execute("UPDATE `role` SET `role_code` = 'user', `scope_type` = 3 WHERE `id` = 2")
            print("   ✓ 内置角色更新完成")

            # 5. 添加新角色（如果不存在）
            print("5. 添加新角色类型...")
            cursor.execute("""
                INSERT INTO `role` (`id`, `role_name`, `role_code`, `scope_type`, `remark`)
                VALUES
                    (3, '教师', 'teacher', 2, '管理本用户组资源'),
                    (4, '院系管理员', 'dept_admin', 1, '管理本院系资源')
                ON DUPLICATE KEY UPDATE
                    `role_code` = VALUES(`role_code`),
                    `scope_type` = VALUES(`scope_type`)
            """)
            print(f"   ✓ 新增/更新了 {cursor.rowcount} 个角色")

            # 6. Group表添加新字段
            print("6. 为group表添加group_type和dept_id字段...")
            try:
                cursor.execute("""
                    ALTER TABLE `group`
                    ADD COLUMN `group_type` TINYINT DEFAULT 1 COMMENT '类型',
                    ADD COLUMN `dept_id` INT COMMENT '所属院系ID',
                    ADD INDEX `idx_dept_id` (`dept_id`)
                """)
                print("   ✓ 字段添加成功")
            except Exception as e:
                if "Duplicate column name" in str(e):
                    print("   - 字段已存在，跳过")
                else:
                    raise

            # 7. 验证迁移结果
            print("\n7. 验证迁移结果...")
            cursor.execute("""
                SELECT user_id, user_name, role_id, group_id
                FROM `user`
                WHERE user_name = 'admin'
            """)
            admin_user = cursor.fetchone()
            if admin_user:
                print(f"   ✓ admin账号: user_id={admin_user[0]}, role_id={admin_user[2]}, group_id={admin_user[3]}")

            cursor.execute("""
                SELECT id, role_name, role_code, scope_type
                FROM `role`
                ORDER BY id
            """)
            roles = cursor.fetchall()
            print("   ✓ 角色列表:")
            for role in roles:
                print(f"      - {role[0]}: {role[1]} (code={role[2]}, scope={role[3]})")

            # 提交事务
            connection.commit()
            print("\n✅ 数据库迁移成功完成!")
            return True

    except Exception as e:
        print(f"\n❌ 迁移失败: {str(e)}")
        if close_conn:
            connection.rollback()
        raise
    finally:
        if close_conn:
            connection.close()

def main():
    """主函数"""
    try:
        # 可以从命令行参数获取数据库配置
        if len(sys.argv) > 1:
            DB_CONFIG['host'] = sys.argv[1]

        print("E-Agent v2 用户权限系统简化 - 数据库迁移")
        print("-" * 50)
        print(f"数据库: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")
        print("-" * 50)

        execute_migration()

    except pymysql.Error as e:
        print(f"数据库连接错误: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"执行错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()