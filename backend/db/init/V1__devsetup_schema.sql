-- ============================================================
-- 开发环境管家模块（devsetup）建表脚本
-- 仅在数据卷首次初始化时自动执行；已有库请手动执行（见本目录 README）
-- ============================================================

-- 开发环境工具清单：WINGET=winget 包 / ZIP=绿色版 zip 直链 / IDEA_PLUGIN=IDEA 插件 id
CREATE TABLE IF NOT EXISTS setup_tool (
    id          BIGINT       NOT NULL COMMENT '雪花 ID',
    name        VARCHAR(100) NOT NULL COMMENT '显示名称',
    category    VARCHAR(20)  NOT NULL COMMENT '安装类型：WINGET/ZIP/IDEA_PLUGIN',
    source_ref  VARCHAR(500) NOT NULL COMMENT 'winget 包 id / zip 直链 / 插件 id',
    version     VARCHAR(100) NULL COMMENT '锁定版本（空=最新）',
    enabled     TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否启用：1 是 0 否',
    sort        INT          NOT NULL DEFAULT 0 COMMENT '排序（小在前）',
    note        VARCHAR(500) NULL COMMENT '备注（如插件来源页）',
    create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_setup_tool_category (category)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '开发环境工具清单';

-- 配置文件下发：明文文本配置（maven settings.xml、.gitconfig 等），禁止存放密钥/凭据
CREATE TABLE IF NOT EXISTS setup_config_file (
    id          BIGINT       NOT NULL COMMENT '雪花 ID',
    name        VARCHAR(100) NOT NULL COMMENT '显示名称',
    target_path VARCHAR(300) NOT NULL COMMENT '目标路径（支持 %USERPROFILE% 等环境变量）',
    content     MEDIUMTEXT   NOT NULL COMMENT '文件内容（明文）',
    enabled     TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否启用：1 是 0 否',
    note        VARCHAR(500) NULL COMMENT '备注',
    create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '开发环境配置文件';

-- 二进制工件元数据：IDEA 配置快照 zip 等（二进制内容存阿里云 OSS，本表只存元数据；下载走预签名 URL 302）
CREATE TABLE IF NOT EXISTS setup_artifact (
    id          BIGINT       NOT NULL COMMENT '雪花 ID',
    name        VARCHAR(100) NOT NULL COMMENT '工件名（下载路径的一部分，如 idea-settings）',
    filename    VARCHAR(200) NOT NULL COMMENT '上传时的原始文件名',
    oss_key     VARCHAR(300) NOT NULL COMMENT 'OSS 对象 key（含统一前缀）',
    size        BIGINT       NOT NULL COMMENT '字节数',
    note        VARCHAR(500) NULL COMMENT '备注（如采集自哪台机器/IDEA 版本）',
    create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_setup_artifact_name (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '开发环境二进制工件元数据（内容在 OSS）';
