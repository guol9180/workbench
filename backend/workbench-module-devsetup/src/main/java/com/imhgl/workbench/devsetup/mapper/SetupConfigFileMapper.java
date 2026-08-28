package com.imhgl.workbench.devsetup.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.imhgl.workbench.devsetup.entity.SetupConfigFileDO;
import org.apache.ibatis.annotations.Mapper;

/** 开发环境配置文件 mapper */
@Mapper
public interface SetupConfigFileMapper extends BaseMapper<SetupConfigFileDO> {
}
