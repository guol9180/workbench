package com.imhgl.workbench.devsetup.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.imhgl.workbench.devsetup.entity.SetupToolDO;
import org.apache.ibatis.annotations.Mapper;

/** 开发环境工具清单 mapper（MyBatis-Plus 经 infrastructure 传递获得） */
@Mapper
public interface SetupToolMapper extends BaseMapper<SetupToolDO> {
}
