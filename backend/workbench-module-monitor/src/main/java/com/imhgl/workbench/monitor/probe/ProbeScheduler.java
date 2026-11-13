package com.imhgl.workbench.monitor.probe;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * 拨测调度：固定间隔串行探测（个人量级目标数，串行足够且避免瞬时并发）。
 * <p>由 workbench.probe.enabled 控制（默认开启）；测试通过属性关闭，避免与用例争用目标。
 */
@Component
@ConditionalOnProperty(prefix = "workbench.probe", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ProbeScheduler {

    private final ProbeService probeService;

    public ProbeScheduler(ProbeService probeService) {
        this.probeService = probeService;
    }

    @Scheduled(fixedDelayString = "${workbench.probe.interval-seconds:60}", timeUnit = TimeUnit.SECONDS)
    public void probeAll() {
        probeService.probeAll();
    }
}
