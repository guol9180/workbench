package com.imhgl.workbench.devsetup.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.imhgl.workbench.devsetup.entity.SetupArtifactDO;
import org.apache.ibatis.annotations.Mapper;

/** 开发环境二进制工件 mapper */
@Mapper
public interface SetupArtifactMapper extends BaseMapper<SetupArtifactDO> {
}
